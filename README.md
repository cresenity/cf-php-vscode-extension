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

## php php-cs-fixer default formatter
```json
{
    "[php]": {
        "editor.defaultFormatter": "cresenity.php-cf"
    }
}
```

## run php-cs-fixer on save
```json
"phpcf.phpcsfixer" : {
    "runOnSave" : true
}
```

# Change Log

## V1.0.14

Add Document Link on ->setView(


## V1.1.0

Add Controller Uri on c::redirect(), c::url() and curl::redirect()
Change config name from viewMaxLinesCount to maxLineScanningCount (use both for scanning view and uri controller)

## V1.1.1

Minor fix for folder scan priority


## V1.2.0

Add integration for phpstan (phpcf must be instaled through composer)

## V1.3.0

Add autocomplete for view

## V1.3.2

Fix bug autocomplete for view
Fix prevent run phpstan when phpcf is not installed
Add autocomplete for translation
Add autocomplete for config
Add autocomplete for permission

## V1.3.3
Add Code Action For Class Not Found

## V1.3.4
Add Refactor Action For phpcf model:update

## V1.3.5
Add Refactor Action For phpcf phpcsfixer
Extension can be defaultFormatter for php with cf php-cs-fixer configuration

## V1.3.501
Fix php-cs-fixer on save spamming error when php-cs-fixer is not installed
Fix controller URI quick jump now jumps to the method line (supports HTTP verb prefixed methods)
Fix multiple TypeScript strict mode errors (null checks, Map usage, optional parameters)

## V1.3.502
Add Route List tree view in sidebar — shows controllers and methods for the active app
Add keyboard shortcut (Ctrl+Shift+M) to run phpcf model:update on current model file
Add hover and click-to-definition for permission names (havePermission, checkPermission, etc.) to nav files
Fix additional TypeScript strict mode errors across codebase

## V1.3.503
Add diagnostic: warning when permission name not found in nav files
Add diagnostic: warning when view file not found
Add diagnostic: warning when controller URI not resolved (skips http/https URLs)
Add diagnostic: deprecated hint for echo $app->render() — use return $app instead
Add diagnostic: warning for duplicate permission names across nav files

## V1.3.504
Add theme file validation: warning when CSS/JS asset file not found
Add theme file validation: warning when client_module not found in asset definitions
Add click-to-file for CSS/JS entries in theme files — opens the resolved asset file
Add click-to-definition for client_modules entries in theme files — jumps to module definition

## V1.3.505
Replace tree views with webview panel — Routes and Models as tabs in CF PHP sidebar
Add Models tab: lists tables from phpcf model:tables, click to open model file
Add create model action for tables without model — runs phpcf make:model in terminal
Show phpcf install instructions when phpcf is not installed
Auto-filter to active app based on open file, no tree collapse on file navigation
Fix client_module validation false positives (assets-module.php with requirements key)
