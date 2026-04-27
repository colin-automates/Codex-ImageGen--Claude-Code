import { describe, it, expect } from "vitest";
import { categorizeCodexError, fail } from "../src/errors.js";

describe("categorizeCodexError", () => {
  const baseRaw = { exitCode: 1, stderrTail: "", stdoutTail: "", timedOut: false };

  it("classifies ENOENT spawn as codex_not_installed", () => {
    const err = Object.assign(new Error("spawn codex ENOENT"), {
      code: "ENOENT",
    }) as NodeJS.ErrnoException;
    const r = categorizeCodexError({
      exitCode: null,
      stderrTail: "",
      stdoutTail: "",
      timedOut: false,
      spawnError: err,
    });
    expect(r.code).toBe("codex_not_installed");
    expect(r.hint).toMatch(/setup/i);
  });

  it("classifies a Windows-style 'not recognized' error as codex_not_installed", () => {
    const err = Object.assign(
      new Error("'codex' is not recognized as an internal or external command"),
      { code: "" }
    ) as NodeJS.ErrnoException;
    const r = categorizeCodexError({
      exitCode: null,
      stderrTail: "",
      stdoutTail: "",
      timedOut: false,
      spawnError: err,
    });
    expect(r.code).toBe("codex_not_installed");
  });

  it("classifies timeout when timedOut is true", () => {
    const r = categorizeCodexError({
      exitCode: null,
      stderrTail: "",
      stdoutTail: "",
      timedOut: true,
    });
    expect(r.code).toBe("codex_timeout");
  });

  it("classifies 'Not logged in' stderr as codex_not_authed", () => {
    const r = categorizeCodexError({
      ...baseRaw,
      stderrTail: "Not logged in. Please run `codex login`.",
    });
    expect(r.code).toBe("codex_not_authed");
    expect(r.hint).toMatch(/codex login/i);
  });

  it("classifies content-policy refusal as content_policy", () => {
    const r = categorizeCodexError({
      ...baseRaw,
      stdoutTail: "I cannot generate this content per safety policy.",
    });
    expect(r.code).toBe("content_policy");
  });

  it("falls back to codex_internal_error for unknown nonzero exit", () => {
    const r = categorizeCodexError({
      ...baseRaw,
      exitCode: 137,
      stderrTail: "some unknown rust panic",
    });
    expect(r.code).toBe("codex_internal_error");
    expect(r.raw?.exit_code).toBe(137);
  });
});

describe("fail()", () => {
  it("constructs a structured failure", () => {
    const f = fail("invalid_input", "bad");
    expect(f.ok).toBe(false);
    expect(f.code).toBe("invalid_input");
    expect(f.message).toBe("bad");
  });

  it("preserves hint and raw fields", () => {
    const f = fail("codex_timeout", "boom", {
      hint: "try again",
      raw: { stdout_tail: "", stderr_tail: "x", exit_code: null },
    });
    expect(f.hint).toBe("try again");
    expect(f.raw?.stderr_tail).toBe("x");
  });
});
