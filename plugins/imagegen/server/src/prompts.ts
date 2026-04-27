import type { GenerateImageInput, EditImageInput, GenerateImageSetInput } from "./schemas.js";

const STYLE_HINTS: Record<string, string> = {
  photoreal:
    "Photoreal: real texture, imperfections, natural light, candid framing. Avoid 'studio', 'stock', 'overly polished', or cartoonish features.",
  illustration:
    "Illustration: clean line work, intentional color palette, expressive composition. Treat it as a deliberate illustration, not a photograph.",
  flat:
    "Flat vector style: solid fills, minimal gradients, geometric shapes, modern editorial feel.",
  "3d":
    "3D rendered look: soft global illumination, subtle ambient occlusion, physically-plausible materials, smooth bevels.",
  sketch:
    "Hand-drawn sketch: visible pencil strokes, light cross-hatching, off-white paper background, slightly imperfect lines.",
  auto: "",
};

const BG_HINTS: Record<string, string> = {
  transparent: "Background must be fully transparent (alpha channel). Output PNG with transparency.",
  opaque: "Background should be fully opaque, with a deliberate color or scene.",
  auto: "",
};

function styleLine(style: string): string {
  const hint = STYLE_HINTS[style];
  return hint ? `Style guidance: ${hint}` : "";
}

function bgLine(bg: string): string {
  const hint = BG_HINTS[bg];
  return hint ? `Background: ${hint}` : "";
}

export function buildGeneratePrompt(input: GenerateImageInput, absSavePath: string): string {
  const lines = [
    `@imagegen ${input.prompt.trim()}`,
    "",
    "Use the built-in gpt-image tool, not the OpenAI API CLI fallback.",
    `Size: ${input.size}. Quality: ${input.quality}.`,
    styleLine(input.style),
    bgLine(input.background),
    input.reference_image
      ? `A reference image is attached at ${input.reference_image} — use it for visual guidance.`
      : "",
    "",
    `Save the generated image to exactly this absolute path: ${absSavePath}`,
    "After saving, reply with only one line in the form:",
    `SAVED ${absSavePath}`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export function buildEditPrompt(
  input: EditImageInput,
  absSourcePath: string,
  absSavePath: string,
  absMaskPath?: string
): string {
  const lines = [
    `@imagegen Edit the attached image: ${input.prompt.trim()}`,
    "",
    `Source image: ${absSourcePath} (attached).`,
    absMaskPath
      ? `Edit mask: ${absMaskPath} — alpha 0 (transparent) marks areas to redraw, alpha 255 (opaque) marks areas to preserve.`
      : "",
    "Use the built-in gpt-image edit tool, not the OpenAI API CLI fallback.",
    `Size: ${input.size}. Quality: ${input.quality}.`,
    "Preserve the overall composition unless the edit instructions say otherwise.",
    "",
    `Save the edited image to exactly this absolute path: ${absSavePath}`,
    "After saving, reply with only one line in the form:",
    `SAVED ${absSavePath}`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export function buildSetPrompt(
  input: GenerateImageSetInput,
  resolvedItems: { name: string; slug: string; absSavePath: string; prompt: string; size: string }[]
): string {
  const header = [
    `@imagegen Generate ${resolvedItems.length} coherent images that share one unified visual identity.`,
    "",
    "Shared style guide (apply to ALL images, override per-image only when a prompt explicitly asks):",
    input.style_guide.trim(),
    "",
    "Use the built-in gpt-image tool, not the OpenAI API CLI fallback.",
    `Quality for every image: ${input.quality}.`,
    "Maintain consistent palette, lighting, line weight, and rendering style across the whole set.",
    "",
  ];

  const items = resolvedItems.map((item, idx) => {
    return [
      `Image ${idx + 1} — name "${item.name}" — size ${item.size}:`,
      `  Prompt: ${item.prompt}`,
      `  Save to absolute path: ${item.absSavePath}`,
    ].join("\n");
  });

  const footer = [
    "",
    "After every image is saved, reply with one line per image, each in the form:",
    "SAVED <absolute path>",
    "Output exactly N SAVED lines and nothing else.",
  ];

  return [...header, ...items, ...footer].join("\n");
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image"
  );
}
