# dsh-plugins

A collection of plugins for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

Each plugin lives in its own directory under `plugins/<name>/` with its own
package manifest, bundle patch, and README (install, configuration, and note
format where applicable).

## Plugins

| Plugin | What it does |
| --- | --- |
| [`dsh-memory-notes`](plugins/dsh-memory-notes/README.md) | Persistent cross-session memory: injects `~/.dsh/memory/*.md` notes into every session's system prompt and adds a `remember` tool that maintains them host-side, outside the agent's file sandbox. |

## Installing a plugin

From its README, in short: install the package into a profile
(`dsh plugin --profile <name> add <package>`), add the bundle row to the
profile's `dsh.profile.bundles`, and restart the profile. Development install
(live symlink, no pnpm) is also covered per plugin.

## Layout

```
dsh-plugins/
├── README.md
└── plugins/
    └── dsh-memory-notes/
        ├── index.js            # the Cordis plugin (ESM, single file)
        ├── cordis.patch.yml    # bundle patch row
        ├── package.json        # name + dsh.bundle.patch + peers
        ├── README.md           # install + config + format docs
        └── LICENSE
```

## License

Each plugin is MIT unless its directory says otherwise.
