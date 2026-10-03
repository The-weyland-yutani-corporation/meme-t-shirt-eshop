import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controller = readFileSync(
  new URL("../workflows/factory-controller.md", import.meta.url),
  "utf8",
);
const compiledController = readFileSync(
  new URL("../workflows/factory-controller.lock.yml", import.meta.url),
  "utf8",
);

test("continues successful Signal Intake runs without broadening bot trust", () => {
  assert.match(controller, /on:\s*\n\s+roles: all/);
  assert.match(controller, /issues:\s*\n\s+types: \[opened, labeled, closed\]/);
  assert.match(controller, /pull_request:\s*\n\s+types: \[closed\]/);
  assert.match(controller, /schedule:\s*\n\s+- cron: "\*\/30 \* \* \* \*"/);
  assert.match(controller, /workflow_dispatch:/);
  assert.match(
    controller,
    /bots:\s*\n\s+- github-actions\[bot\]\s*\n\s+workflow_run:/,
  );
  assert.doesNotMatch(
    controller,
    /bots:\s*\n(?:\s+- .+\n)*\s+- (?!github-actions\[bot\])/,
  );
  assert.match(controller, /workflows: \[Factory Signal Intake\]/);
  assert.match(controller, /types: \[completed\]/);
  assert.match(controller, /branches: \[main\]/);
  assert.match(
    controller,
    /github\.event\.workflow_run\.conclusion == 'success'/,
  );
  assert.match(
    controller,
    /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/,
  );
  assert.match(
    controller,
    /github\.event\.workflow_run\.head_branch == github\.event\.repository\.default_branch/,
  );
  assert.match(
    compiledController,
    /GH_AW_ALLOWED_BOTS: "github-actions\[bot\]"/,
  );
  assert.doesNotMatch(
    compiledController,
    /GH_AW_ALLOWED_BOTS: "(?!github-actions\[bot\]")/,
  );
});

test("fails closed while an exact or unresolved active dispatch may exist", () => {
  assert.match(
    controller,
    /status `queued`,\s*\n\s+`in_progress`, `requested`, or `waiting`/,
  );
  assert.match(
    controller,
    /GH_AW_GITHUB_EVENT_INPUTS_ISSUE_NUMBER: \{N\}/,
  );
  assert.match(controller, /exact issue\/command run\s+is active/);
  assert.match(
    controller,
    /same-command active run exists but its issue\s+input cannot be read yet, fail closed and defer/,
  );
  assert.match(
    controller,
    /Never assume that a missing receipt means no dispatch is active/,
  );
});
