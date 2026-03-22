import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import { makeProject } from '../../__tests__/fixtures/test-data';
import ActiveSessionCard from '../ActiveSessionCard';

describe('ActiveSessionCard', () => {
  it('renders the active project name', () => {
    render(<ActiveSessionCard project={makeProject({ name: 'Live Project', isActive: true })} />);
    expect(screen.getByText('Live Project')).toBeInTheDocument();
  });
});
