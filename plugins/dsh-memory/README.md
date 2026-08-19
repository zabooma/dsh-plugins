# dsh-memory

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

Requires pnpm (the `dsh plugin` command forwards to it):

```sh
dsh plugin --profile web add dsh-memory      # or: --profile headless, --profile <name>
```

Then add the bundle row to the profile manifest
`$DSH_HOME/profiles/<name>/package.json`:

```json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "dsh-memory"
    ]
  }
}
```

Restart the profile for the new bundle to load, then verify:

```sh
dsh --profile web --dump-config | grep -A 8 memory
```

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

Local install without pnpm: symlink the checkout into the shared profile
node_modules, then add `dsh-memory` to the profile's bundle list.

```sh
ln -s "$(pwd)" "$DSH_HOME/profiles/node_modules/dsh-memory"
```

The plugin is a single ESM file (`index.js`), a Cordis plugin exporting
`{ name, Config, apply }`, wired through `cordis.patch.yml` as a bundle patch
row. `apply` registers one system-prompt section, one system-prompt context,
and one tool — following the same seams the shipped DSH packages use
(`systemPrompt.section` / `systemPrompt.context` / `tools.register` +
`defineTool`).

## License

MIT
