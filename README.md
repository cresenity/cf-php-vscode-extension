# php-cf-vscode-extension
VSCode extension for PHP Cresenity Framework

# Settings

## viewMaxLinesCount
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

Use `Ctrl` or `Alt` + `click` to jump to the first matched file.


# Change Log

## V1.0.14

Add Document Link on ->setView(


## V1.1.0

Add Controller Uri on c::redirect(), c::url() and curl::redirect()
Change config name from viewMaxLinesCount to maxLineScanningCount (use both for scanning view and uri controller)

## V1.1.1

minor fix for folder scan priority
