import { promises as fs } from "node:fs";
import * as path from "node:path";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function statSafe(p: string): Promise<{ size: number; mtimeMs: number } | null> {
  try {
    const s = await fs.stat(p);
    if (!s.isFile()) return null;
    return { size: s.size, mtimeMs: s.mtimeMs };
  } catch {
    return null;
  }
}

export async function waitForStable(
  filePath: string,
  opts: { tickMs?: number; maxWaitMs?: number; minBytes?: number } = {}
): Promise<{ ok: true; size: number } | { ok: false; reason: "missing" | "unstable" | "too_small" }> {
  const tickMs = opts.tickMs ?? 250;
  const maxWaitMs = opts.maxWaitMs ?? 30_000;
  const minBytes = opts.minBytes ?? 1024;
  const deadline = Date.now() + maxWaitMs;
  let lastSize = -1;
  let stableHits = 0;

  while (Date.now() < deadline) {
    const s = await statSafe(filePath);
    if (s) {
      if (s.size === lastSize && s.size >= minBytes) {
        stableHits += 1;
        if (stableHits >= 2) return { ok: true, size: s.size };
      } else {
        stableHits = 0;
        lastSize = s.size;
      }
    } else {
      stableHits = 0;
      lastSize = -1;
    }
    await new Promise((r) => setTimeout(r, tickMs));
  }

  const finalStat = await statSafe(filePath);
  if (!finalStat) return { ok: false, reason: "missing" };
  if (finalStat.size < minBytes) return { ok: false, reason: "too_small" };
  return { ok: false, reason: "unstable" };
}

export interface MtimeScanOpts {
  dir: string;
  startedAt: number;
}

export async function scanForNewImages(
  opts: MtimeScanOpts
): Promise<{ path: string; size: number; mtimeMs: number }[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(opts.dir);
  } catch {
    return [];
  }
  const found: { path: string; size: number; mtimeMs: number }[] = [];
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const abs = path.resolve(opts.dir, name);
    const s = await statSafe(abs);
    if (!s) continue;
    if (s.mtimeMs >= opts.startedAt - 1000 && s.size >= 1024) {
      found.push({ path: abs, size: s.size, mtimeMs: s.mtimeMs });
    }
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function moveIfNeeded(fromPath: string, toPath: string): Promise<void> {
  const fromAbs = path.resolve(fromPath);
  const toAbs = path.resolve(toPath);
  if (fromAbs === toAbs) return;
  await fs.mkdir(path.dirname(toAbs), { recursive: true });
  try {
    await fs.rename(fromAbs, toAbs);
  } catch (err: any) {
    if (err && err.code === "EXDEV") {
      const data = await fs.readFile(fromAbs);
      await fs.writeFile(toAbs, data);
      await fs.unlink(fromAbs);
    } else {
      throw err;
    }
  }
}
