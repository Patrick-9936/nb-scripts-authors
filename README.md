# Script Library

`list.txt` is the author registry. Keep one author profile URL per line. Both the Android app and the site read the current `android-script-library` branch; removing a line removes that author on the next successful refresh.

The Android source is in [`android-library/`](android-library/). Its build instructions and release requirements are in [`android-library/README.md`](android-library/README.md). The web source is maintained separately in a private repository; the public Pages repository contains the built site.

The command line client lives in [`cli/`](cli/). It browses the same catalog, shows
and downloads code, configures a battle and builds the same `nullsbrawl://` link as
the app. Install it with `npm install -g script-library-cli`; it runs on Windows,
Linux and macOS on Node 18 or newer.

APK builds run in [Actions](https://github.com/Patrick-9936/nb-scripts-authors/actions). Signed installable APKs are published in [Releases](https://github.com/Patrick-9936/nb-scripts-authors/releases). Build artifacts are not committed to this repository.

## Project proxy

The web build and the app talk to the Null's API through a small proxy that runs
on the project's own server. It exists because the API does not allow browser
requests from another origin, and because the author registry and the usage
counters need a place to live that the project controls.

- Public entry point: `https://sl.3-107-57-112.sslip.io`
- Service: `script-library-proxy` (systemd), Node 18, `127.0.0.1:8790`
- Source: `vps/server.mjs`, `vps/authors.mjs`, `vps/usage.mjs` plus the built worker
- Author registry writes use a repository deploy key with write access to this
  repository only; the key stays on the server.
- Owner access is checked against the live Null's session, so a patched client
  cannot claim the owner role.

The proxy is monitored by the `API contract check` workflow, which fails and
opens an issue when the catalog stops responding or the schema changes.
