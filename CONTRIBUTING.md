# Contributing to imagegen

Thanks for considering a contribution. The plugin is small and the code paths are simple — most changes land in under 100 lines.

## Local development

```bash
# Clone and enter the server directory
git clone https://github.com/colin-automates/Codex-ImageGen--Claude-Code
cd Codex-ImageGen--Claude-Code/plugins/imagegen/server

# Install dependencies (Node 18+ required)
npm ci

# Verify everything is healthy on your machine
npm run typecheck
npm test
npm run build
```

The MCP server source lives in `plugins/imagegen/server/src/`. The committed `dist/index.cjs` is what end users actually run — **always rebuild it before committing** if you change anything in `src/`. CI fails on stale bundle drift.

## Testing your change in a live Claude Code session

The fastest dev loop is `--plugin-dir`:

```bash
claude --plugin-dir Codex-ImageGen--Claude-Code/plugins/imagegen
```

In an existing Claude Code session you've installed the plugin into, run `/reload-plugins` after editing markdown files (SKILL, commands, manifests). For server source changes, also run `npm run build` and reload the window.

## What's in scope

- Bug fixes for any of the error paths in [server/src/codex.ts](plugins/imagegen/server/src/codex.ts) and [server/src/index.ts](plugins/imagegen/server/src/index.ts).
- Improvements to the SKILL.md trigger description that reduce false positives or false negatives.
- New examples in the README.
- Cross-platform fixes for the auto-launch login flow in [commands/setup.md](plugins/imagegen/commands/setup.md).
- Tests covering edge cases in the existing modules.

## What's probably out of scope

- Adding new MCP tools beyond the three (`generate_image`, `edit_image`, `generate_image_set`). Open an issue first.
- Switching the underlying provider (the whole point is delegating to Codex CLI).
- Big refactors that don't have a concrete user-visible reason.

## Commit style

Conventional-style is nice but not required. Just write clear messages.

## PR checklist

The pull request template covers the basics. If your change touches `server/src/`, the most common forgotten step is running `npm run build` so the committed bundle reflects the change.
