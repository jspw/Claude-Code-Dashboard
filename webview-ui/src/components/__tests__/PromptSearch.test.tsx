import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '../../__tests__/helpers/render-helpers';
import { makePromptSearchResult } from '../../__tests__/fixtures/test-data';
import PromptSearch from '../PromptSearch';

describe('PromptSearch', () => {
  it('shows empty, results, and no-result states', () => {
    render(<PromptSearch allPrompts={[makePromptSearchResult()]} />);
    expect(screen.getByText('Type to search across all prompts')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search across all prompts...'), { target: { value: 'bug' } });
    expect(screen.getByText('1 result')).toBeInTheDocument();
    expect(screen.getByText('test-project')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search across all prompts...'), { target: { value: 'nope' } });
    expect(screen.getByText('No prompts found matching "nope"')).toBeInTheDocument();
  });
});
