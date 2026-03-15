import * as fs from 'fs';
import { Session, Turn, ToolCall } from '../store/DashboardStore';

const MODEL_COSTS: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-4':    { input: 15,   output: 75,  cacheWrite: 18.75, cacheRead: 1.5  },
  'claude-sonnet-4':  { input: 3,    output: 15,  cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-haiku-4':   { input: 0.8,  output: 4,   cacheWrite: 1,     cacheRead: 0.08 },
  default:            { input: 3,    output: 15,  cacheWrite: 3.75,  cacheRead: 0.3  },
};

function modelKey(model: string): string {
  if (model?.includes('opus'))   { return 'claude-opus-4'; }
  if (model?.includes('haiku'))  { return 'claude-haiku-4'; }
  return 'claude-sonnet-4';
}

export interface ParsedSession extends Session {
  cwd: string | null;
  isActiveSession: boolean;
}

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
            const text = Array.isArray(rawContent)
              ? rawContent.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('')
              : typeof rawContent === 'string' ? rawContent : '';

            // Skip internal command messages for turn content
            const displayText = text.replace(/<command-message>.*?<\/command-message>/gs, '').trim();

            // Capture first meaningful user prompt as session summary
            if (!sessionSummary && displayText.length > 0) {
              sessionSummary = displayText.slice(0, 120) + (displayText.length > 120 ? '…' : '');
            }

            turns.push({
              id: entry.uuid || String(ts),
              role: 'user',
              content: displayText,
              inputTokens: 0,
              outputTokens: 0,
              toolCalls: [],
              timestamp: ts,
            });
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

            for (const block of contentBlocks) {
              if (block.type === 'text') { textContent += block.text; }
              if (block.type === 'thinking') {
                hasThinking = true;
                // thinking blocks may report their own token count
                if (typeof block.thinking_tokens === 'number') {
                  thinkingTokens += block.thinking_tokens as number;
                }
              }
              if (block.type === 'tool_use') {
                toolCallCount++;
                toolCalls.push({ id: block.id, name: block.name, input: block.input ?? {} });

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
