import { execFileSync } from 'node:child_process';
import { validateCommitSubject } from './commit-message-utils.mjs';

const range = process.argv[2];

if (!range) {
  console.error('Usage: node scripts/validate-commit-range.mjs <git-range>');
  process.exit(1);
}

const output = execFileSync(
  'git',
  ['log', '--format=%H%x09%s', range],
  { encoding: 'utf8' }
);

const failures = output
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [sha, subject] = line.split('\t');
    const result = validateCommitSubject(subject);
    return result.valid ? null : { sha, subject, reason: result.reason };
  })
  .filter(Boolean);

if (failures.length > 0) {
  console.error(`Found ${failures.length} invalid commit message(s) in range ${range}:`);
  for (const failure of failures) {
    console.error(`- ${failure.sha.slice(0, 7)} ${failure.subject}`);
    console.error(`  ${failure.reason}`);
  }
  process.exit(1);
}

console.log(`Validated commit subjects in range ${range}`);
