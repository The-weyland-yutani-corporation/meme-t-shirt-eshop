#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OVERRIDE_LABEL = 'policy:protected-path-override';

const PROTECTED_PATHS = [
  {
    category: 'credentials or secrets configuration',
    test: (path) =>
      /(^|\/)(\.env($|\.)|\.npmrc$|\.pypirc$|kubeconfig($|\.)|credentials?($|[._/-])|secrets?($|[._/-]))/i.test(path),
  },
  {
    category: 'identity or role assignments',
    test: (path) =>
      /^\.github\/CODEOWNERS$/i.test(path) ||
      /(^|\/)(iam|rbac|identity|identities|role-?assignments?|service-?accounts?)(\/|$|[._-])/i.test(path),
  },
  {
    category: 'billing configuration',
    test: (path) => /(^|\/)(billing|budgets?|cost-management)(\/|$|[._-])/i.test(path),
  },
  {
    category: 'DNS configuration',
    test: (path) => /(^|\/)(dns|route53|cloudflare|hosted-?zones?|zones?)(\/|$|[._-])/i.test(path),
  },
  {
    category: 'destructive migration',
    test: (path) =>
      /(^|\/)(migrations?|db\/migrate)\//i.test(path) &&
      /(^|[._/-])(down|drop|delete|truncate|destructive|rollback)([._/-]|$)/i.test(path),
  },
  {
    category: 'factory or control-plane configuration',
    test: (path) =>
      /^\.github\/(aw|agents|factories|skills)\//i.test(path) ||
      /^\.github\/workflows\//i.test(path) ||
      /^\.github\/scripts\/protected-path-policy(?:\.test)?\.mjs$/i.test(path) ||
      /(^|\/)(factory|control-plane)(\/|$|[._-])/i.test(path),
  },
];

export function isAutonomousPullRequest(event) {
  if (event?.event_name && event.event_name !== 'pull_request' && event.event_name !== 'pull_request_target') {
    return false;
  }

  const pullRequest = event?.pull_request;
  if (!pullRequest) return false;

  const login = String(pullRequest.user?.login ?? event.sender?.login ?? '').toLowerCase();
  const headRef = String(pullRequest.head?.ref ?? '').toLowerCase();
  const labels = (pullRequest.labels ?? []).map((label) => String(label?.name ?? label).toLowerCase());

  return (
    pullRequest.user?.type === 'Bot' ||
    /\[bot\]$/.test(login) ||
    /^(copilot|dependabot|renovate|github-actions)(-|$)/.test(login) ||
    /^(copilot|dependabot|renovate|squad|github-actions)\//.test(headRef) ||
    labels.some((label) => label.startsWith('squad:'))
  );
}

export function evaluatePolicy({ event, files }) {
  const labels = (event?.pull_request?.labels ?? []).map((label) =>
    String(label?.name ?? label).toLowerCase(),
  );
  const autonomous = isAutonomousPullRequest(event);
  const overridden = labels.includes(OVERRIDE_LABEL);
  const violations = [];

  for (const rawPath of files) {
    const path = rawPath.replaceAll('\\', '/').replace(/^\.\//, '');
    for (const rule of PROTECTED_PATHS) {
      if (rule.test(path)) {
        violations.push({ path, category: rule.category });
        break;
      }
    }
  }

  return {
    allowed: !autonomous || overridden || violations.length === 0,
    autonomous,
    overridden,
    violations,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--event' || argument === '--files0') {
      options[argument.slice(2)] = argv[++index];
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const eventPath = options.event ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('An event payload is required via --event or GITHUB_EVENT_PATH.');
  if (!options.files0) throw new Error('A NUL-delimited changed-files list is required via --files0.');

  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  event.event_name ??= process.env.GITHUB_EVENT_NAME;
  const files = readFileSync(options.files0)
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const result = evaluatePolicy({ event, files });

  if (!result.autonomous && result.violations.length > 0) {
    console.log('Protected paths changed by a human-authored PR; manual review is required.');
  } else if (result.overridden && result.violations.length > 0) {
    console.log(`Maintainer override label "${OVERRIDE_LABEL}" is present; manual review is required.`);
  } else if (result.violations.length === 0) {
    console.log('No protected paths changed.');
  }

  if (!result.allowed) {
    console.error('Autonomous pull requests may not modify protected paths without a maintainer override:');
    for (const violation of result.violations) {
      console.error(`- ${violation.path} (${violation.category})`);
    }
    console.error(`A maintainer may apply the "${OVERRIDE_LABEL}" label after manual review.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
