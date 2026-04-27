import { z } from "zod";

const sizeEnum = z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const qualityEnum = z.enum(["low", "medium", "high", "auto"]);
const styleEnum = z.enum(["photoreal", "illustration", "flat", "3d", "sketch", "auto"]);
const backgroundEnum = z.enum(["transparent", "opaque", "auto"]);

export const generateImageSchema = z.object({
  prompt: z.string().min(1).max(8000),
  save_path: z.string().min(1),
  size: sizeEnum.default("1024x1024"),
  quality: qualityEnum.default("medium"),
  style: styleEnum.default("auto"),
  background: backgroundEnum.default("auto"),
  reference_image: z.string().min(1).optional(),
  timeout_ms: z.number().int().min(15000).max(300000).default(120000),
});
export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export const editImageSchema = z.object({
  source_path: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  save_path: z.string().min(1),
  mask_path: z.string().min(1).optional(),
  size: sizeEnum.default("1024x1024"),
  quality: qualityEnum.default("medium"),
  timeout_ms: z.number().int().min(15000).max(300000).default(120000),
});
export type EditImageInput = z.infer<typeof editImageSchema>;

export const generateImageSetSchema = z.object({
  style_guide: z.string().min(1).max(4000),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        prompt: z.string().min(1).max(2000),
        size: sizeEnum.optional(),
      })
    )
    .min(2)
    .max(8),
  output_dir: z.string().min(1),
  quality: qualityEnum.default("medium"),
  timeout_ms: z.number().int().min(30000).max(600000).default(300000),
});
export type GenerateImageSetInput = z.infer<typeof generateImageSetSchema>;

export const generateImageJsonSchema = {
  type: "object",
  properties: {
    prompt: { type: "string", minLength: 1, maxLength: 8000, description: "What to draw. Detailed, photographic-style description gets best results." },
    save_path: { type: "string", minLength: 1, description: "Absolute or workspace-relative path where the PNG should land." },
    size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"], default: "1024x1024" },
    quality: { type: "string", enum: ["low", "medium", "high", "auto"], default: "medium" },
    style: { type: "string", enum: ["photoreal", "illustration", "flat", "3d", "sketch", "auto"], default: "auto" },
    background: { type: "string", enum: ["transparent", "opaque", "auto"], default: "auto" },
    reference_image: { type: "string", description: "Optional path to a reference image for visual guidance." },
    timeout_ms: { type: "integer", minimum: 15000, maximum: 300000, default: 120000 },
  },
  required: ["prompt", "save_path"],
  additionalProperties: false,
} as const;

export const editImageJsonSchema = {
  type: "object",
  properties: {
    source_path: { type: "string", minLength: 1, description: "Path to the existing image you want to edit." },
    prompt: { type: "string", minLength: 1, maxLength: 8000, description: "What to change about the image." },
    save_path: { type: "string", minLength: 1, description: "Where to write the edited result." },
    mask_path: { type: "string", description: "Optional PNG mask: alpha=0 areas will be edited; alpha=255 areas preserved." },
    size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"], default: "1024x1024" },
    quality: { type: "string", enum: ["low", "medium", "high", "auto"], default: "medium" },
    timeout_ms: { type: "integer", minimum: 15000, maximum: 300000, default: 120000 },
  },
  required: ["source_path", "prompt", "save_path"],
  additionalProperties: false,
} as const;

export const generateImageSetJsonSchema = {
  type: "object",
  properties: {
    style_guide: { type: "string", minLength: 1, maxLength: 4000, description: "Shared visual identity. One paragraph: palette, mood, rendering rules. Applied to every image in the set." },
    items: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120, description: "Logical id; slugified for the filename." },
          prompt: { type: "string", minLength: 1, maxLength: 2000 },
          size: { type: "string", enum: ["1024x1024", "1024x1536", "1536x1024", "auto"] },
        },
        required: ["name", "prompt"],
        additionalProperties: false,
      },
    },
    output_dir: { type: "string", minLength: 1, description: "Directory for the set. Created if missing." },
    quality: { type: "string", enum: ["low", "medium", "high", "auto"], default: "medium" },
    timeout_ms: { type: "integer", minimum: 30000, maximum: 600000, default: 300000 },
  },
  required: ["style_guide", "items", "output_dir"],
  additionalProperties: false,
} as const;
