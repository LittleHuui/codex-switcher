# Third-party notices

`cdx.mjs` keeps its runtime dependencies external. They are declared in the
published `package.json` and installed by the package manager rather than being
copied into this project's bundle.

The direct runtime dependencies and their declared SPDX licenses at the time of
this release are:

| Package | Version range | License |
| --- | --- | --- |
| `@bjesuiter/cross-keychain` | `1.1.0-jb.0` | MIT |
| `@bomb.sh/tab` | `^0.0.14` | MIT |
| `@clack/prompts` | `^1.1.0` | MIT |
| `age-encryption` | `^0.3.0` | BSD-3-Clause |
| `commander` | `^14.0.3` | MIT |

Each dependency remains subject to its own license. Before changing or adding
dependencies, maintainers must review the exact version's package metadata and
license text, and update this file when the set of distributed dependencies
changes.
