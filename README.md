# imagegen — Claude Code plugin

Generate, edit, and batch-create images from inside Claude Code by delegating to OpenAI's **Codex CLI** (built-in `gpt-image`). Billed against your **ChatGPT subscription** — no API key, no per-image dollar charges.

Auto-activates when the current task could benefit from a real image (empty `<img>`, README banner, OG image, slide deck hero, app icon set, etc.). Or invoke explicitly via slash commands.

```
/imagegen "sunset over mountains, photorealistic"
/imagegen "three coffee app icons: a bean, a steaming mug, a manual grinder"
/imagegen:edit ./public/hero.png make it more dramatic, add lightning
/imagegen setup
```

## Quick start

Open a terminal once:

```powershell
npm install -g @openai/codex
codex login   # opens a browser for ChatGPT OAuth (one time)
```

Then in any Claude Code workspace:

```
/plugin marketplace add github.com/colin-automates/Codex-ImageGen--Claude-Code
/plugin install imagegen@imagegen-marketplace
/imagegen:setup
```

The setup probe verifies the full pipeline and produces a tiny test image. Once it reports green, you're done.

## Requirements

- **Node.js 18+** on the machine running Claude Code (the MCP server is a Node CJS bundle).
- **OpenAI Codex CLI** (`@openai/codex`) installed and logged in via `codex login`.
- An active **ChatGPT** subscription that includes Codex usage. As of writing: Plus, Pro, Business, Edu, Enterprise. (Free tier may also be eligible during current OpenAI promos — verify in your account.)

## Usage

### Auto-activation

Just describe what you want. The skill picks dimensions, quality, save path, and prompt expansion silently, then wires the result into the file you were editing (rewrites the empty `<img src>`, fills the empty markdown image, etc.).

Examples that should auto-fire:
- *"Make this landing page nicer"* — file has an empty `<img src="">`.
- *"Add a hero image to the README"* — README has no banner.
- *"I need a flat-vector logo for a coffee app"* — pure description.
- *"Generate enemy sprites: red, blue, green"* — auto-routes to set mode for visual coherence.

### Slash commands

| Command | What it does |
|---|---|
| `/imagegen "<prompt>"` | Generate one image, or a coherent set if the prompt describes multiple. |
| `/imagegen setup` | One-time setup probe — verifies Codex, auto-launches browser sign-in if needed. Same as `/imagegen:setup`. |
| `/imagegen:edit <path> <prompt>` | Edit an existing image with a natural-language instruction. |
| `/imagegen:img <prompt>` | Alias of `/imagegen`. |

There is no separate `:set` slash command — `/imagegen` auto-detects multi-image intent (an explicit count, a comma/and list, pipe-separated prompts, or set-keywords) and routes to the set tool.

### Examples

```
/imagegen "a small flat-vector logo for a hiking startup, two-tone palette, mountain silhouette"
/imagegen "headers for four blog posts about hiking, climbing, kayaking, biking"
/imagegen:edit ./public/hero.png "make the sky look stormy"
```

## How it works

```
You type a prompt
    ↓
Claude Code (this app)
    ↓ calls MCP tool
imagegen MCP server (Node bundle in this repo)
    ↓ spawns `codex exec ...`
Codex CLI (uses your local auth at ~/.codex/auth.json)
    ↓ calls
OpenAI's gpt-image backend
    ↓ usage billed against...
Your ChatGPT subscription   ← (NOT your OpenAI API account)
```

The plugin's MCP server (TypeScript, in [plugins/imagegen/server/](plugins/imagegen/server/), bundled with esbuild to `dist/index.cjs`) shells out to:

```
codex exec --skip-git-repo-check --sandbox danger-full-access \
  --cd <workspace> --add-dir <save-dir> --output-last-message <tmp> \
  "@imagegen <your prompt>. Save to <abs save_path>. ..."
```

Codex generates the image with its built-in `gpt-image` tool, saves it to the requested path, and prints `SAVED <path>` in its final message. The MCP server parses that, falls back to scanning the parent dir for newly-created image files if needed, and returns the path to Claude.

Because everything goes through Codex (not the OpenAI API directly), image generation is **billed against your ChatGPT plan limits, not your API key**. Confirm `$0` after running tests by checking [platform.openai.com/usage](https://platform.openai.com/usage).

## Caveats

- Image generation **burns Codex usage limits ~3-5× faster than text turns**. A single high-quality image counts as significantly more usage than a normal Codex agent turn.
- Uses the Codex CLI under the hood — **NOT** the OpenAI API directly. No API key, no per-image dollar charges.
- The `@imagegen` skill / built-in gpt-image tool needs to be available in your Codex install. `/imagegen:setup` verifies this with a probe.

## Troubleshooting

### `Unknown command: /imagegen`

Plugin slash commands are always namespaced. Use the colon form:

```
/imagegen:setup
/imagegen:imagegen "<prompt>"
/imagegen:edit ./path "<edit instructions>"
```

### Claude pops a permission prompt before every tool call

The plugin ships a `settings.json` that pre-approves its three MCP tools. If your Claude Code version doesn't honor plugin-shipped settings, do **one** of:

1. Run `/permissions add mcp__plugin_imagegen_imagegen__*` once.
2. Copy these entries into `~/.claude/settings.local.json` (or your workspace's `.claude/settings.local.json`):
   ```json
   {
     "permissions": {
       "allow": [
         "mcp__plugin_imagegen_imagegen__generate_image",
         "mcp__plugin_imagegen_imagegen__edit_image",
         "mcp__plugin_imagegen_imagegen__generate_image_set"
       ]
     }
   }
   ```

### `/imagegen:setup` reports `codex_not_installed`

Run, in a regular terminal (not inside Claude Code):
```
npm install -g @openai/codex
```
On macOS/Linux you may need `sudo npm install -g …`.

### `/imagegen:setup` reports `codex_not_authed`

`/imagegen:setup` automatically opens a browser sign-in window for you and waits up to 3 minutes for OAuth to complete — you don't need to leave Claude Code. Just complete the ChatGPT login in the browser tab that pops up; setup continues automatically.

If the auto-launch doesn't work for some reason (rare), fall back to running this in any regular terminal and re-running `/imagegen:setup`:
```
codex login
```

### Transient OpenAI errors during generation

If you see `Reconnecting...` or `stream disconnected before completion` in the error output, OpenAI's gpt-image backend is having a transient issue (most common during peak hours). Wait 5–15 minutes and retry. Check [status.openai.com](https://status.openai.com) for ongoing incidents.

### `save_path_not_found` errors

The most likely cause: the `@imagegen` / gpt-image built-in tool isn't activated in your Codex install. Try:
- `codex --version` should be a recent build.
- Run `/imagegen:setup` and read the report.

### `/plugin marketplace add` does nothing

If your repo path contains `;`, spaces, or other special characters, the slash-command parser may truncate it. Workaround: `cd` into the directory in your terminal, open Claude Code there, then run `/plugin marketplace add .` (just a dot).

For private GitHub repos, make sure your machine has the credentials (HTTPS token or SSH key) cached so `git clone <repo>` would succeed.

### Node version too old

The MCP server requires Node 18+. Check `node --version`. If too old, upgrade Node (e.g., via nvm, fnm, or your OS package manager).

## Development

The MCP server source is in `plugins/imagegen/server/src/`. To rebuild the bundle:

```
cd plugins/imagegen/server
npm ci
npm test
npm run typecheck
npm run build
```

Output: `plugins/imagegen/server/dist/index.cjs` (committed to the repo so end users don't need a build step).

Source files:
- `index.ts` — MCP boot, three tool handlers, validation
- `schemas.ts` — zod schemas + JSON Schema for MCP tool definitions
- `codex.ts` — `codex exec` spawn, output capture, last-message parsing
- `prompts.ts` — three prompt templates (generate, edit, set)
- `poller.ts` — file-stable detection, mtime-scan fallback, rename-to-target
- `errors.ts` — error envelope + categorization

Tests live in `plugins/imagegen/server/test/`. Run with `npm test`. CI re-runs them plus `git diff --exit-code dist/` to catch stale bundle commits.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution flow.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built on [OpenAI Codex CLI](https://developers.openai.com/codex/cli) and the [Model Context Protocol SDK](https://modelcontextprotocol.io/).
