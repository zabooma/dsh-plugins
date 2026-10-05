# dsh-memory-notes

Persistent cross-session memory for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) agents.

Agent conversations die with the session. This plugin gives an agent durable
notes that survive it:

- **Auto-injection** — the contents of a notes directory (default
  `$DSH_HOME/memory/*.md`) are rendered into every session's system prompt as a
  `memory:notes` context block. The agent sees its past decisions without
  having to remember to look for them.
- **A `remember` tool** — the agent lists, reads, adds and updates notes
  through a real tool. Writes happen in the harness process, outside the
  agent's per-session file sandbox, so memory works in every sandbox mode
  (`read-only` sessions can still *read* injected notes; `workspace-write` and
  `danger-full-access` sessions can also write).
- **Human-editable** — notes are plain markdown files with a three-line
  frontmatter block (`topic` / `updated` / `status`). You can add or correct a
  note with any text editor.

## Install

DSH's installer forwards to pnpm, so pnpm must be on `PATH`:

```sh
dsh plugin --profile web add dsh-memory-notes      # or: --profile headless, --profile <name>
```

Without pnpm it stops with `dsh: pnpm was not found; install pnpm and make it
available on PATH.` Where pnpm exists, prefer this route: DSH validates the
package's DSH peer ranges *before* installing, so a runtime the plugin does not
support refuses the install instead of skipping the bundle later.

Then add the bundle row to the profile manifest
`$DSH_HOME/profiles/<name>/package.json`:

```json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "dsh-memory-notes"
    ]
  }
}
```

### Without pnpm

A profile directory is a plain package project, so npm works as well:

```sh
cd "$DSH_HOME/profiles/web"
npm i dsh-memory-notes
```

npm does not run DSH's install-time peer check, so an incompatible
`@deepseek-ai/dsh-*` peer range is reported only when the profile starts.

Restart the profile for the new bundle to load (an HMR-enabled profile
recomposes instead), then verify:

```sh
dsh --profile web --dump-config | grep -A 8 memory
```

If that prints `dsh: skipping profile bundle "dsh-memory-notes"`, the installed
version's peer ranges do not cover your DSH runtime — install a compatible
version rather than granting a version exemption, which leaves the stale range
in place and switches the check off for that pair.

`npm` run from inside a DSH session can fail with `EPERM ... ~/.npm/_cacache`
because the npm cache sits outside the session's file sandbox; add
`--cache /tmp/npm-cache-dsh` when it does.

## Configuration

Patch the `memory` row in `$DSH_HOME/cordis.patch.yml` (last write wins):

```yaml
- replace:
    - id: memory
      config:
        memoryDir: ''      # '' = $DSH_HOME/memory
        maxBytes: 16384    # byte budget for the injected context block
        maxFiles: 24       # max note files injected
```

## Note format

```markdown
---
topic: delegation-heuristics
updated: 2026-08-19
status: active
---

# Delegation heuristics

- Delegate when fresh context buys context economy or epistemic independence.
```

`status` values: `active` (default), `superseded` (kept for the record, prefer
its replacement), `pending`. The `remember` tool maintains the frontmatter for
you; the agent is instructed to revise existing notes instead of duplicating
them.

## Development

To run the checkout instead of a published version, install the directory
itself. npm records a `file:` dependency and symlinks it, so edits here are
live in the profile:

```sh
cd "$DSH_HOME/profiles/web"
npm i file:/path/to/dsh-plugins/plugins/dsh-memory-notes
```

The pnpm equivalent is
`dsh plugin --profile web add /path/to/dsh-plugins/plugins/dsh-memory-notes`;
DSH reads an absolute path's `package.json` before installing it. Either way the
profile's `package.json` records the link, so a later plain `install` does not
drop it.

The plugin is a single ESM file (`index.js`), a Cordis plugin exporting
`{ name, Config, apply }`, wired through `cordis.patch.yml` as a bundle patch
row. `apply` registers one system-prompt section, one system-prompt context,
and one tool — following the same seams the shipped DSH packages use
(`systemPrompt.section` / `systemPrompt.context` / `tools.register` +
`defineTool`).

## License

MIT
