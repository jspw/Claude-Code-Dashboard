import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.CI) {
  console.log('Skipping git hook setup in CI.');
  process.exit(0);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gitRoot;
try {
  gitRoot = execFileSync('git', ['-C', projectRoot, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
} catch {
  console.log('Skipping git hook setup outside a git worktree.');
  process.exit(0);
}

if (path.resolve(gitRoot) !== projectRoot) {
  console.log('Skipping git hook setup because this package is not the repository root.');
  process.exit(0);
}

const hooksPath = path.join(projectRoot, '.githooks');
const hookNames = ['pre-commit', 'commit-msg', 'pre-push'];

for (const hookName of hookNames) {
  const hookPath = path.join(hooksPath, hookName);
  if (!fs.existsSync(hookPath)) {
    throw new Error(`Missing required git hook: .githooks/${hookName}`);
  }
  fs.chmodSync(hookPath, 0o755);
}

execFileSync('git', ['-C', projectRoot, 'config', '--local', 'core.hooksPath', '.githooks'], {
  stdio: 'ignore',
});

console.log(`Configured ${hookNames.join(', ')} hooks from .githooks`);
