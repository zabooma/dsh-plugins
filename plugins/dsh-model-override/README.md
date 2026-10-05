# dsh-model-override

Override the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) default model via an environment variable — no `settings.yaml` edits required.

## Problem

DSH has no `--model` CLI flag. Model selection lives in `~/.dsh/settings.yaml` under `agent-default-model:`, which is a global user-settings layer that overrides per-profile composition config. The web UI model picker writes back to this same global key. Result: you can't have different models per profile without settings file gymnastics.

## Solution

This Cordis plugin reads `DSH_MODEL` env var and overrides `ctx.agentDefaultModel.currentSelection()` at agent creation time. When the env var is absent, the plugin is a silent no-op.

## Install

DSH's installer forwards to pnpm, so pnpm must be on `PATH`:

```sh
dsh plugin --profile headless add dsh-model-override
```

Without pnpm it stops with `dsh: pnpm was not found; install pnpm and make it
available on PATH.` Where pnpm exists, prefer this route: DSH validates the
package's DSH peer ranges *before* installing. With npm instead:

```sh
cd "$DSH_HOME/profiles/headless"
npm i dsh-model-override
```

Then add the bundle to the profile manifest `$DSH_HOME/profiles/<name>/package.json`:

```json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-headless",
      "dsh-model-override"
    ]
  }
}
```

Restart the profile for the new bundle to load (an HMR-enabled profile
recomposes instead). If startup prints `skipping profile bundle
"dsh-model-override"`, the installed version's DSH peer ranges do not cover your
runtime.

`npm` run from inside a DSH session can fail with `EPERM ... ~/.npm/_cacache`
because the npm cache sits outside the session's file sandbox; add
`--cache /tmp/npm-cache-dsh` when it does.

## Usage

```sh
# Switch model
DSH_MODEL=openrouter/stealth/ox-alpha dsh --profile headless "run the tests"

# Model with colon in the name (openrouter tier suffix)
DSH_MODEL=openrouter/poolside/laguna-s-2.1:free dsh --profile headless "do something"

# With reasoning effort (separated by @) — not all models support this
DSH_MODEL=openrouter/poolside/laguna-s-2.1:free@low dsh --profile headless "explain this code"
```

## Format

```
DSH_MODEL=provider/model[@effort]
```

- **provider** — the registered provider route (e.g. `openrouter`)
- **model** — the provider-owned model id (may contain slashes and colons)
- **effort** — optional, after `@`. Passed through to the adapter as-is; effort names are adapter-specific (DeepSeek uses `off`/`low`/`high`/`max`, other adapters may differ or not support effort at all).

We use `@` as the effort separator because some model ids contain `:` (e.g. `poolside/laguna-s-2.1:free`) and `#` is a shell comment.

When no effort is specified, the adapter picks its own default for the model — the default model's effort is NOT carried over.

## How it works

The plugin monkey-patches `ctx.agentDefaultModel.currentSelection()` to return the env var's provider, model, and optional reasoning effort instead of the composition/settings default. The headless runner (and any other entry point that reads this service) picks up the override transparently.

## Edge cases

| DSH_MODEL value | provider | model | effort |
|---|---|---|---|
| Not set | — no-op — | | |
| `openrouter/stealth/ox-alpha` | openrouter | stealth/ox-alpha | (adapter default) |
| `openrouter/poolside/laguna-s-2.1:free` | openrouter | poolside/laguna-s-2.1:free | (adapter default) |
| `openrouter/poolside/laguna-s-2.1:free@low` | openrouter | poolside/laguna-s-2.1:free | low |
| `foo` (no slash) | error logged, no-op | | |

## Development

To run the checkout instead of a published version, install the directory
itself. npm records a `file:` dependency and symlinks it, so edits here are
live in the profile:

```sh
cd "$DSH_HOME/profiles/headless"
npm i file:/path/to/dsh-plugins/plugins/dsh-model-override
```

The pnpm equivalent is
`dsh plugin --profile headless add /path/to/dsh-plugins/plugins/dsh-model-override`;
DSH reads an absolute path's `package.json` before installing it. Either way the
profile's `package.json` records the link, so a later plain `install` does not
drop it.

## License

MIT
