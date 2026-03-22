import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';

/**
 * Custom render that wraps components with any providers needed for tests.
 * Currently a pass-through, but provides a central place to add context providers.
 */
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { ...options });
}

export { customRender as render };
export { screen, fireEvent, waitFor, within, act } from '@testing-library/react';
