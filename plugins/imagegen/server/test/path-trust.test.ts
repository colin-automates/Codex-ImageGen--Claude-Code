import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { isUnderTrustedRoot } from "../src/index.js";

const workspace = path.resolve("/work/project");
const expected = path.resolve("/work/project/public/images/hero.png");

describe("isUnderTrustedRoot", () => {
  it("accepts the exact expected path", () => {
    expect(isUnderTrustedRoot(expected, expected, workspace)).toBe(true);
  });

  it("accepts a sibling under the expected dir", () => {
    const sibling = path.resolve("/work/project/public/images/hero-2.png");
    expect(isUnderTrustedRoot(sibling, expected, workspace)).toBe(true);
  });

  it("accepts any path under the workspace root", () => {
    const elsewhere = path.resolve("/work/project/generated/foo.png");
    expect(isUnderTrustedRoot(elsewhere, expected, workspace)).toBe(true);
  });

  it("rejects paths outside the workspace and outside the expected dir", () => {
    const escaped = path.resolve("/etc/passwd");
    expect(isUnderTrustedRoot(escaped, expected, workspace)).toBe(false);
  });

  it("rejects parent-traversal paths that resolve outside trusted roots", () => {
    const traversed = path.resolve("/work/project/../neighbor/secret.png");
    expect(isUnderTrustedRoot(traversed, expected, workspace)).toBe(false);
  });
});
