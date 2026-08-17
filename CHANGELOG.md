# Changelog

## 1.3.520

- **Blade is now built in.** `onecentlin.laravel-blade` and `shufo.vscode-blade-formatter` are both redundant and the extension says so on startup. The Blade language id, its grammar and its snippets are copied from `onecentlin.laravel-blade` (MIT, see `NOTICE.md`) because they are data files with no package to depend on; formatting instead calls the `blade-formatter` npm library directly — the same engine the shufo extension wraps, so it keeps updating through npm rather than being frozen in a copy.
- Declaring the Blade language ourselves also removes a silent dependency: the formatter only runs on language id `blade`, which until now existed solely because a third-party extension happened to be installed. Without it `.blade.php` is plain PHP and nothing would have run.
- **CF directives are offered as completions after `@`** in Blade files — `@CAppContent`, `@CAppElement`, `@CAppPushScript` and the rest, built from what the framework actually registers in `CApp_Concern_BootstrapTrait`, `CTemplate` and `CManager`. Paired directives insert their closing half. `@unless`/`@else`/`@end` are deliberately absent: they are composed from other names at runtime, so there is no fixed name to offer.
- New `phpcf.blade` settings: `enabled`, `runOnSave` (both `true`), `exclude`, plus `blade-formatter`'s own options under their upstream names and defaults.

## 1.3.519

- **php-cs-fixer is now built in**, the same way phpcs was in 1.3.518 — `junstyle.php-cs-fixer` is no longer needed and the extension says so on startup (once, then it stays quiet). Leaving both installed is not merely redundant: two extensions registering as PHP formatters make VS Code ask which to use on every Format Document, and both run on save. Point `"[php]": {"editor.defaultFormatter": "cresenity.php-cf"}` at this extension when you uninstall the old one.
- Defaults now match a working `junstyle.php-cs-fixer` setup instead of being off: `runOnSave` and `documentFormattingProvider` are `true`, phpcs reports `showSources`, and `**/.vscode/**`, `**/node_modules/**`, `**/vendor/**` are ignored. `allowRisky` has no equivalent because CF's `.php-cs-fixer.dist.php` already sets `setRiskyAllowed(true)`; `autoFixByBracket`/`autoFixBySemicolon` are not implemented.
- New `config` setting for both tools, default `"auto"`: the application's own `.php-cs-fixer.dist.php`/`phpcs.xml` when it exists, otherwise CF's. This could not be left to phpcf — its own choice depends on the working directory, and formatting copies the file to a temp directory first, outside every application. Needs CF with `phpcs --standard` and `php-cs-fixer --config` (framework 1.9).
- The phar is installed from `phpcf php-cs-fixer:install` when missing — automatically, since formatting on save is on by default and would otherwise do nothing silently. phpcs asks first. Framework 1.9 also fixes those install commands keeping an unsupported phar forever: they checked the file existed, never its version, so a php-cs-fixer that refuses PHP 8.2 survived every reinstall.

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
