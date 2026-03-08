![Gatepost Banner](Image.png)

# Darkfall

Supply chain security for every package manager. Scans installs for malware, typosquats, vulnerabilities, and suspiciously new packages — before they touch your machine.

| Check | What it catches |
|---|---|
| **Blocklist** | Known malicious packages by name |
| **Typosquat detection** | Lookalikes of popular packages (e.g. `lodahs` → `lodash`) |
| **CVE scanning** | Live vulnerability lookup via [OSV.dev](https://osv.dev) |
| **Age detection** | Packages published less than 24 hours ago |

If a package is flagged, the install is blocked. If it's clean, Darkfall steps aside — zero friction.

Works in CI/CD pipelines. Supports silent and verbose logging modes.

---

## Supported package managers

| Ecosystem | Managers |
|---|---|
| **Node / JS** | `npm`, `npx`, `yarn`, `pnpm`, `pnpx`, `bun`, `bunx` |
| **Python** | `pip`, `pip3`, `uv`, `poetry`, `pipx`, `python -m pip` |
| **Ruby** | `gem` |
| **Rust** | `cargo` |
| **PHP** | `composer` |
| **Elixir** | `mix` |
| **Dart / Flutter** | `pub` |

---

## Installation

### npm (recommended)

```sh
npm install -g @getbastionai/gatepost
```

### curl

```sh
curl -fsSL https://raw.githubusercontent.com/GetDarkfall/Gatepost/master/install.sh | sh
```

### From source

```sh
git clone https://github.com/GetDarkfall/Gatepost.git
cd Gatepost
npm install -g .
```

Shell aliases are set up automatically. Restart your terminal and every package manager command is protected.

### CI/CD

For CI pipelines (GitHub Actions, GitLab, CircleCI, Jenkins, Azure, Bitbucket):

```sh
npm install -g @getbastionai/gatepost
darkfall setup --ci
export PATH="$HOME/.darkfall/bin:$PATH"
```

This creates lightweight shims in `~/.darkfall/bin` instead of shell aliases — works in any CI environment.

---

## Usage

Use your package managers exactly as you normally would:

```sh
npm install lodash
pip install requests
python -m pip install flask
cargo add serde
gem install rails
```

Darkfall runs silently when everything is clean. Output only appears when something is flagged.

### Logging modes

```sh
darkfall --silent npm install lodash    # Only show blocked installs
darkfall --verbose npm install lodash   # Show detailed diagnostic output
```

Or set the default in `~/.darkfallrc`:

```json
{ "logLevel": "silent" }
```

### Blocked install

```
darkfall: install blocked

  blocked  event-stream  Known malicious package
```

The install exits with code 1. Nothing was installed.

### Warning (install proceeds)

```
darkfall: warning

  warn  lodahs  Possible typosquat of "lodash"
```

Warnings are shown but the install is not blocked.

---

## Manual check

Scan packages without installing them:

```sh
darkfall check express axios lodash
```

```
  ok       express
  ok       axios
  ok       lodash

All packages look clean.
```

---

## Configuration

Create a config file to customize behavior:

```sh
darkfall init
```

This creates `~/.darkfallrc` where you can:

- Toggle individual checks on/off
- Change the age threshold (default: 1 day)
- Switch actions between `warn` and `block`
- Add custom blocklist entries
- Allowlist specific packages
- Control fail-open/fail-closed behavior

```json
{
  "checks": {
    "blocklist": true,
    "typosquat": true,
    "vulnerability": true,
    "age": true
  },
  "age": {
    "minimumDays": 1,
    "action": "warn"
  },
  "blocklist": {
    "action": "block",
    "custom": ["some-internal-package"]
  },
  "allowlist": ["my-trusted-package"],
  "failOpen": true,
  "logLevel": "normal"
}
```

---

## Commands

| Command | Description |
|---|---|
| `darkfall setup` | Add shell aliases (run once after install) |
| `darkfall setup --ci` | Install PATH shims for CI/CD pipelines |
| `darkfall remove` | Remove shell aliases and CI shims |
| `darkfall init` | Create a `.darkfallrc` config file |
| `darkfall check <pkg...>` | Scan packages without installing |
| `darkfall <manager> [args]` | Run any manager with protection |

| Flag | Effect |
|---|---|
| `--silent` | Only show blocked installs |
| `--verbose` | Show detailed diagnostic output |

---

## How it works

1. Shell aliases redirect `npm install foo` → `darkfall npm install foo`
2. Darkfall extracts package names from the command arguments
3. Four checks run in parallel: blocklist, typosquat, OSV vulnerability, package age
4. Blocked packages exit with code 1 — nothing installs
5. Warnings print to stderr but allow the install to continue
6. Clean packages pass straight through to the real package manager

If network checks fail, Darkfall warns and proceeds by default — it never blocks a legitimate workflow unless you configure it to.

---

## Uninstall

```sh
darkfall remove
npm uninstall -g @getbastionai/gatepost
```

---

## Requirements

- Node.js 16+

---

## License

MIT
