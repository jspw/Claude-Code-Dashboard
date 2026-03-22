import React from 'react';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

type WithChildren = { children?: React.ReactNode };
type VSCodeApi = {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
type TestWindow = Window & {
  __INITIAL_VIEW__: string;
  __INITIAL_DATA__: unknown;
};
type GlobalWithVsCode = typeof globalThis & {
  acquireVsCodeApi: () => VSCodeApi;
};

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: WithChildren) => children ?? null,
  LineChart: ({ children }: WithChildren) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  BarChart: ({ children }: WithChildren) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Area: () => null,
  AreaChart: ({ children }: WithChildren) => React.createElement('div', { 'data-testid': 'area-chart' }, children),
  Cell: () => null,
  PieChart: ({ children }: WithChildren) => React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => null,
}));

// Mock acquireVsCodeApi
const mockPostMessage = vi.fn();
(globalThis as GlobalWithVsCode).acquireVsCodeApi = vi.fn(() => ({
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
Object.defineProperty(window as TestWindow, '__INITIAL_VIEW__', { value: 'dashboard', writable: true });
Object.defineProperty(window as TestWindow, '__INITIAL_DATA__', { value: {}, writable: true });
