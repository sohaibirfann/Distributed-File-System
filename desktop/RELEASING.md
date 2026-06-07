# Releasing app updates (auto-update)

The app checks **GitHub Releases** on launch and updates itself (via
`electron-updater`). To ship a new version:

## One-time setup
1. `cd desktop && npm install` (pulls `electron-updater`).
2. Create a GitHub **personal access token** with `repo` scope and set it in your
   shell as `GH_TOKEN` (electron-builder reads it to upload the release).
   ```powershell
   $env:GH_TOKEN = "ghp_xxx"
   ```
3. Enable **Windows Developer Mode** (so the NSIS build can extract signing tools)
   — Settings → System → For developers.

## Each release
1. Bump `version` in `desktop/package.json` (e.g. `0.1.0` → `0.1.1`).
2. Build + publish:
   ```powershell
   cd desktop
   npm run dist -- --publish always
   ```
   This builds the NSIS installer and uploads it + `latest.yml` to a GitHub Release.
3. Done. Installed apps detect the newer version on next launch, download it in the
   background, and install on quit (`checkForUpdatesAndNotify`).

## Notes
- Auto-update only works for the **installed** (NSIS) app — not the unpacked/zipped
  `win-unpacked` folder.
- Builds are **unsigned**: install shows a SmartScreen warning (More info → Run
  anyway); updates themselves still apply. A code-signing cert removes the warning.
- Backend/coordinator changes don't need an app release — just restart the
  coordinator; all clients use it live.
