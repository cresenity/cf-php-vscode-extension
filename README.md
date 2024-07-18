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
"phpcf.phpstan": [
    "enabled" : true
]
```

# Change Log

## V1.0.14

Add Document Link on ->setView(


## V1.1.0

Add Controller Uri on c::redirect(), c::url() and curl::redirect()
Change config name from viewMaxLinesCount to maxLineScanningCount (use both for scanning view and uri controller)

## V1.1.1

minor fix for folder scan priority


## V1.2.0

Add integration for phpstan (phpcf must be instaled through composer)

## V1.3.0

Add autocomplete for view
