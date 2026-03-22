import { vi } from 'vitest';

// Register the vscode mock globally so all imports of 'vscode' resolve to it
vi.mock('vscode', () => import('./__mocks__/vscode'));
