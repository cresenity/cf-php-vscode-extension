# php-cf-vscode-extension
VSCode extension for PHP Cresenity Framework

# Settings

## maxLineScanningCount
Maximum number of scanning rows.

Default: 666


## viewExtensions

Search views according to the configured extensions.

```json
"phpcf.extensions": [
    ".blade.php",
    ".php"
]
```

## viewQuickJump

Use `Ctrl` or `Alt` + `click` to jump to the first matched file for views.

## uriControllerQuickJump

Use `Ctrl` or `Alt` + `click` to jump to the first matched file for uri controller.


## phpstan

enable/disable phpstan for phpcf.

```json
"phpcf.phpstan": {
    "enabled" : true
}
```

## php-cs-fixer

php-cs-fixer is built into this extension. The phar comes from
`phpcf php-cs-fixer:install`, which the extension runs by itself on activation
when it is missing — formatting on save is on by default, and without the phar
that setting would silently do nothing. Every CF project on the machine then
uses the same phar, so the editor and `phpcf php-cs-fixer` in a terminal produce
identical output.

### Set it as the PHP formatter

```json
{
    "[php]": {
        "editor.defaultFormatter": "cresenity.php-cf"
    }
}
```

Without this line VS Code asks which formatter to use every time Format Document
is pressed, whenever more than one extension registers for PHP.

**Coming from `junstyle.php-cs-fixer`?** That extension is now redundant and can
be uninstalled — this one will tell you so on startup. Point
`editor.defaultFormatter` at `cresenity.php-cf` instead of
`junstyle.php-cs-fixer`, then delete your `php-cs-fixer.*` settings; the ones
that matter have equivalents below. Two do not carry over: `autoFixByBracket`
and `autoFixBySemicolon` (formatting as you type `}` or `;`) are not
implemented here. `allowRisky` is not a setting either — CF's own
`.php-cs-fixer.dist.php` already declares `setRiskyAllowed(true)`.

### Settings

```json
"phpcf.phpcsfixer": {
    "enabled": true,
    "runOnSave": true,
    "documentFormattingProvider": true,
    "config": "auto",
    "exclude": []
}
```

- `runOnSave` — format every PHP file when it is saved.
- `documentFormattingProvider` — register as a PHP formatter. Turn this off to
  keep Format Document away from php-cs-fixer while still using `runOnSave`.
  Only read at startup, so reload the window after changing it.
- `config` — `"auto"` uses the application's own `.php-cs-fixer.dist.php` when it
  exists, otherwise CF's. Any other value is a file name looked up in the
  application then the docroot, or an absolute path.
- `exclude` — glob patterns that are never formatted, matched against the whole
  file path (e.g. `"**/vendor/**"`).

## phpcs

Diagnostics come from PHP_CodeSniffer. The extension offers to run
`phpcf phpcs:install` on activation when the phar is missing — it asks first,
unlike php-cs-fixer, since diagnostics should not download anything unannounced.
This replaces the `ikappas.phpcs` extension, which can be uninstalled.

```json
"phpcf.phpcs": {
    "enabled": true,
    "showSources": true,
    "config": "auto",
    "ignorePatterns": [
        "**/.vscode/**",
        "**/node_modules/**",
        "**/vendor/**"
    ]
}
```

- `showSources` — name the sniff behind each message, e.g.
  `PEAR.NamingConventions.ValidClassName.StartWithCapital`.
- `config` — `"auto"` uses the application's own `phpcs.xml` when it exists,
  otherwise CF's, following the same rule as `phpcsfixer.config`.
- `ignorePatterns` — files that are never checked.

# Change Log

## V1.3.511
SFTP/FTP is now built into this extension (upload, download, sync, Remote Explorer) — no longer depends on the liximomo.sftp / natizyskunk.sftp marketplace extension, which had stopped working on recent VS Code
Add "Delete (Local + Remote)" command to the Explorer right-click menu — deletes a file/folder both locally and on the active SFTP profile in one step
Remove automatic rollup build + upload-on-save for application/*/*/js files on save — developers can now use any JS build tool instead of being forced into rollup

**What you need to do after updating:**
- Disable or uninstall the `liximomo.sftp` / `natizyskunk.sftp` extension if you have it installed, so its commands don't conflict with the ones now built into CF PHP Extension
- Reload the VS Code window after updating so the bundled SFTP feature activates
- Your existing `.vscode/sftp.json` needs no changes and will keep working as-is
- If you relied on the old auto-build-on-save for JS files, you now need to run your JS build yourself (e.g. `npm run dev`/watch) — saving a file no longer triggers it automatically. "Upload on save" for the saved file itself still works if `uploadOnSave` is set in your SFTP profile

## V1.3.510
Add "CF: Install DevTrack Extension" command and a one-time activation prompt when the DevTrack (Cresenity time tracking) extension isn't installed
DevTrack isn't published to the Marketplace, so this downloads the latest .vsix from devcloud (phpcf.devtrackBaseUrl setting) and installs it via workbench.extensions.installExtension
Add phpcf.devtrackBaseUrl setting (default https://cpanel.ittron.co.id)

## V1.3.509
Add Ctrl+click translation links: c::trans(), c::__(), @lang(), setLabel(), setTitle() — jump to i18n definition (application first, then system)
setLabel/setTitle links and diagnostics skipped when second param is explicitly false
Add translation diagnostic: warn when key is missing in non-default locales (only runs if app has 2+ i18n locale dirs; default locale from config/app.php)
All diagnostics skip PHP-commented lines (// and /* */ blocks)
Refactor diagnostics into src/diagnostics/ — one file per diagnostic type
Fix client_module link: parse assets.php within modules section, client_modules.php at top level (assets.php searched first)
Fix modelUpdate.ts implicit any on str parameter

## V1.3.508
Fix Ctrl+Shift+M (model:update) no longer opens a terminal — runs silently via child_process with progress notification
Fix client_module link resolution: assets.php (modules nested under 'modules' key) searched first, client_modules.php (top-level) searched as fallback — correct structure-aware parsing for each format

## V1.3.507
Add "CF: Generate IDE Helper" command — generates `_ide_helper.php` with PHPDoc stubs for CF helper classes, core CF class, and major library classes (CApp, CModel, CHTTP, CManager, etc.)
Fix TypeScript errors: add opn module declaration, type annotation on snakeCase, remove unused field

## V1.3.506
Add "Data Domain" context menu on application folders — lists domain files for that app
Add "CF: Resolve URL to Controller" command — paste a URL to jump to the controller method
Auto-fills URL from clipboard if available

## V1.3.505
Replace tree views with webview panel — Routes and Models as tabs in CF PHP sidebar
Add Models tab: lists tables from phpcf model:tables, click to open model file
Add create model action for tables without model — runs phpcf make:model in terminal
Show phpcf install instructions when phpcf is not installed
Auto-filter to active app based on open file, no tree collapse on file navigation
Fix client_module validation false positives (assets-module.php with requirements key)

## V1.3.504
Add theme file validation: warning when CSS/JS asset file not found
Add theme file validation: warning when client_module not found in asset definitions
Add click-to-file for CSS/JS entries in theme files — opens the resolved asset file
Add click-to-definition for client_modules entries in theme files — jumps to module definition

## V1.3.503
Add diagnostic: warning when permission name not found in nav files
Add diagnostic: warning when view file not found
Add diagnostic: warning when controller URI not resolved (skips http/https URLs)
Add diagnostic: deprecated hint for echo $app->render() — use return $app instead
Add diagnostic: warning for duplicate permission names across nav files

## V1.3.502
Add Route List tree view in sidebar — shows controllers and methods for the active app
Add keyboard shortcut (Ctrl+Shift+M) to run phpcf model:update on current model file
Add hover and click-to-definition for permission names (havePermission, checkPermission, etc.) to nav files
Fix additional TypeScript strict mode errors across codebase

## V1.3.501
Fix php-cs-fixer on save spamming error when php-cs-fixer is not installed
Fix controller URI quick jump now jumps to the method line (supports HTTP verb prefixed methods)
Fix multiple TypeScript strict mode errors (null checks, Map usage, optional parameters)

## V1.3.5
Add Refactor Action For phpcf phpcsfixer
Extension can be defaultFormatter for php with cf php-cs-fixer configuration

## V1.3.4
Add Refactor Action For phpcf model:update

## V1.3.3
Add Code Action For Class Not Found

## V1.3.2
Fix bug autocomplete for view
Fix prevent run phpstan when phpcf is not installed
Add autocomplete for translation
Add autocomplete for config
Add autocomplete for permission

## V1.3.0
Add autocomplete for view

## V1.2.0
Add integration for phpstan (phpcf must be instaled through composer)

## V1.1.1
Minor fix for folder scan priority

## V1.1.0
Add Controller Uri on c::redirect(), c::url() and curl::redirect()
Change config name from viewMaxLinesCount to maxLineScanningCount (use both for scanning view and uri controller)

## V1.0.14
Add Document Link on ->setView(
