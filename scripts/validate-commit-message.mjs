import fs from 'node:fs';
import {
  getAllowedTypes,
  getExamples,
  getFirstCommitLine,
  validateCommitSubject,
} from './commit-message-utils.mjs';

function parseArgs(argv) {
  const args = {
    source: 'commit message',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--edit') {
      args.editFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--message') {
      args.message = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--source') {
      args.source = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return args;
}

function readMessage({ editFile, message }) {
  if (message) {
    return message;
  }

  if (editFile) {
    return fs.readFileSync(editFile, 'utf8');
  }

  return '';
}

function printFailure(source, subject, reason) {
  console.error(`Invalid ${source}.`);
  if (subject) {
    console.error(`Subject: "${subject}"`);
  }
  console.error(reason);
  console.error('');
  console.error(`Allowed types: ${getAllowedTypes().join(', ')}`);
  console.error('Examples:');

  for (const example of getExamples()) {
    console.error(`  - ${example}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const message = readMessage(args);
const subject = getFirstCommitLine(message);
const result = validateCommitSubject(subject);

if (!result.valid) {
  printFailure(args.source, subject, result.reason);
  process.exit(1);
}

console.log(`Validated ${args.source}: ${subject}`);
