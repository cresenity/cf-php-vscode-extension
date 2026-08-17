# Developer notes

Things about this repo that are not visible from the code, and that have already
cost time once. User-facing documentation is in [README.md](README.md); release
history is in [CHANGELOG.md](CHANGELOG.md).

## Build

```bash
npm install
npx tsc -p ./          # same as the vscode:prepublish script
npx tsc --noEmit -p tsconfig.json   # type check only
npx vsce package       # produces the .vsix
```

**There is no bundler.** `main` points at `./out/src/extension`, plain `tsc`
output, and `node_modules` is *not* listed in `.vscodeignore` — so runtime
dependencies ship inside the `.vsix`. Anything added to `dependencies` therefore
grows the package directly (`blade-formatter` alone is ~9 MB). Putting a runtime
dependency in `devDependencies` would compile fine and then fail at runtime for
users, with nothing catching it locally.

`engines.vscode` and `@types/vscode` are both `^1.64.0` and must stay in step;
`vsce` refuses to package when the types are newer than the declared engine.

## Settings are objects, and dotted paths lie

Settings are contributed as objects (`phpcf.phpcsfixer`, `phpcf.phpcs`,
`phpcf.blade`), not as flat keys. Reading them with a dotted path —
`getConfiguration().get('phpcf.phpcsfixer.runOnSave', false)` — **does not pick up
the default declared in `package.json`**. It returns the fallback argument
instead, so a setting documented as `true` by default silently behaves as
`false` until the user writes it out explicitly.

Read them through the helpers on `cf` (`isPhpcsfixerRunOnSave()`,
`getBladeFormatterOptions()`, and friends) which fetch the object first. This bit
once already; the code comment in `providers/phpcsfixerFormattingEditProvider.ts`
records it at the call site.

## Blade grammar and snippets are ours now

`blade.configuration.json`, `syntaxes/blade.tmLanguage.json` and `snippets/*.json`
were copied from `onecentlin.laravel-blade` 1.38.0 (MIT — see [NOTICE.md](NOTICE.md)),
and are **maintained here, not mirrored**.

`syntaxes/blade.tmLanguage.json` has CF's directives added to two alternation
lists inside `repository.blade.patterns`:

- index `5` — directives followed by `(`, e.g. `@CApp(`, `@CAppElement(`
- index `8` — bare directives, e.g. `@CAppContent`, `@CAppEndPushScript`

Without them, CF directives fall through to the generic `@\w+` rule and get
`entity.name.function.blade` instead of `keyword.blade` — a different colour from
`@section` in the same file. Names are inserted longest-first so `@CApp` cannot
swallow the prefix of `@CAppContent`.

**Copying a newer upstream release over these files deletes that work.** If the
grammar ever needs refreshing, re-apply the CF directives afterwards.

The directive list offered as completions lives separately, in
`src/blade/directiveCompletionProvider.ts`. It mirrors what the framework
registers in `CApp_Concern_BootstrapTrait`, `CTemplate::bootBlade()` and
`CManager`. `@unless`/`@else`/`@end` are deliberately absent: those are composed
from other names at runtime by `CView_Compiler_BladeCompiler::if()`, so there is
no fixed name to offer. If a directive is added to the framework, it belongs in
both this file and the grammar.

Blade *formatting* is the opposite case: it calls the `blade-formatter` npm
package directly rather than a copy, so it updates with `npm update blade-formatter`.
That is the same engine `shufo.vscode-blade-formatter` wraps.

## The phar versions are pinned in the framework, not here

`phpcf php-cs-fixer:install` / `phpcf phpcs:install` install a specific version,
declared in the framework as `CQC_Phpcsfixer::VERSION` and `CQC_Phpcs::VERSION`.
The phars are served from devcloud under version-bearing names, e.g.
`.../data/bin/php-cs-fixer/php-cs-fixer.3.95.18.phar`. Changing the supported
version means touching the framework and publishing the phar; nothing in this
repo needs to change.

Those install commands compare the installed phar's *version*, not merely whether
the file exists — an older phar that refuses the running PHP reads as unreadable
and is replaced.

`phpcf.phpcsfixer.config` / `phpcf.phpcs.config` set to `"auto"` require framework
CF 1.9 or newer: they pass `--config` / `--standard` explicitly, options that
older `phpcf` builds do not accept. The extension has to resolve the path itself
because `phpcf` picks its config from `CF::appCode()`, which comes from the
working directory — and formatting copies the file to a temp directory first,
outside every application.

## Redundant extensions

`src/redundantExtension.ts` holds the list. Two details matter:

- **Ids are matched case-insensitively.** Marketplace ids keep their publisher's
  casing (`Natizyskunk.sftp`), and an exact-match lookup fails silently rather
  than erroring — the notice simply never appears.
- **Uninstall and search use the installed extension's own id**, not the spelling
  in the list, for the same reason.

`sftp.*` settings are never cleaned up: this extension contributes settings under
that same prefix, so removing "leftovers" would delete live configuration.

Dismissals are stored in `globalState` under `phpcf.redundantExtension.dismissed`,
keyed by extension id — so button labels can change without resurrecting notices
a user already silenced.

## Two changelogs

[CHANGELOG.md](CHANGELOG.md) covers 1.3.511 onward. Older entries exist only in
the README's own Change Log section. New entries go in `CHANGELOG.md`.
