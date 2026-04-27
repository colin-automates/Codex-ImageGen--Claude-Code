import { spawn } from "node:child_process";
import { promises as fs, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface CodexRunArgs {
  workspaceRoot: string;
  prompt: string;
  addDirs: string[];
  attachImages?: string[];
  timeoutMs: number;
}

/**
 * Always returned. Captures everything we know about the run regardless of
 * whether the child exited cleanly. The caller decides whether to treat the
 * outcome as success or failure based on whether a saved file is on disk.
 */
export interface CodexRunOutcome {
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
  lastMessage: string;
  timedOut: boolean;
  spawnError?: NodeJS.ErrnoException;
  startedAt: number;
}

const TAIL_BYTES = 8 * 1024;

function tail(buf: string): string {
  if (buf.length <= TAIL_BYTES) return buf;
  return "..." + buf.slice(buf.length - TAIL_BYTES);
}

function lastMsgFilePath(): string {
  const base =
    process.env.CLAUDE_PLUGIN_DATA && process.env.CLAUDE_PLUGIN_DATA.length > 0
      ? process.env.CLAUDE_PLUGIN_DATA
      : os.tmpdir();
  try {
    if (!existsSync(base)) mkdirSync(base, { recursive: true });
  } catch {
    // fall through; mkdtempSync will surface the error
  }
  const dir = mkdtempSync(path.join(base, "imagegen-"));
  return path.join(dir, "last-message.txt");
}

export async function runCodexExec(args: CodexRunArgs): Promise<CodexRunOutcome> {
  const lastMsgFile = lastMsgFilePath();

  const cliArgs: string[] = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "danger-full-access",
    "--cd",
    args.workspaceRoot,
    "--output-last-message",
    lastMsgFile,
    "--color",
    "never",
  ];
  for (const dir of args.addDirs) {
    cliArgs.push("--add-dir", dir);
  }
  if (args.attachImages) {
    for (const img of args.attachImages) {
      cliArgs.push("-i", img);
    }
  }
  cliArgs.push(args.prompt);

  const startedAt = Date.now();
  let stdoutBuf = "";
  let stderrBuf = "";
  let exitCode: number | null = null;
  let timedOut = false;
  let spawnError: NodeJS.ErrnoException | undefined;

  const child = spawn("codex", cliArgs, {
    cwd: args.workspaceRoot,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const exitPromise = new Promise<void>((resolve) => {
    child.on("error", (err) => {
      spawnError = err as NodeJS.ErrnoException;
      resolve();
    });
    child.on("close", (code) => {
      exitCode = code;
      resolve();
    });
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString("utf8");
    if (stdoutBuf.length > TAIL_BYTES * 2) stdoutBuf = stdoutBuf.slice(-TAIL_BYTES * 2);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString("utf8");
    if (stderrBuf.length > TAIL_BYTES * 2) stderrBuf = stderrBuf.slice(-TAIL_BYTES * 2);
  });

  const killer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill("SIGTERM");
    } catch {
      /* noop */
    }
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* noop */
      }
    }, 3000);
  }, args.timeoutMs);

  await exitPromise;
  clearTimeout(killer);

  const stdoutTail = tail(stdoutBuf);
  const stderrTail = tail(stderrBuf);

  let lastMessage = "";
  try {
    lastMessage = await fs.readFile(lastMsgFile, "utf8");
  } catch {
    lastMessage = "";
  } finally {
    // Clean up the per-call tempdir so we don't leak under CLAUDE_PLUGIN_DATA.
    fs.rm(path.dirname(lastMsgFile), { recursive: true, force: true }).catch(() => {});
  }

  return {
    exitCode,
    stdoutTail,
    stderrTail,
    lastMessage,
    timedOut,
    spawnError,
    startedAt,
  };
}

export function parseSavedLines(lastMessage: string): string[] {
  const out: string[] = [];
  const re = /^SAVED\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lastMessage))) {
    const p = m[1].trim().replace(/^["']|["']$/g, "");
    if (p) out.push(p);
  }
  return out;
}

/**
 * True if the outcome indicates the child failed to run normally to completion
 * (spawn ENOENT, killed by our timeout, or non-zero exit).
 */
export function outcomeIsFailure(o: CodexRunOutcome): boolean {
  return Boolean(o.spawnError) || o.timedOut || (o.exitCode !== null && o.exitCode !== 0);
}
