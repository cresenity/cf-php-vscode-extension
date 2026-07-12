# Changelog

## 1.3.515

- **Fix: SFTP connect crash** — `TypeError: The "listener" argument must be of type function` when connecting/uploading over SSH. `this.end()` was being invoked immediately instead of being passed as an event listener, which also caused the connection to be torn down before it finished connecting.

## 1.3.511

- **SFTP/FTP is now built in.** Upload, download, sync, and the Remote Explorer view work directly in this extension, so you no longer need the `liximomo.sftp` or `natizyskunk.sftp` extension (which had stopped working on recent VS Code). Your existing `.vscode/sftp.json` keeps working with no changes needed.
- **New: "Delete (Local + Remote)"** — right-click a file or folder in the Explorer to delete it both locally and on your active SFTP server in one step.
- **Changed: no more automatic JS build on save.** Saving a file used to silently trigger a rollup build and upload. That's removed — use whatever JS build tool you prefer. Plain "upload on save" (if enabled in your SFTP config) still works as before.
