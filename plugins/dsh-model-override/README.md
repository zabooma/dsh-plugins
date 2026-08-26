# dsh-model-override

Override the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) default model via an environment variable — no `settings.yaml` edits required.

## Problem

DSH has no `--model` CLI flag. Model selection lives in `~/.dsh/settings.yaml` under `agent-default-model:`, which is a global user-settings layer that overrides per-profile composition config. The web UI model picker writes back to this same global key. Result: you can't have different models per profile without settings file gymnastics.

## Solution

This Cordis plugin reads `DSH_MODEL` env var and overrides `ctx.agentDefaultModel.currentSelection()` at agent creation time. When the env var is absent, the plugin is a silent no-op.

## Install

```sh
dsh plugin --profile headless add dsh-model-override
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

Restart the profile for the new bundle to load.

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

Local install without pnpm: symlink the checkout into the shared profile node_modules, then add `dsh-model-override` to the profile's bundle list.

```sh
ln -s "$(pwd)" "$DSH_HOME/profiles/node_modules/dsh-model-override"
```

## License

MIT
