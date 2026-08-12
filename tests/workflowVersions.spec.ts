// specs/005-pr-trigger-ci/tasks.md T002
// daily.yml と ci.yml の pnpm/Node バージョン設定が一致することを検証する(research.md #1)。
// ci.yml は未実装のため、現時点では失敗する。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  uses?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  steps?: WorkflowStep[];
}

interface WorkflowDoc {
  jobs?: Record<string, WorkflowJob>;
}

function readWorkflow(relativePath: string): WorkflowDoc {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return parse(readFileSync(path, "utf-8")) as WorkflowDoc;
}

function extractVersions(doc: WorkflowDoc): { pnpmVersion: unknown; nodeVersion: unknown } {
  const steps = Object.values(doc.jobs ?? {}).flatMap((job) => job.steps ?? []);
  const pnpmStep = steps.find((step) => step.uses?.startsWith("pnpm/action-setup@"));
  const nodeStep = steps.find((step) => step.uses?.startsWith("actions/setup-node@"));
  return {
    pnpmVersion: pnpmStep?.with?.version,
    nodeVersion: nodeStep?.with?.["node-version"],
  };
}

describe("daily.yml と ci.yml のNode/pnpmバージョン整合", () => {
  it("pnpm/action-setupのversionとactions/setup-nodeのnode-versionが一致する", () => {
    const daily = extractVersions(readWorkflow("../.github/workflows/daily.yml"));
    const ci = extractVersions(readWorkflow("../.github/workflows/ci.yml"));

    expect(daily.pnpmVersion).toBeDefined();
    expect(daily.nodeVersion).toBeDefined();
    expect(ci.pnpmVersion).toBe(daily.pnpmVersion);
    expect(ci.nodeVersion).toBe(daily.nodeVersion);
  });
});
