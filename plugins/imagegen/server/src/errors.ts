export type ErrorCode =
  | "codex_not_installed"
  | "codex_not_authed"
  | "codex_timeout"
  | "content_policy"
  | "save_path_not_found"
  | "invalid_input"
  | "codex_internal_error"
  | "filesystem_error";

export interface SuccessResult {
  ok: true;
  paths: string[];
  notes?: string;
  codex_session_id?: string;
}

export interface FailureResult {
  ok: false;
  code: ErrorCode;
  message: string;
  hint?: string;
  raw?: {
    stdout_tail: string;
    stderr_tail: string;
    exit_code: number | null;
  };
}

export type ToolResult = SuccessResult | FailureResult;

export function fail(
  code: ErrorCode,
  message: string,
  opts: { hint?: string; raw?: FailureResult["raw"] } = {}
): FailureResult {
  return { ok: false, code, message, hint: opts.hint, raw: opts.raw };
}

export function categorizeCodexError(args: {
  exitCode: number | null;
  stderrTail: string;
  stdoutTail: string;
  timedOut: boolean;
  spawnError?: NodeJS.ErrnoException;
}): FailureResult {
  const { exitCode, stderrTail, stdoutTail, timedOut, spawnError } = args;
  const tail = `${stdoutTail}\n${stderrTail}`;
  const raw = { stdout_tail: stdoutTail, stderr_tail: stderrTail, exit_code: exitCode };

  if (spawnError && (spawnError.code === "ENOENT" || /not found|not recognized/i.test(spawnError.message))) {
    return fail("codex_not_installed", "Codex CLI not found on PATH.", {
      hint: "Run `/imagegen setup` to install it (`npm install -g @openai/codex`).",
      raw,
    });
  }

  if (timedOut) {
    return fail("codex_timeout", "Codex did not finish within the timeout window.", {
      hint: "Increase timeout_ms, or check `codex login status` and your network.",
      raw,
    });
  }

  if (/not (logged in|authenticated)|please log in|run `?codex login`?/i.test(tail)) {
    return fail("codex_not_authed", "Codex is not logged in.", {
      hint: "Open a terminal and run `codex login`, then retry.",
      raw,
    });
  }

  if (/safety|content[- ]policy|cannot generate this content|policy violation/i.test(tail)) {
    return fail("content_policy", "OpenAI's content policy refused this request.", {
      hint: "Rephrase the prompt and avoid disallowed content.",
      raw,
    });
  }

  return fail("codex_internal_error", `Codex exited with code ${exitCode ?? "null"}.`, {
    hint: "Re-run with a simpler prompt; if it persists, run `/imagegen setup`.",
    raw,
  });
}
