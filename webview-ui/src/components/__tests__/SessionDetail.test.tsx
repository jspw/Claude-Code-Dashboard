import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../../__tests__/helpers/render-helpers';
import { makeSession, makeToolCall, makeTurn } from '../../__tests__/fixtures/test-data';
import SessionDetail from '../SessionDetail';

describe('SessionDetail', () => {
  it('renders loading, system events, tool calls, and clipboard copy', async () => {
    const session = makeSession({
      model: 'claude-sonnet-4',
      turns: [
        makeTurn({ role: 'user', content: '<command-name>npm</command-name><command-args>test</command-args>', timestamp: 1 }),
        makeTurn({ role: 'user', content: '<command-stdout>\x1b[31moutput\x1b[0m</command-stdout>', timestamp: 2 }),
        makeTurn({ role: 'assistant', content: 'Done', toolCalls: [
          makeToolCall({ name: 'Agent', input: { prompt: 'Investigate bug' } }),
          makeToolCall({ name: 'Edit', input: { file_path: '/src/index.ts' } }),
        ], timestamp: 3 }),
      ],
    });

    const { rerender } = render(<SessionDetail session={session} turns={session.turns} loading={true} />);
    expect(screen.getByText('Loading turns...')).toBeInTheDocument();

    rerender(<SessionDetail session={session} turns={session.turns} loading={false} />);
    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('output')).toBeInTheDocument();
    expect(screen.getByText('Investigate bug')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();

    const copyButtons = screen.getAllByRole('button');
    await act(async () => {
      fireEvent.click(copyButtons.find((button) => button.getAttribute('title') === 'Copy')!);
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('renders no-turns state and created file badges', () => {
    const session = makeSession({
      model: 'claude-haiku-4',
      filesModified: ['/src/new.ts'],
      filesCreated: ['/src/new.ts'],
      turns: [],
    });

    render(<SessionDetail session={session} turns={[]} loading={false} />);
    expect(screen.getByText('No turns recorded for this session.')).toBeInTheDocument();
    expect(screen.getByText(/new.ts/)).toBeInTheDocument();
    expect(screen.getByText('Haiku')).toBeInTheDocument();
  });
});
