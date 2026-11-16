# Freelens, performance fork

<picture>
  <img alt="Freelens logo" src="docs/images/logo.svg" width="110" align="left">
</picture>

A desktop application for Kubernetes clusters, for macOS, Windows and Linux.
It is a fork of [Freelens](https://github.com/freelensapp/freelens) 2.0.0,
which is itself the continuation of Open Lens. It is **not made, reviewed or
supported by the Freelens team**: report problems with this build here, not
upstream.

The fork is about two things: staying fast and light on large clusters, and a
set of features that upstream does not have. It keeps upstream's extension
API, so extensions written for Freelens 2.0 run unchanged.

<br clear="left">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/macos-pods-dark.jpg">
  <source media="(prefers-color-scheme: light)" srcset="docs/images/macos-pods-light.jpg">
  <img alt="Screenshot" src="docs/images/macos-pods-light.jpg">
</picture>

## How it differs from Freelens

The [release notes](https://github.com/SamuelDoud/freelens/releases) measure
each release against upstream on the same machine and clusters, losses
included.

### Performance

- **Lists load progressively and stay loaded.** A list streams in pages while
  its watch is already running, and going back to a list you have seen does
  not load it again.
- **Fewer requests to the cluster.** Permissions and API discovery are checked
  once per connection and cached on disk between runs, a cluster or a chart
  that is not on screen stops polling, and metric charts ask only for the
  points they do not have yet.
- **Less work in the window.** Sorting, filtering, searching and watch updates
  do work in proportion to what changed, not to the size of the list, and
  components render once per change instead of twice.
- **Less memory.** Kubernetes objects are lighter, events are capped per object
  and overall, and a cluster left hidden for a while unloads its view and
  restores it when you come back (Preferences → App).
- **A faster start.** The editor, the Kubernetes client and other large
  libraries load when first used, and the interface's scripts are cached
  between launches.
- **Helm releases come from the cluster,** read from the release Secrets the
  window already watches, instead of running `helm ls` on every refresh.

### Features

- **AI chat** in a dock tab, a side panel or its own window. It drives Claude
  Code, Codex or Muse as installed on your computer, or any OpenAI-compatible
  server, also on another host over SSH. It answers with Freelens's own tools
  (lists, logs, events, metrics) and changes nothing unless you tick "Allow
  changes" and approve each change.
- **Details under the row.** A row opens its details in place, several at a
  time, while the list holds its order. The side drawer is one click away, or
  the default again in Preferences → App.
- **Advanced search** by any column, with conditions as chips (age,
  quantities, restarts, the kind of controller, …), and saved searches.
- **Multiviews:** several clusters side by side in one window.
- **Back and forward** through what you looked at, including inside a page.
- **Definitions:** hold Option (macOS) or Alt and hover a menu item, a tab or
  a list title to see what that kind of resource is.
- **More kinds of resources,** including the newer workload, network, storage,
  access-control and device APIs, when the cluster serves them.
- **Pod charts as lines,** with the requests and limits drawn in, and the
  minimum, median, 90th percentile and maximum of each series; columns and
  search for requests and limits.
- **Appearance:** themes, window and menu transparency, the interface font,
  and per-cluster icon colours.

### Compatibility

- **Extensions:** the extension API is upstream's, so extensions for
  Freelens 2.0 work as they are.
- **Settings:** the fork installs as "Freelens" with the same application id
  and settings folder as upstream. Installing it replaces an upstream
  installation, and the two share clusters, preferences and extensions.
  Upstream ignores the settings the fork adds; back up the settings folder
  before switching between the two.

## Requirements

Kubernetes 1.22 or later. Older clusters fall back to the bundled `kubectl`,
which may not work correctly; a different one can be set in Preferences.

## Downloads

Download from the
[releases](https://github.com/SamuelDoud/freelens/releases) page. The
packages of upstream Freelens (Homebrew, WinGet, Scoop, Flathub, Snap, APT,
AUR) install upstream, not this fork.

### macOS

Apple silicon (arm64), as a DMG or a ZIP, for macOS 13 or later.

The application is signed ad hoc, not with an Apple Developer ID, so macOS
refuses to open it the first time. Open it with right-click → Open, or remove
the quarantine flag after copying it to Applications:

```sh
xattr -dr com.apple.quarantine /Applications/Freelens.app
```

### Linux

An AppImage for x86_64, for Linux with GNU C Library 2.34 or later (Debian 12,
Fedora 35, Ubuntu 22.04 and later, or a rolling release distribution).

The AppImage needs libfuse 2 and zlib:

```sh
sudo apt install libfuse2 zlib1g-dev
```

Run it with:

```sh
./Freelens*.AppImage --no-sandbox --ozone-platform-hint=auto --enable-features=WebRTCPipeWireCapturer --enable-features=WaylandWindowDecorations --disable-gpu-compositing
```

#### Secret store

Extensions keep tokens and passwords encrypted with the desktop's secret
store: GNOME Keyring or another Secret Service provider through libsecret, or
KWallet. The application finds it on its own on GNOME, KDE, Cinnamon, XFCE
and other common desktops. On a desktop it does not recognise, such as sway,
Hyprland or i3, the extensions cannot keep such values, so name the secret
store when you start the application:

```sh
./Freelens*.AppImage --password-store=gnome-libsecret
```

Use `gnome-libsecret` for any Secret Service provider, such as GNOME Keyring
or KeePassXC, and `kwallet5` or `kwallet6` for KWallet. The provider must be
running in the session.

### Windows

x64, for Windows 10 or later: an installer (`Freelens-Setup-*.exe`) or a
portable executable that runs without installing (`Freelens-*-portable.exe`).

The executables are not code-signed, so SmartScreen warns the first time:
choose "More info", then "Run anyway".

#### WSL

The terminal can run a WSL shell: set the shell to `wsl.exe` in the terminal
preferences. The `kubectl` and `helm` commands of the WSL distribution then
use the cluster opened in Freelens.

WSL 2 requires the mirrored networking mode. Add it to the
`%UserProfile%\.wslconfig` file:

```ini
[wsl2]
networkingMode=mirrored
```

Then restart WSL with `wsl --shutdown`.

## Development

[DEVELOPMENT.md](DEVELOPMENT.md) describes how to build the application from
source, and [AGENTS.md](AGENTS.md) the architecture and the rules of the code
base.

## Extensions

Extensions are written against the extension API of Freelens 2.0, documented
in [`docs/extensions`](docs/extensions). Upstream's
[extensions discussion](https://github.com/freelensapp/freelens/discussions/2291)
lists the published ones.

The skills for coding agents that create Freelens extensions and port v1
extensions to the v2 extension API are the `freelens` plugin of
[Claude Code](https://code.claude.com/docs/en/plugins), whose `SKILL.md` files
in [`plugins/freelens/skills`](plugins/freelens/skills) other agents read too.
Add the marketplace with `--sparse`, which checks out only the plugin instead
of the whole Freelens repository, then install the plugin from it:

```sh
claude plugin marketplace add freelensapp/freelens --sparse .claude-plugin plugins
claude plugin install freelens@freelens
```

`/freelens:create-extension` starts a new extension from a copy of
[freelens-example-extension](https://github.com/freelensapp/freelens-example-extension),
and `/freelens:port-extension-to-v2` ports an extension written for the v1
extension API.

## Upstream

[Freelens](https://freelens.app) is developed by the Freelens team and its
community: the [repository](https://github.com/freelensapp/freelens), the
[discussions](https://github.com/freelensapp/freelens/discussions) and
[Discord](https://discord.gg/NjKZERK95Y). This fork depends on their work;
support them if you use it.

## License

This repository is a fork of [Freelens](https://github.com/freelensapp/freelens),
itself a fork of [Open Lens](https://github.com/lensapp/lens/tree/master), the
core of [Lens Desktop](https://k8slens.dev), with the aim of carrying forward
its open-source version.

Copyright (c) 2024-2026 Freelens Authors.

Copyright (c) 2022 OpenLens Authors.

[MIT License](https://opensource.org/licenses/MIT)
