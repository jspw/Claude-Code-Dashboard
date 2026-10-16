import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import LiveDot, { liveLabel } from '../LiveDot';

describe('LiveDot', () => {
  it('pulses green while Claude works', () => {
    render(<LiveDot status="busy" />);
    expect(screen.getByRole('img', { name: 'Claude is working' })).toHaveClass('bg-green-400', 'animate-pulse');
  });

  it('pulses yellow while a session waits on you, saying for what', () => {
    render(<LiveDot status="waiting" waitingFor="permission prompt" />);
    expect(screen.getByRole('img', { name: 'Waiting on you: permission prompt' })).toHaveClass('bg-yellow-400', 'animate-pulse');
  });

  it('sits still while a session is open but idle', () => {
    render(<LiveDot status="idle" />);
    expect(screen.getByRole('img', { name: 'Open, waiting for your next prompt' })).not.toHaveClass('animate-pulse');
  });

  it('keeps the plain live look when Claude Code reports no state', () => {
    render(<LiveDot status={null} className="w-2 h-2" />);
    expect(screen.getByRole('img', { name: 'Running now' })).toHaveClass('w-2', 'h-2', 'bg-green-400', 'animate-pulse');
  });

  it('labels each state in a word, leaving unknown ones to the caller', () => {
    expect(['busy', 'waiting', 'idle', null].map(s => liveLabel(s as never))).toEqual(['working', 'needs you', 'idle', null]);
  });
});
