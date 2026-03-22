import React from 'react';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children ?? null,
  LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Area: () => null,
  AreaChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Cell: () => null,
  PieChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => null,
}));

// Mock acquireVsCodeApi
const mockPostMessage = vi.fn();
(globalThis as any).acquireVsCodeApi = vi.fn(() => ({
  postMessage: mockPostMessage,
  getState: vi.fn(() => null),
  setState: vi.fn(),
}));

// Export for tests to assert on
export { mockPostMessage };

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
  configurable: true,
});

// Mock window.__INITIAL_VIEW__ and __INITIAL_DATA__
Object.defineProperty(window, '__INITIAL_VIEW__', { value: 'dashboard', writable: true });
Object.defineProperty(window, '__INITIAL_DATA__', { value: {}, writable: true });
