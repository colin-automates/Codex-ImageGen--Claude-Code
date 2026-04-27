import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { waitForStable, scanForNewImages, ensureDir, moveIfNeeded } from "../src/poller.js";

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "imagegen-test-"));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
});

describe("waitForStable", () => {
  it("returns ok when file exists and stays stable", async () => {
    const p = path.join(workDir, "stable.png");
    await fs.writeFile(p, Buffer.alloc(2048, 0xff));
    const r = await waitForStable(p, { tickMs: 50, maxWaitMs: 1000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.size).toBe(2048);
  });

  it("returns reason=missing if file never appears within window", async () => {
    const p = path.join(workDir, "never.png");
    const r = await waitForStable(p, { tickMs: 50, maxWaitMs: 300 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing");
  });

  it("returns reason=too_small for files under minBytes", async () => {
    const p = path.join(workDir, "tiny.png");
    await fs.writeFile(p, Buffer.alloc(100, 0xff));
    const r = await waitForStable(p, {
      tickMs: 50,
      maxWaitMs: 400,
      minBytes: 1024,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_small");
  });
});

describe("scanForNewImages", () => {
  it("finds image-extension files newer than startedAt", async () => {
    const startedAt = Date.now();
    await new Promise((r) => setTimeout(r, 50));
    const p1 = path.join(workDir, "a.png");
    const p2 = path.join(workDir, "b.jpg");
    const p3 = path.join(workDir, "ignored.txt");
    await fs.writeFile(p1, Buffer.alloc(2048));
    await fs.writeFile(p2, Buffer.alloc(2048));
    await fs.writeFile(p3, "hi");
    const matches = await scanForNewImages({ dir: workDir, startedAt });
    expect(matches.length).toBe(2);
    const names = matches.map((m) => path.basename(m.path)).sort();
    expect(names).toEqual(["a.png", "b.jpg"]);
  });

  it("returns empty array if dir doesn't exist", async () => {
    const matches = await scanForNewImages({
      dir: path.join(workDir, "no-such"),
      startedAt: Date.now() - 10_000,
    });
    expect(matches).toEqual([]);
  });
});

describe("ensureDir", () => {
  it("creates a nested dir without error", async () => {
    const target = path.join(workDir, "a", "b", "c");
    await ensureDir(target);
    const stat = await fs.stat(target);
    expect(stat.isDirectory()).toBe(true);
  });

  it("is a no-op if dir already exists", async () => {
    await ensureDir(workDir);
    await expect(ensureDir(workDir)).resolves.toBeUndefined();
  });
});

describe("moveIfNeeded", () => {
  it("renames when from != to", async () => {
    const from = path.join(workDir, "a.png");
    const to = path.join(workDir, "b.png");
    await fs.writeFile(from, Buffer.alloc(1024));
    await moveIfNeeded(from, to);
    await expect(fs.access(to)).resolves.toBeUndefined();
    await expect(fs.access(from)).rejects.toThrow();
  });

  it("does nothing when from == to", async () => {
    const same = path.join(workDir, "x.png");
    await fs.writeFile(same, Buffer.alloc(1024));
    await moveIfNeeded(same, same);
    const stat = await fs.stat(same);
    expect(stat.size).toBe(1024);
  });

  it("creates the destination's parent dir if missing", async () => {
    const from = path.join(workDir, "a.png");
    const to = path.join(workDir, "nested", "deep", "b.png");
    await fs.writeFile(from, Buffer.alloc(1024));
    await moveIfNeeded(from, to);
    await expect(fs.access(to)).resolves.toBeUndefined();
  });
});
