import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  generateImageJsonSchema,
  generateImageSchema,
  editImageJsonSchema,
  editImageSchema,
  generateImageSetJsonSchema,
  generateImageSetSchema,
} from "./schemas.js";
import { fail, categorizeCodexError, type ToolResult, type SuccessResult } from "./errors.js";
import { runCodexExec, parseSavedLines, outcomeIsFailure, type CodexRunOutcome } from "./codex.js";
import { buildGeneratePrompt, buildEditPrompt, buildSetPrompt, slugify } from "./prompts.js";
import { ensureDir, moveIfNeeded, scanForNewImages, waitForStable } from "./poller.js";

const NODE_MAJOR = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (NODE_MAJOR < 18) {
  process.stderr.write(
    `imagegen MCP server requires Node 18+. Detected: ${process.versions.node}\n`
  );
  process.exit(1);
}

function workspaceRoot(): string {
  return process.cwd();
}

function resolveInWorkspace(p: string): string {
  if (path.isAbsolute(p)) return path.resolve(p);
  return path.resolve(workspaceRoot(), p);
}

export function isUnderTrustedRoot(
  candidate: string,
  expectedPath: string,
  workspace: string
): boolean {
  const abs = path.resolve(candidate);
  const roots = [workspace, path.dirname(expectedPath)].map((r) => path.resolve(r));
  return roots.some((root) => {
    const rel = path.relative(root, abs);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
}

async function finalizeSavedFile(
  expectedPath: string,
  reportedPath: string | undefined,
  startedAt: number
): Promise<{ ok: true; finalPath: string } | { ok: false; reason: string }> {
  const candidates: string[] = [];
  // Only trust Codex's reported path if it lands under the workspace or the
  // dir we explicitly told it to save to. Anything else (e.g. a prompt-injected
  // SAVED line pointing at /etc/passwd) is silently dropped — we fall through
  // to the mtime scan, which only looks inside dirname(expectedPath).
  if (reportedPath && isUnderTrustedRoot(reportedPath, expectedPath, workspaceRoot())) {
    candidates.push(reportedPath);
  }
  if (path.resolve(expectedPath) !== (reportedPath ? path.resolve(reportedPath) : "")) {
    candidates.push(expectedPath);
  }

  for (const c of candidates) {
    const stable = await waitForStable(c);
    if (stable.ok) {
      if (path.resolve(c) !== path.resolve(expectedPath)) {
        try {
          await moveIfNeeded(c, expectedPath);
        } catch {
          return { ok: true, finalPath: path.resolve(c) };
        }
      }
      return { ok: true, finalPath: path.resolve(expectedPath) };
    }
  }

  const dir = path.dirname(expectedPath);
  const matches = await scanForNewImages({ dir, startedAt });
  if (matches.length > 0) {
    const winner = matches[0];
    if (path.resolve(winner.path) !== path.resolve(expectedPath)) {
      try {
        await moveIfNeeded(winner.path, expectedPath);
        return { ok: true, finalPath: path.resolve(expectedPath) };
      } catch {
        return { ok: true, finalPath: winner.path };
      }
    }
    return { ok: true, finalPath: winner.path };
  }

  return { ok: false, reason: "no image file appeared at the requested path or its parent dir" };
}

async function handleGenerateImage(input: unknown): Promise<ToolResult> {
  const parsed = generateImageSchema.safeParse(input);
  if (!parsed.success) {
    return fail("invalid_input", "Input failed validation: " + parsed.error.message);
  }
  const args = parsed.data;
  const root = workspaceRoot();
  const absSavePath = resolveInWorkspace(args.save_path);
  try {
    await ensureDir(path.dirname(absSavePath));
  } catch (err: any) {
    return fail("filesystem_error", `Could not create save_path's parent dir: ${err?.message ?? err}`);
  }

  let absRefPath: string | undefined;
  if (args.reference_image) {
    absRefPath = resolveInWorkspace(args.reference_image);
    try {
      await fs.access(absRefPath);
    } catch {
      return fail("invalid_input", `reference_image not found: ${absRefPath}`);
    }
  }

  const prompt = buildGeneratePrompt(args, absSavePath);
  const outcome = await runCodexExec({
    workspaceRoot: root,
    prompt,
    addDirs: [path.dirname(absSavePath)],
    attachImages: absRefPath ? [absRefPath] : undefined,
    timeoutMs: args.timeout_ms,
  });

  // Check for the saved file FIRST. Codex sometimes saves successfully but
  // hangs/errors during post-processing (e.g. trying to resize without
  // ImageMagick/PIL on Windows). If the image is on disk, that's a success
  // regardless of how Codex itself terminated.
  const saved = parseSavedLines(outcome.lastMessage);
  const reported = saved[0];
  const finalize = await finalizeSavedFile(absSavePath, reported, outcome.startedAt);
  if (finalize.ok) {
    const note = outcomeIsFailure(outcome)
      ? `Codex ${outcome.timedOut ? "timed out" : `exited ${outcome.exitCode ?? "unknown"}`} during post-processing, but the image was saved successfully before that.`
      : outcome.lastMessage.trim().slice(0, 500) || undefined;
    return { ok: true, paths: [finalize.finalPath], notes: note };
  }

  // No file landed on disk. Now categorize the codex failure.
  if (outcomeIsFailure(outcome)) {
    return categorizeCodexError({
      exitCode: outcome.exitCode,
      stderrTail: outcome.stderrTail,
      stdoutTail: outcome.stdoutTail,
      timedOut: outcome.timedOut,
      spawnError: outcome.spawnError,
    });
  }
  return fail("save_path_not_found", finalize.reason, {
    hint: "Codex finished but didn't produce an image file. Run `/imagegen setup` to verify gpt-image is available.",
    raw: {
      stdout_tail: outcome.stdoutTail,
      stderr_tail: outcome.stderrTail,
      exit_code: outcome.exitCode,
    },
  });
}

async function handleEditImage(input: unknown): Promise<ToolResult> {
  const parsed = editImageSchema.safeParse(input);
  if (!parsed.success) {
    return fail("invalid_input", "Input failed validation: " + parsed.error.message);
  }
  const args = parsed.data;
  const root = workspaceRoot();
  const absSourcePath = resolveInWorkspace(args.source_path);
  const absSavePath = resolveInWorkspace(args.save_path);
  const absMaskPath = args.mask_path ? resolveInWorkspace(args.mask_path) : undefined;

  try {
    await fs.access(absSourcePath);
  } catch {
    return fail("invalid_input", `source_path not found: ${absSourcePath}`);
  }
  if (absMaskPath) {
    try {
      await fs.access(absMaskPath);
    } catch {
      return fail("invalid_input", `mask_path not found: ${absMaskPath}`);
    }
  }
  try {
    await ensureDir(path.dirname(absSavePath));
  } catch (err: any) {
    return fail("filesystem_error", `Could not create save_path's parent dir: ${err?.message ?? err}`);
  }

  const prompt = buildEditPrompt(args, absSourcePath, absSavePath, absMaskPath);
  const attach: string[] = [absSourcePath];
  if (absMaskPath) attach.push(absMaskPath);

  const outcome = await runCodexExec({
    workspaceRoot: root,
    prompt,
    addDirs: [path.dirname(absSavePath), path.dirname(absSourcePath)],
    attachImages: attach,
    timeoutMs: args.timeout_ms,
  });

  const saved = parseSavedLines(outcome.lastMessage);
  const reported = saved[0];
  const finalize = await finalizeSavedFile(absSavePath, reported, outcome.startedAt);
  if (finalize.ok) {
    const note = outcomeIsFailure(outcome)
      ? `Codex ${outcome.timedOut ? "timed out" : `exited ${outcome.exitCode ?? "unknown"}`} during post-processing, but the edited image was saved successfully before that.`
      : undefined;
    return { ok: true, paths: [finalize.finalPath], notes: note };
  }

  if (outcomeIsFailure(outcome)) {
    return categorizeCodexError({
      exitCode: outcome.exitCode,
      stderrTail: outcome.stderrTail,
      stdoutTail: outcome.stdoutTail,
      timedOut: outcome.timedOut,
      spawnError: outcome.spawnError,
    });
  }
  return fail("save_path_not_found", finalize.reason, {
    hint: "Codex finished but didn't produce an edited image file. Run `/imagegen setup`.",
    raw: {
      stdout_tail: outcome.stdoutTail,
      stderr_tail: outcome.stderrTail,
      exit_code: outcome.exitCode,
    },
  });
}

async function handleGenerateImageSet(input: unknown): Promise<ToolResult> {
  const parsed = generateImageSetSchema.safeParse(input);
  if (!parsed.success) {
    return fail("invalid_input", "Input failed validation: " + parsed.error.message);
  }
  const args = parsed.data;
  const root = workspaceRoot();
  const absOutDir = resolveInWorkspace(args.output_dir);
  try {
    await ensureDir(absOutDir);
  } catch (err: any) {
    return fail("filesystem_error", `Could not create output_dir: ${err?.message ?? err}`);
  }

  const seenSlugs = new Set<string>();
  const resolvedItems = args.items.map((it) => {
    let slug = slugify(it.name);
    let i = 1;
    while (seenSlugs.has(slug)) {
      slug = `${slugify(it.name)}-${i++}`;
    }
    seenSlugs.add(slug);
    const absSavePath = path.join(absOutDir, `${slug}.png`);
    return {
      name: it.name,
      slug,
      absSavePath,
      prompt: it.prompt,
      size: it.size ?? "1024x1024",
    };
  });

  const prompt = buildSetPrompt(args, resolvedItems);
  const outcome = await runCodexExec({
    workspaceRoot: root,
    prompt,
    addDirs: [absOutDir],
    timeoutMs: args.timeout_ms,
  });

  const savedLines = parseSavedLines(outcome.lastMessage);
  const finalPaths: string[] = [];
  const missing: string[] = [];
  for (let i = 0; i < resolvedItems.length; i++) {
    const item = resolvedItems[i];
    const reported = savedLines[i];
    const finalize = await finalizeSavedFile(item.absSavePath, reported, outcome.startedAt);
    if (finalize.ok) finalPaths.push(finalize.finalPath);
    else missing.push(item.slug);
  }

  if (finalPaths.length > 0) {
    const notes: string[] = [];
    if (missing.length > 0) {
      notes.push(`Generated ${finalPaths.length}/${resolvedItems.length} images. Missing: ${missing.join(", ")}`);
    }
    if (outcomeIsFailure(outcome)) {
      notes.push(
        `Codex ${outcome.timedOut ? "timed out" : `exited ${outcome.exitCode ?? "unknown"}`} during post-processing; partial output was preserved.`
      );
    }
    return { ok: true, paths: finalPaths, notes: notes.join(" ") || undefined };
  }

  if (outcomeIsFailure(outcome)) {
    return categorizeCodexError({
      exitCode: outcome.exitCode,
      stderrTail: outcome.stderrTail,
      stdoutTail: outcome.stdoutTail,
      timedOut: outcome.timedOut,
      spawnError: outcome.spawnError,
    });
  }
  return fail(
    "save_path_not_found",
    `No image files appeared in ${absOutDir}.`,
    {
      hint: "Codex finished but didn't produce any image files. Run `/imagegen setup`.",
      raw: {
        stdout_tail: outcome.stdoutTail,
        stderr_tail: outcome.stderrTail,
        exit_code: outcome.exitCode,
      },
    }
  );
}

function envelope(result: ToolResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError: result.ok === false,
  };
}

const server = new Server(
  { name: "imagegen", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_image",
      description:
        "Generate a single image via Codex CLI's built-in gpt-image tool and save it to a path you specify. Billed against the user's ChatGPT subscription, not the OpenAI API. Burns ChatGPT plan limits ~3-5x faster than text turns; batch requests with generate_image_set when you need multiple coherent images. Returns the absolute path of the saved file.",
      inputSchema: generateImageJsonSchema,
    },
    {
      name: "edit_image",
      description:
        "Edit an existing image (passed by path) using Codex CLI's gpt-image edit tool. Optional mask: alpha=0 areas are redrawn, alpha=255 preserved. Saves to your specified path. Billed against the user's ChatGPT subscription; burns plan limits ~3-5x faster than text turns.",
      inputSchema: editImageJsonSchema,
    },
    {
      name: "generate_image_set",
      description:
        "Generate 2-8 visually-coherent images in one Codex session using a shared style guide. Use when several images need a unified palette/style (icon set, blog series, game roster) — the single-session approach keeps style consistent and uses fewer ChatGPT plan turns than calling generate_image repeatedly.",
      inputSchema: generateImageSetJsonSchema,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const input = req.params.arguments ?? {};
  try {
    switch (name) {
      case "generate_image":
        return envelope(await handleGenerateImage(input));
      case "edit_image":
        return envelope(await handleEditImage(input));
      case "generate_image_set":
        return envelope(await handleGenerateImageSet(input));
      default:
        return envelope(fail("invalid_input", `Unknown tool: ${name}`));
    }
  } catch (err: any) {
    return envelope(
      fail("codex_internal_error", `Unexpected server error: ${err?.message ?? String(err)}`)
    );
  }
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  process.stderr.write(`imagegen MCP server failed to connect: ${err?.message ?? err}\n`);
  process.exit(1);
});
