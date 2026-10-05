# dsh-plugins

A collection of plugins for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

Each plugin lives in its own directory under `plugins/<name>/` with its own
package manifest, bundle patch, and README (install, configuration, and note
format where applicable).

## Plugins

| Plugin | What it does |
| --- | --- |
| [`dsh-memory-notes`](plugins/dsh-memory-notes/README.md) | Persistent cross-session memory: injects `~/.dsh/memory/*.md` notes into every session's system prompt and adds a `remember` tool that maintains them host-side, outside the agent's file sandbox. |
| [`dsh-model-override`](plugins/dsh-model-override/README.md) | Override the default model via `DSH_MODEL` env var (format: `provider/model[@effort]`). Switch models per invocation without touching `settings.yaml`. |

## Installing a plugin

From its README, in short: `dsh plugin --profile <name> add <package>` installs
the package and validates its DSH peer ranges up front — that command forwards
to **pnpm**, so pnpm must be on `PATH`, and npm works as a fallback for profiles
without it. Then add the bundle row to the profile's `dsh.profile.bundles` and
restart the profile, or let an HMR-enabled profile recompose. Each plugin README
also covers installing the checkout itself for development.

An incompatible plugin is refused by the installer, but a profile can also
*skip* a bundle whose declared `@deepseek-ai/dsh-*` peer ranges do not cover the
running DSH — startup prints `skipping profile bundle "<package>"` and the
plugin silently does nothing. Install a compatible plugin version rather than
granting a version exemption.

## Layout

```
dsh-plugins/
├── README.md
└── plugins/
    ├── dsh-memory-notes/
    │   ├── index.js            # the Cordis plugin (ESM, single file)
    │   ├── cordis.patch.yml    # bundle patch row
    │   ├── package.json        # name + dsh.bundle.patch + peers
    │   ├── README.md           # install + config + format docs
    │   └── LICENSE
    └── dsh-model-override/
        ├── index.js            # the Cordis plugin (ESM, single file)
        ├── cordis.patch.yml    # bundle patch row
        ├── package.json        # name + dsh.bundle.patch
        ├── README.md           # install + usage docs
        └── LICENSE
```

## License

Each plugin is MIT unless its directory says otherwise.
