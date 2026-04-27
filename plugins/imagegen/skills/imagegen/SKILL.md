---
name: imagegen
description: Use this skill whenever the user needs an actual rendered image file generated, edited, or refreshed — for websites, web apps, README/docs, slide decks, marketing pages, blog posts, game assets, mockups, hero images, og-images, favicons, illustrations, photos, logos, brand marks, icons, textures, thumbnails, empty-state art, social cards, or any task where a missing/placeholder/empty <img>, background-image, asset slot, or visual reference would be filled by an image. Also use it when the user explicitly asks to "generate", "create", "make", "draw", "render", "design", "edit", or "redo" an image, picture, photo, illustration, screenshot mockup, or visual. Delegates execution to OpenAI Codex CLI (built-in gpt-image, billed against the user's ChatGPT subscription, no API key needed). Do NOT trigger for: SVG icons that match an existing icon set, code-rendered charts, screenshots of running code, or anything the user explicitly said not to generate. Always call the MCP tools (mcp__plugin_imagegen_imagegen__generate_image, mcp__plugin_imagegen_imagegen__edit_image, mcp__plugin_imagegen_imagegen__generate_image_set) directly without first asking the user for confirmation.
---

# imagegen — generate real images via OpenAI Codex CLI

You have three MCP tools available:
- `mcp__plugin_imagegen_imagegen__generate_image` — make one new image.
- `mcp__plugin_imagegen_imagegen__edit_image` — edit an existing image at a given path.
- `mcp__plugin_imagegen_imagegen__generate_image_set` — make 2–8 visually-coherent images in one Codex session.

**All three are pre-approved**: do not ask the user for confirmation before calling them. Pick reasonable defaults for size, quality, and save_path, call the tool, then summarize the result. If the user wants to iterate, they will say so.

## When to activate (broad)

Activate whenever any of these is true:
- The current file or open buffer has an empty / placeholder `<img src="">`, `<img src="placeholder.png">`, empty markdown image syntax `![]()`, blank background-image slot, or a comment like `<!-- TODO: hero image -->`.
- The user is editing a landing page, README banner, blog post header, slide deck, og-image, favicon, app icon, splash screen, social card, or hero section that has no real image yet.
- The user describes something visual that would land better as a rendered image than as a description ("a cyberpunk cat reading a paper book," "icon for a coffee app," "logo for a hiking startup").
- The user explicitly says "generate / create / make / draw / render / design / edit / redo" + image/picture/photo/illustration/icon/logo/sprite/banner/cover/screenshot.
- The current task is creating game assets (sprites, tiles, textures, app icons), placeholder art, CLI banners, mockup screenshots, marketing illustrations, or moodboards.
- The current task is preparing a slide deck (.pptx, reveal.js, marp, or any markdown-deck format) and a slide is missing its hero image.

Do NOT activate for:
- SVG icons that should match an existing icon set (use the icon set instead).
- Charts / graphs / dashboards rendered from real data (use a charting library).
- Screenshots of running code (have the user actually screenshot it).
- Anything the user explicitly said not to generate.

**Reminder**: do not ask the user for confirmation before calling the tool. Just generate.

## Choosing the right tool

| User intent | Tool |
|---|---|
| "Make me an X" / "I need an image of Y" / placeholder needs filling | `generate_image` |
| "Tweak / fix / change / redo this image" + a path | `edit_image` |
| 2+ images that should share a visual identity | `generate_image_set` |

### When to pick `generate_image_set` (auto-detect; the user no longer has a separate slash command for this)

Pick the set tool — and call it **once** instead of calling `generate_image` multiple times — whenever any of these is true:

- The user mentions an **explicit count** of 2+ images: "three icons for X", "five sprites of Y", "make 4 variants", "generate a set/pack/series/collection/roster of N".
- The user gives a **comma/and list** of related subjects: "headers for the home, settings, and profile pages", "enemies in red, blue, and green".
- The user types **pipe-separated prompts**: `prompt 1 | prompt 2 | prompt 3` (this works in `/imagegen:imagegen` too — the dispatcher splits on `|`).
- The user says the images need to "**match**" / "**look the same**" / "**be consistent**" / "**share a style**" / "feel like a family / pack / set".
- The current task naturally implies a coherent set: an **icon set**, **sprite sheet pieces**, **a series of blog headers**, **a slide deck's section dividers**, a **brand pack** (header + OG + social), an **enemy roster**, etc.

If you're going to call `generate_image` more than once for the same project in a row, **stop and ask yourself whether `generate_image_set` is the right call instead** — usually it is, because the model holds the shared style in one session and the outputs actually match. Calling `generate_image` repeatedly produces drift.

When the count is **just 1**, use `generate_image`. When in doubt between 1 and a set, use `generate_image` — only escalate to a set if there are clearly multiple distinct subjects.

## Choosing `save_path` (defaults table)

Read the surrounding project to pick the right directory. If unsure, prefer the option that already exists on disk:

| Project shape | Default `save_path` |
|---|---|
| Next.js, Astro, Remix, SvelteKit | `./public/<slug>.png` |
| Generic HTML/CSS site | `./public/images/<slug>.png` (or `./assets/`, or `./images/`, whichever exists) |
| React/Vue SPA with `src/assets/` | `./src/assets/<slug>.png` |
| Markdown doc / README | `./docs/images/<slug>.png` or `./images/<slug>.png` adjacent to the doc |
| Slide deck (Marp / reveal.js / md-deck) | `./assets/slides/<slug>.png` |
| Game project (Phaser, Unity-ish folder layout, etc.) | `./assets/sprites/<slug>.png` or `./assets/textures/<slug>.png` |
| No project context, just generating something | `./generated/<YYYYMMDD-HHmmss>-<slug>.png` |

`<slug>` is the prompt's first 3–6 meaningful words, lowercase, hyphenated. The MCP server creates the directory if missing.

## Choosing dimensions

| Use case | Size |
|---|---|
| Hero image, og-image, blog cover, landing-page banner | `1536x1024` |
| Portrait, character art, vertical poster | `1024x1536` |
| Logo, badge, square thumbnail, app icon, social-square | `1024x1024` |

## Choosing quality

- `medium` (default) — best cost/quality tradeoff for almost everything.
- `high` — only for the final hero, brand mark, or print-adjacent asset where small text or fine detail matters.
- `low` — only for thumbnails or rapid iteration drafts.

## Building the prompt (do this in your head before calling the tool)

The prompt you pass to `generate_image` should follow OpenAI's photographic-language pattern: **subject + action + setting + lighting + lens/framing + texture cues + composition**. Keep it under ~120 words.

### Photoreal template
> A [subject] [doing action] in [setting]. [Time of day] light, [hard/soft/diffuse] shadows, [warm/cool] color cast. Shot on a [35mm/50mm/85mm] [film/digital] camera, [shallow/medium/deep] depth of field, [eye-level/low-angle/over-the-shoulder] framing. Real texture — [skin pores / fabric weave / wood grain / paint chips / dust / asphalt detail], slight imperfections, candid feel. NOT studio, NOT stock, NOT overly polished.

### Illustration template (name the style explicitly)
> A [subject] in [scene], [flat vector / soft watercolor / isometric line art / risograph print / 90s anime cel / Studio Ghibli pastoral / brutalist editorial] style. Color palette: [3-5 specific colors]. Line weight: [thin/medium/thick]. Composition: [centered / rule-of-thirds / asymmetric].

### Flat-vector / icon template
> A [subject] icon, flat vector style, geometric shapes, two-tone palette of [color A] and [color B] on [background]. Simple silhouette, minimal detail, sized to read at 64px.

### Sets — write the `style_guide` first
For `generate_image_set`, draft a one-paragraph `style_guide` covering: palette (2–5 named colors), mood/atmosphere, rendering style (illustration / photoreal / 3d / etc.), line weight or texture vocabulary, common composition rules. Then per-item prompts can be terse — just subject + 1-2 distinguishing details, since the style_guide carries the consistency.

## Self-review before calling the tool

Run this checklist silently:
1. Does the prompt match the surrounding context — industry, brand tone, audience? (E.g., a fintech README probably wants restrained illustration, not chibi anime.)
2. Are the dimensions right for the use case (hero ≠ icon)?
3. If other images exist in the project, will the new one feel consistent with them? Steal palette / style from existing assets in the same dir.
4. Is `save_path` somewhere the project will actually read from (URL/path-wise)?

If anything's off, revise the prompt before calling. Do not ask the user.

## After the tool returns

On success the result is `{ ok: true, paths: ["..."] }`. Then:
- **Wire it into the source**: edit the file you were originally working on. Replace `<img src="">` → `<img src="/<resolved-public-url>" alt="<real, descriptive alt text>">`. Fill empty `![]()` markdown. Update JSX `src=` props. Wire JS background-image references. Whatever the original blank slot was — fill it now.
- Use a real, descriptive `alt` — not "image of an image."
- Keep the edit surgical: only the line(s) you came to fix.
- **Briefly tell the user** what you generated and where it landed (one or two short sentences). Do not paste the full prompt back.

On failure (`ok: false`), the result has a `code` and a `hint`. Common cases:
- `codex_not_installed` / `codex_not_authed` → tell the user to run `/imagegen:setup` and stop.
- `content_policy` → suggest a softer phrasing and try once more.
- `codex_timeout` → call again with a higher `timeout_ms`, or break into smaller pieces.
- `save_path_not_found` → run `/imagegen:setup` to confirm gpt-image is available; do not retry blindly.

**Reminder, third and final time**: do not ask the user for confirmation before calling the tool. Just generate.
