import * as fs from 'fs';
import { Session, Turn, ToolCall, TurnAttachment } from '../store/DashboardStore';

/** Date the pricing table below was last synced against published Anthropic pricing. */
export const PRICING_TABLE_DATE = '2026-06';

// USD per million tokens by model family. Cache writes bill at 1.25x input
// (5-minute TTL); cache reads at 0.1x input.
const MODEL_COSTS: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'fable':        { input: 10,  output: 50, cacheWrite: 12.5,  cacheRead: 1    }, // Fable 5 / Mythos 5
  'opus':         { input: 5,   output: 25, cacheWrite: 6.25,  cacheRead: 0.5  }, // Opus 4.5+
  'opus-legacy':  { input: 15,  output: 75, cacheWrite: 18.75, cacheRead: 1.5  }, // Opus 4.0 / 4.1 / Opus 3
  'sonnet':       { input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3  }, // Sonnet 4.x / Sonnet 5
  'haiku':        { input: 1,   output: 5,  cacheWrite: 1.25,  cacheRead: 0.1  }, // Haiku 4.5
  'haiku-legacy': { input: 0.8, output: 4,  cacheWrite: 1,     cacheRead: 0.08 }, // Haiku 3.x
  default:        { input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3  }, // unknown model → Sonnet rates
};

export function modelKey(model: string): string {
  const m = (model || '').toLowerCase();
  if (m.includes('fable') || m.includes('mythos')) { return 'fable'; }
  if (m.includes('opus')) {
    return /opus-4-[01]\b|opus-4-2025|3-opus/.test(m) ? 'opus-legacy' : 'opus';
  }
  if (m.includes('haiku')) {
    return /haiku-[4-9]/.test(m) ? 'haiku' : 'haiku-legacy';
  }
  if (m.includes('sonnet')) { return 'sonnet'; }
  return 'default';
}

export interface ParsedSession extends Session {
  cwd: string | null;
  isActiveSession: boolean;
}

// Turns ship to the webview over postMessage — cap the bulky per-turn extras
// so a session with huge tool outputs or long thinking stays lightweight.
const TOOL_OUTPUT_CAP = 2500;
const THINKING_TEXT_CAP = 10000;

export class SessionParser {
  /** Read just the cwd from the first entry in a JSONL file */
  readCwd(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) { continue; }
        try {
          const entry = JSON.parse(line);
          if (entry.cwd) { return entry.cwd as string; }
        } catch { continue; }
      }
    } catch { /* ignore */ }
    return null;
  }

  parseFile(filePath: string, projectId: string): ParsedSession | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length === 0) { return null; }

      const turns: Turn[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;
      let startTime = 0;
      let lastTimestamp = 0;
      let lastStopReason: string | null = null;
      let cwd: string | null = null;
      let detectedModel = 'default';
      const filesModified: Set<string> = new Set();
      const filesCreated: Set<string> = new Set();
      let toolCallCount = 0;
      let sessionSummary: string | null = null;
      let hasThinking = false;
      let thinkingTokens = 0;
      // File attachments appear as separate entries right after the user
      // message that @-tagged them; buffer any that arrive before their turn.
      let pendingAttachments: TurnAttachment[] = [];
      // Tool results echo back as later user entries referencing tool_use_id.
      const toolCallById = new Map<string, ToolCall>();

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Grab cwd from any entry that has it
          if (!cwd && entry.cwd) { cwd = entry.cwd; }

          const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
          if (ts > lastTimestamp) { lastTimestamp = ts; }

          if (entry.type === 'user' && entry.message) {
            if (!startTime && ts) { startTime = ts; }

            const rawContent = entry.message.content;

            // Attach tool results to the originating tool call — they are
            // echoes of assistant activity, not user prompts.
            const toolResults = Array.isArray(rawContent)
              ? rawContent.filter((c: any) => c.type === 'tool_result')
              : [];
            for (const tr of toolResults) {
              const target = toolCallById.get(tr.tool_use_id);
              if (!target || target.output !== undefined) { continue; }
              const raw = typeof tr.content === 'string'
                ? tr.content
                : Array.isArray(tr.content)
                  ? tr.content.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('\n')
                  : '';
              const trimmed = raw.trim();
              if (trimmed) { target.output = trimmed.slice(0, TOOL_OUTPUT_CAP); }
            }

            const text = Array.isArray(rawContent)
              ? rawContent.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('')
              : typeof rawContent === 'string' ? rawContent : '';

            // Skip internal command messages and IDE-injected context for turn content
            const displayText = text
              .replace(/<command-message>.*?<\/command-message>/gs, '')
              .replace(/<ide_opened_file>.*?<\/ide_opened_file>/gs, '')
              .replace(/<ide_selection>.*?<\/ide_selection>/gs, '')
              .trim();

            // Capture first meaningful user prompt as session summary, skipping
            // injected skill instructions (they aren't the user's actual prompt).
            if (!sessionSummary && displayText.length > 0 && !displayText.startsWith('Base directory for this skill:')) {
              sessionSummary = displayText.slice(0, 120) + (displayText.length > 120 ? '…' : '');
            }

            // Pure tool-result entries are not prompts — skip the turn entirely.
            if (toolResults.length === 0 || displayText.length > 0) {
              turns.push({
                id: entry.uuid || String(ts),
                role: 'user',
                content: displayText,
                inputTokens: 0,
                outputTokens: 0,
                toolCalls: [],
                timestamp: ts,
                ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
              });
              pendingAttachments = [];
            }
          }

          if (entry.type === 'attachment' && entry.attachment?.type === 'file') {
            const path = (entry.attachment.filename || entry.attachment.displayPath || '') as string;
            const displayPath = (entry.attachment.displayPath || entry.attachment.filename || '') as string;
            if (path) {
              const lastTurn = turns[turns.length - 1];
              if (lastTurn && lastTurn.role === 'user') {
                lastTurn.attachments = lastTurn.attachments ?? [];
                if (!lastTurn.attachments.some(a => a.path === path)) {
                  lastTurn.attachments.push({ path, displayPath });
                }
              } else if (!pendingAttachments.some(a => a.path === path)) {
                pendingAttachments.push({ path, displayPath });
              }
            }
          }

          if (entry.type === 'assistant' && entry.message) {
            const usage = entry.message.usage || {};
            const inTok   = (usage.input_tokens || 0) as number;
            const outTok  = (usage.output_tokens || 0) as number;
            const cacheCreate = (usage.cache_creation_input_tokens || 0) as number;
            const cacheRead   = (usage.cache_read_input_tokens || 0) as number;

            inputTokens       += inTok;
            outputTokens      += outTok;
            cacheCreationTokens += cacheCreate;
            cacheReadTokens   += cacheRead;

            if (entry.message.model) { detectedModel = entry.message.model; }
            lastStopReason = entry.message.stop_reason ?? null;

            const toolCalls: ToolCall[] = [];
            const contentBlocks = Array.isArray(entry.message.content) ? entry.message.content : [];
            let textContent = '';
            let turnThinking = '';

            for (const block of contentBlocks) {
              if (block.type === 'text') { textContent += block.text; }
              if (block.type === 'thinking') {
                hasThinking = true;
                if (typeof block.thinking === 'string') { turnThinking += block.thinking; }
                // thinking blocks may report their own token count
                if (typeof block.thinking_tokens === 'number') {
                  thinkingTokens += block.thinking_tokens as number;
                }
              }
              if (block.type === 'tool_use') {
                toolCallCount++;
                const mcpServer = typeof block.name === 'string' && block.name.startsWith('mcp__')
                  ? (block.name.split('__')[1] ?? undefined)
                  : undefined;
                const call: ToolCall = { id: block.id, name: block.name, input: block.input ?? {}, mcpServer };
                toolCalls.push(call);
                if (block.id) { toolCallById.set(block.id, call); }

                if (block.name === 'Write') {
                  const fp = block.input?.file_path as string | undefined;
                  if (fp) { filesCreated.add(fp); }
                } else if (block.name === 'Edit' || block.name === 'MultiEdit') {
                  const fp = block.input?.file_path as string | undefined;
                  if (fp) { filesModified.add(fp); }
                }
              }
            }

            turns.push({
              id: entry.uuid || String(ts),
              role: 'assistant',
              content: textContent,
              inputTokens: inTok + cacheCreate, // fresh input + cache writes (not reads)
              outputTokens: outTok,
              toolCalls,
              timestamp: ts,
              ...(turnThinking.trim() ? { thinking: turnThinking.trim().slice(0, THINKING_TEXT_CAP) } : {}),
            });
          }
        } catch { /* skip malformed lines */ }
      }

      // Compute idle time: sum of assistant→user gaps exceeding the threshold
      const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
      const sortedTurns = [...turns].sort((a, b) => a.timestamp - b.timestamp);
      let idleTimeMs = 0;
      for (let i = 0; i < sortedTurns.length - 1; i++) {
        if (sortedTurns[i].role === 'assistant' && sortedTurns[i + 1].role === 'user') {
          const gap = sortedTurns[i + 1].timestamp - sortedTurns[i].timestamp;
          if (gap > IDLE_THRESHOLD_MS) { idleTimeMs += gap; }
        }
      }

      // Heuristic fallback for when PID-based detection is unavailable.
      // end_turn is normal between turns (user may still be typing), so use 30 min.
      // Other stop reasons suggest the session actually ended, so use 5 min.
      const fiveMinMs = 5 * 60 * 1000;
      const thirtyMinMs = 30 * 60 * 1000;
      const timeSince = Date.now() - lastTimestamp;
      const isActiveSession = lastTimestamp > 0 && (
        lastStopReason === 'end_turn'
          ? timeSince < thirtyMinMs
          : timeSince < fiveMinMs
      );

      // totalTokens = fresh input + cache writes + output
      // Cache reads are excluded — they're cheap re-reads of existing context
      // and would inflate the number by 10-20x (e.g. 17M cache reads vs 1M real tokens)
      const totalTokens = inputTokens + cacheCreationTokens + outputTokens;
      const costUsd = this.estimateCostDetailed(inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, detectedModel);
      // 'fallback' = no model recorded, or family not in the pricing table (priced at Sonnet rates)
      const pricingConfidence: 'exact' | 'fallback' =
        detectedModel !== 'default' && modelKey(detectedModel) !== 'default' ? 'exact' : 'fallback';
      const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';

      // endTime: last timestamp seen, or null if still active
      const endTime = isActiveSession ? null : (lastTimestamp || null);

      const totalInputForCache = inputTokens + cacheCreationTokens + cacheReadTokens;
      const cacheHitRate = totalInputForCache > 0
        ? Math.round((cacheReadTokens / totalInputForCache) * 1000) / 10
        : 0;

      const durationMs = endTime && startTime ? endTime - startTime : null;
      const hasEnoughTurns = sortedTurns.length >= 2;
      const computedIdleTimeMs = hasEnoughTurns ? idleTimeMs : null;
      const computedActiveTimeMs = durationMs !== null && computedIdleTimeMs !== null
        ? Math.max(0, durationMs - computedIdleTimeMs)
        : null;
      const activityRatio = durationMs !== null && durationMs > 0 && computedActiveTimeMs !== null
        ? Math.round((computedActiveTimeMs / durationMs) * 1000) / 10
        : null;

      return {
        id: sessionId,
        projectId,
        parentSessionId: null,
        cwd,
        isActiveSession,
        startTime,
        endTime,
        durationMs,
        inputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        outputTokens,
        totalTokens,
        costUsd,
        promptCount: turns.filter(t => t.role === 'user').length,
        toolCallCount,
        filesModified: [...Array.from(filesModified), ...Array.from(filesCreated)],
        filesCreated: Array.from(filesCreated),
        turns,
        sessionSummary,
        hasThinking,
        thinkingTokens,
        cacheHitRate,
        subagentCostUsd: 0, // populated by DashboardStore after scanning subagents/
        idleTimeMs: computedIdleTimeMs,
        activeTimeMs: computedActiveTimeMs,
        activityRatio,
        model: detectedModel !== 'default' ? detectedModel : null,
        pricingConfidence,
      };
    } catch (e) {
      console.error('Failed to parse session file:', filePath, e);
      return null;
    }
  }

  estimateCostDetailed(
    inputTokens: number,
    outputTokens: number,
    cacheCreationTokens: number,
    cacheReadTokens: number,
    model: string
  ): number {
    const rates = MODEL_COSTS[modelKey(model)] || MODEL_COSTS.default;
    return (
      (inputTokens          * rates.input      / 1_000_000) +
      (outputTokens         * rates.output     / 1_000_000) +
      (cacheCreationTokens  * rates.cacheWrite / 1_000_000) +
      (cacheReadTokens      * rates.cacheRead  / 1_000_000)
    );
  }

  estimateCost(totalTokens: number, model = 'default'): number {
    const rates = MODEL_COSTS[model] || MODEL_COSTS.default;
    return ((totalTokens * 0.5 * rates.input) + (totalTokens * 0.5 * rates.output)) / 1_000_000;
  }
}
