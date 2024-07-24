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
