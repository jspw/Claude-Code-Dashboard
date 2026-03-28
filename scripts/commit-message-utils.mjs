const ALLOWED_TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'chore',
  'test',
  'style',
  'build',
  'ci',
  'revert',
];

const COMMIT_SUBJECT_PATTERN =
  /^(?<type>[a-z]+)(?:\([a-z0-9._/-]+\))?(?<breaking>!)?: (?<description>\S.*)$/;

export function getAllowedTypes() {
  return [...ALLOWED_TYPES];
}

export function getFirstCommitLine(message) {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#')) ?? '';
}

export function validateCommitSubject(subject) {
  if (!subject) {
    return {
      valid: false,
      reason: 'Commit message is empty.',
    };
  }

  const match = COMMIT_SUBJECT_PATTERN.exec(subject);
  if (!match) {
    return {
      valid: false,
      reason:
        'Commit subject must match <type>(<scope>): <description> or <type>: <description>.',
    };
  }

  const { type, description } = match.groups;

  if (!ALLOWED_TYPES.includes(type)) {
    return {
      valid: false,
      reason: `Unsupported commit type "${type}". Allowed types: ${ALLOWED_TYPES.join(', ')}.`,
    };
  }

  if (description.length > 72) {
    return {
      valid: false,
      reason: `Commit description is too long (${description.length} chars). Keep the subject line at 72 characters or fewer.`,
    };
  }

  return { valid: true };
}

export function getExamples() {
  return [
    'feat(dashboard): add weekly token comparison',
    'fix(parser): handle missing session metadata',
    'docs: update release workflow notes',
    'chore(ci): validate commit messages in pull requests',
  ];
}
