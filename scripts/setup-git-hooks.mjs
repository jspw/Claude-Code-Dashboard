import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
    stdio: 'ignore',
  });
} catch {
  console.log('Skipping git hook setup outside a git worktree.');
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'ignore',
});

console.log('Configured git hooks to use .githooks');
