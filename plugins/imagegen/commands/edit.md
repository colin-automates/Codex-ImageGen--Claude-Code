---
description: Edit an existing image at a given path with a natural-language instruction. Routes through Codex CLI's gpt-image edit tool.
argument-hint: <path-to-image> <edit instructions>
---

The user invoked `/imagegen:edit`. Arguments:

```
$ARGUMENTS
```

Parse `$ARGUMENTS`:
- The first whitespace-separated token is `source_path`. Strip surrounding quotes if present.
- Everything after is the edit `prompt`.

Do this **without asking for confirmation**:

1. If `source_path` doesn't exist on disk, tell the user that and stop.
2. Compute `save_path`: same directory and basename as `source_path`, with `-edited-<HHmmss>` inserted before the extension. Example: `hero.png` → `hero-edited-143012.png`.
3. Call `mcp__plugin_imagegen_imagegen__edit_image` with:
   - `source_path`: the parsed path (resolved absolute).
   - `prompt`: the edit instructions, optionally expanded with style/preservation cues from the SKILL ("preserve the overall composition", "keep the background", etc.) if the user's instruction is terse.
   - `save_path`: as computed.
   - `size`: match the source's aspect ratio if possible — otherwise `auto`.
   - `quality`: `medium` by default; `high` if the user said "high quality" or "final".
4. On success, briefly tell the user where the edited file landed.
5. On failure, surface the `hint` field plus a one-sentence next step.

If the user wanted to overwrite the original instead of saving alongside, they will explicitly say so — only then set `save_path = source_path`.
