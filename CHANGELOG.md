# Changelog

## 1.3.518

- **PHP CodeSniffer (phpcs) is now built in**, the same way SFTP and PHPStan already are — no more separate `ikappas.phpcs` Marketplace extension (broken on recent VS Code, like the old SFTP one was). Runs `phpcf phpcs <file> --format=json` on open/save/switch and reports violations as diagnostics, following the exact pattern `phpstan.ts` already used. New `phpcf.phpcs.enabled` setting (default `true`). Also fixes `phpcf phpcs`'s `--format` option, which the framework command declared but never actually passed through to the real `phpcs` binary — it now forwards as `--report=<value>` (default changed from the nonexistent `table` report to phpcs' real default, `full`, so existing manual CLI usage is unaffected).

## 1.3.517

- **New: "CF: Check for DevTrack Update" command.** Installs DevTrack if it's missing, otherwise compares the installed version against the one published on devcloud and offers to update in place. Previously the only way to get a newer DevTrack was "CF: Install DevTrack Extension", which didn't tell you whether an update was actually available.

## 1.3.516

- **Fix: `c::url('/')` / root links wrongly flagged "Controller not found".** Splitting an empty/root uri produced no real segment to match a controller file against. Now resolves against `routes.php`'s `_default` route (app-level override checked first, then `system/config/routes.php`, falling back to `home`) — the same fallback CF itself uses at request time.
- **New: "Sync Local -> Remote (Local Priority)"** — a stricter sync command alongside the existing "Sync Local -> Remote". Always makes remote match local exactly (uploads everything, deletes anything remote-only), regardless of your `sftp.json` `syncOption` settings.
- **Fix: stale PHPStan diagnostics after disabling/removing PHPStan.** Diagnostics from the last successful scan used to stick around forever once PHPStan was no longer runnable, since nothing ever cleared them. They're now cleared as soon as that's detected.
- **Fix: `$this->view = '...'` assignments weren't clickable.** View-link detection only matched function-call forms (`addView(`, `setView(`, etc.) — this is the same pattern `CElement_Trait_UseViewTrait::resolveView()` uses internally (~10 `CElement` subclasses), just as a bare property assignment.

## 1.3.515

- **Fix: SFTP connect crash** — `TypeError: The "listener" argument must be of type function` when connecting/uploading over SSH. `this.end()` was being invoked immediately instead of being passed as an event listener, which also caused the connection to be torn down before it finished connecting.

## 1.3.511

- **SFTP/FTP is now built in.** Upload, download, sync, and the Remote Explorer view work directly in this extension, so you no longer need the `liximomo.sftp` or `natizyskunk.sftp` extension (which had stopped working on recent VS Code). Your existing `.vscode/sftp.json` keeps working with no changes needed.
- **New: "Delete (Local + Remote)"** — right-click a file or folder in the Explorer to delete it both locally and on your active SFTP server in one step.
- **Changed: no more automatic JS build on save.** Saving a file used to silently trigger a rollup build and upload. That's removed — use whatever JS build tool you prefer. Plain "upload on save" (if enabled in your SFTP config) still works as before.
