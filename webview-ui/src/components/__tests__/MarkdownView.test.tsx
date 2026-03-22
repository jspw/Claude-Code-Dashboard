import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { CommandBlock, MarkdownView } from '../MarkdownView';

describe('MarkdownView', () => {
  it('renders headings, emphasis, code blocks, and lists', () => {
    render(<MarkdownView content={'# Title\n\nParagraph with `code` and **bold** and *italic*\n\n- one\n- two\n\n1. first\n2. second\n\n```ts\nconst x = 1;\n```'} />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('toggles command content', () => {
    render(<CommandBlock command={{ name: 'deploy', content: 'Deploy **now**' }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Deploy')).toBeInTheDocument();
    expect(screen.getByText('now')).toBeInTheDocument();
  });
});
