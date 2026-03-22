import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../../__tests__/helpers/render-helpers';
import LiveSessionBanner from '../LiveSessionBanner';

describe('LiveSessionBanner', () => {
  it('renders nothing for zero sessions and pluralizes otherwise', () => {
    const { rerender, container } = render(<LiveSessionBanner activeCount={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LiveSessionBanner activeCount={2} />);
    expect(screen.getByText('2 active sessions running')).toBeInTheDocument();
  });
});
