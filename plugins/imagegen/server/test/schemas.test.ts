import { describe, it, expect } from "vitest";
import {
  generateImageSchema,
  editImageSchema,
  generateImageSetSchema,
} from "../src/schemas.js";

describe("generateImageSchema", () => {
  it("accepts a minimal valid input and applies defaults", () => {
    const r = generateImageSchema.parse({
      prompt: "a red square",
      save_path: "./out.png",
    });
    expect(r.size).toBe("1024x1024");
    expect(r.quality).toBe("medium");
    expect(r.style).toBe("auto");
    expect(r.background).toBe("auto");
    expect(r.timeout_ms).toBe(120_000);
    expect(r.reference_image).toBeUndefined();
  });

  it("rejects missing prompt", () => {
    const r = generateImageSchema.safeParse({ save_path: "./out.png" });
    expect(r.success).toBe(false);
  });

  it("rejects missing save_path", () => {
    const r = generateImageSchema.safeParse({ prompt: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects empty prompt", () => {
    const r = generateImageSchema.safeParse({ prompt: "", save_path: "./out.png" });
    expect(r.success).toBe(false);
  });

  it("rejects out-of-range timeout_ms", () => {
    const tooShort = generateImageSchema.safeParse({
      prompt: "x",
      save_path: "./out.png",
      timeout_ms: 1_000,
    });
    expect(tooShort.success).toBe(false);
    const tooLong = generateImageSchema.safeParse({
      prompt: "x",
      save_path: "./out.png",
      timeout_ms: 10_000_000,
    });
    expect(tooLong.success).toBe(false);
  });

  it("accepts all valid size enum values", () => {
    for (const size of ["1024x1024", "1024x1536", "1536x1024", "auto"] as const) {
      const r = generateImageSchema.safeParse({
        prompt: "x",
        save_path: "./out.png",
        size,
      });
      expect(r.success).toBe(true);
    }
  });

  it("rejects an unknown size value", () => {
    const r = generateImageSchema.safeParse({
      prompt: "x",
      save_path: "./out.png",
      size: "999x999",
    });
    expect(r.success).toBe(false);
  });
});

describe("editImageSchema", () => {
  it("accepts minimal valid input", () => {
    const r = editImageSchema.parse({
      source_path: "./in.png",
      prompt: "make it blue",
      save_path: "./out.png",
    });
    expect(r.size).toBe("1024x1024");
    expect(r.quality).toBe("medium");
  });

  it("rejects missing source_path", () => {
    const r = editImageSchema.safeParse({
      prompt: "x",
      save_path: "./out.png",
    });
    expect(r.success).toBe(false);
  });
});

describe("generateImageSetSchema", () => {
  it("accepts 2 items minimum and applies defaults", () => {
    const r = generateImageSetSchema.parse({
      style_guide: "flat vector",
      items: [
        { name: "a", prompt: "red square" },
        { name: "b", prompt: "blue square" },
      ],
      output_dir: "./set",
    });
    expect(r.quality).toBe("medium");
    expect(r.timeout_ms).toBe(300_000);
    expect(r.items.length).toBe(2);
  });

  it("rejects fewer than 2 items", () => {
    const r = generateImageSetSchema.safeParse({
      style_guide: "x",
      items: [{ name: "a", prompt: "x" }],
      output_dir: "./set",
    });
    expect(r.success).toBe(false);
  });

  it("rejects more than 8 items", () => {
    const r = generateImageSetSchema.safeParse({
      style_guide: "x",
      items: Array.from({ length: 9 }, (_, i) => ({
        name: `n${i}`,
        prompt: `p${i}`,
      })),
      output_dir: "./set",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty style_guide", () => {
    const r = generateImageSetSchema.safeParse({
      style_guide: "",
      items: [
        { name: "a", prompt: "x" },
        { name: "b", prompt: "y" },
      ],
      output_dir: "./set",
    });
    expect(r.success).toBe(false);
  });
});
