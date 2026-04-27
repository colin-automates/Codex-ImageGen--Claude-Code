---
description: Generate an image (or a coherent set of images) from a prompt — `/imagegen "<prompt>"`. Or run `/imagegen setup` to verify the install. Routes through the imagegen MCP server (Codex CLI / gpt-image).
argument-hint: setup | <prompt> | <prompt 1> | <prompt 2> | ...
---

The user invoked `/imagegen`. Raw arguments:

```
$ARGUMENTS
```

### Step 1 — dispatch on the first token

Take `$ARGUMENTS`, trim whitespace, then strip a single layer of surrounding `"…"` or `'…'` quotes if present. Call the result `text`.

- If `text` is empty: ask the user once "What should I generate?" and stop. Do nothing else.
- If `text` is exactly `setup`, `--setup`, `-h`, `help`, `--help`, or starts with `setup ` or `help ` (followed by whitespace) → **go to Step 2 (setup mode)**.
- If `text` clearly describes **multiple coherent images** that should share a visual identity → **go to Step 4 (set mode)**. Triggers:
  - Pipe-separated prompts: `text` contains a literal `|` between distinct subjects (legacy set syntax — still supported).
  - Numeric multi-image phrasing: "three icons for X", "five sprites of Y", "a set/series/pack/collection/roster of N", "N variants of Z".
  - Plural request with shared theme: "icons for the home, settings, and profile pages", "headers for the four blog posts about X", "enemies in red, blue, and green".
- Otherwise → **go to Step 3 (single-image generation)**.

### Step 2 — setup mode (equivalent to `/imagegen:setup`)

Execute the **exact procedure** documented in `commands/setup.md`. That procedure handles the codex install check, auto-launches a browser sign-in window with polling if the user is not logged in, runs a probe image, and reports the outcome. Do not duplicate or summarize its steps — read `commands/setup.md` and follow it verbatim.

### Step 3 — single-image generation

The `text` from Step 1 is the user's image prompt. Do this **immediately, without asking for confirmation**:

1. Pick `save_path` per the SKILL's defaults table:
   - If `./public/images/` exists → save there.
   - Else if `./public/` exists → save there.
   - Else if `./assets/` exists → save there.
   - Else if `./images/` exists → save there.
   - Else default to `./generated/<timestamp>-<slug>.png`, creating the dir.
   `<slug>` is the prompt's first 3–6 meaningful words, lowercase-hyphenated.
2. Pick `size`: `1536x1024` if the prompt mentions "hero", "banner", "cover", "og", "wide", or "landscape"; `1024x1536` if "portrait", "vertical", or "tall"; otherwise `1024x1024`.
3. Pick `quality`: `high` if the prompt mentions "hero", "final", "print", or "brand"; otherwise `medium`.
4. Pick `style`: `photoreal` if the prompt mentions "photo", "photograph", or "realistic"; otherwise leave as `auto`.
5. Apply the prompt-construction guide from the SKILL (subject + action + setting + lighting + lens/framing + texture cues + composition) to expand `text` into a full prompt. Do **not** show the expanded prompt to the user.
6. Call `mcp__plugin_imagegen_imagegen__generate_image` with the resolved arguments.
7. On success: tell the user the path and dimensions in 1–2 short sentences. Don't echo the prompt.
8. On failure: surface the `hint` field from the error envelope verbatim, plus a one-sentence next step.

### Step 4 — set mode (multiple coherent images)

The `text` describes 2 or more images that should share one visual identity. Do this **immediately, without asking for confirmation**:

1. **Parse out the individual items**:
   - If `text` contains `|`: split on `|` and trim each part. Each part is one item's prompt.
   - Else if `text` mentions an explicit count ("three X", "5 sprites of Y"): extract the count and individual subjects.
   - Else infer items from a comma/and list ("home, settings, and profile pages" → 3 items).
   - Result: an array of 2–8 items. If you can't confidently parse 2+ items, fall back to Step 3 (single image).
2. **Derive a `name` for each item**: first 3–5 meaningful words of that item's prompt, slugified (lowercase, hyphens). Dedupe with `-2`, `-3` suffixes if collisions.
3. **Pick `output_dir`**: prefer a contextual directory if the user mentioned one (e.g., `./public/icons/`, `./assets/sprites/`); else default to `./generated/set-<timestamp>/`, creating it.
4. **Draft a one-paragraph `style_guide`** (~50–80 words) that captures the SHARED visual identity all items must follow:
   - Palette (2–5 named colors, with hex if you can pick them confidently)
   - Mood / atmosphere
   - Rendering style (flat vector, photoreal, isometric line art, 3d render, watercolor, etc.) — name it explicitly
   - Line weight or texture vocabulary
   - Composition rules (centered, padding, perspective)
   - Constraints (no text, no watermark, transparent vs opaque background, etc.)
   If the user gave style hints in any item ("flat vector", "pixel art", "photoreal"), apply that style across ALL items in the style_guide.
5. **Pick `quality`**: `medium` default; `high` only if the user explicitly said so.
6. **Build the `items` array**: `{ name, prompt }` for each. Default `size` to `1024x1024` unless an item's prompt suggests landscape ("hero"/"banner") or portrait ("portrait"/"tall").
7. Call `mcp__plugin_imagegen_imagegen__generate_image_set` with `style_guide`, `items`, `output_dir`, `quality`, `timeout_ms` (use 360000 — set generation is slower).
8. On success: list the saved file paths in a short bullet list, one per line.
9. On failure: surface the `hint` field from the error envelope, plus a one-sentence next step.
