import { describe, it, expect } from "vitest";
import { parseSavedLines, outcomeIsFailure } from "../src/codex.js";
import type { CodexRunOutcome } from "../src/codex.js";

describe("parseSavedLines", () => {
  it("extracts a single SAVED line", () => {
    const r = parseSavedLines("SAVED /tmp/out.png");
    expect(r).toEqual(["/tmp/out.png"]);
  });

  it("extracts multiple SAVED lines", () => {
    const r = parseSavedLines(
      "SAVED /tmp/a.png\nSAVED /tmp/b.png\nSAVED /tmp/c.png"
    );
    expect(r).toEqual(["/tmp/a.png", "/tmp/b.png", "/tmp/c.png"]);
  });

  it("trims trailing whitespace", () => {
    const r = parseSavedLines("SAVED /tmp/out.png   \n");
    expect(r).toEqual(["/tmp/out.png"]);
  });

  it("strips surrounding quotes", () => {
    const r = parseSavedLines('SAVED "C:\\\\path with spaces\\\\out.png"');
    expect(r).toEqual(["C:\\\\path with spaces\\\\out.png"]);
  });

  it("returns empty array when no SAVED lines present", () => {
    const r = parseSavedLines("Done.");
    expect(r).toEqual([]);
  });

  it("ignores lines that are not start-of-line SAVED", () => {
    const r = parseSavedLines(
      "Some text. SAVED inline-but-not-start.png\nSAVED /tmp/real.png"
    );
    expect(r).toEqual(["/tmp/real.png"]);
  });

  it("handles SAVED with multiple spaces", () => {
    const r = parseSavedLines("SAVED   /tmp/out.png");
    expect(r).toEqual(["/tmp/out.png"]);
  });
});

function baseOutcome(overrides: Partial<CodexRunOutcome> = {}): CodexRunOutcome {
  return {
    exitCode: 0,
    stdoutTail: "",
    stderrTail: "",
    lastMessage: "",
    timedOut: false,
    spawnError: undefined,
    startedAt: Date.now(),
    ...overrides,
  };
}

describe("outcomeIsFailure", () => {
  it("returns false on clean exit (code 0)", () => {
    expect(outcomeIsFailure(baseOutcome())).toBe(false);
  });

  it("returns true on nonzero exit", () => {
    expect(outcomeIsFailure(baseOutcome({ exitCode: 1 }))).toBe(true);
  });

  it("returns true on timeout (even if exitCode would be 0)", () => {
    expect(outcomeIsFailure(baseOutcome({ timedOut: true }))).toBe(true);
  });

  it("returns true on spawn error", () => {
    const err = Object.assign(new Error("ENOENT"), {
      code: "ENOENT",
    }) as NodeJS.ErrnoException;
    expect(
      outcomeIsFailure(baseOutcome({ exitCode: null, spawnError: err }))
    ).toBe(true);
  });

  it("returns false when exitCode is null but no other failure signal", () => {
    // exitCode null without timeout or spawnError can happen if process group state is odd;
    // we treat it as not-explicitly-failed.
    expect(outcomeIsFailure(baseOutcome({ exitCode: null }))).toBe(false);
  });
});
