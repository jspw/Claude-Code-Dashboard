import React from 'react';
import { Turn } from '../../types';
import { parseSystemContent } from './systemEvents';
import { UserMessageCard } from './UserMessageCard';
import { ResponseGroup } from './ResponseGroup';

// A real user prompt (typed or attachments-only) — everything else, including
// system-injected "user" turns, belongs on the response timeline.
export function isPromptTurn(turn: Turn): boolean {
  if (turn.role !== 'user') { return false; }
  const content = turn.content?.trim() ?? '';
  if (!content) { return (turn.attachments?.length ?? 0) > 0; }
  return parseSystemContent(content) === null;
}

// Renders one turn standalone: the user prompt card, or a timeline group of
// one. Grouping upstream (SessionDetail) merges consecutive non-prompt turns
// into a single ResponseGroup so the connector line runs unbroken.
export function ConversationTurn({ turn, projectRoot }: { turn: Turn; projectRoot?: string | null }) {
  if (isPromptTurn(turn)) { return <UserMessageCard turn={turn} />; }
  return <ResponseGroup turns={[turn]} projectRoot={projectRoot} />;
}
