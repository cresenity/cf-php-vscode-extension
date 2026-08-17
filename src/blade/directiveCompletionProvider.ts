import * as vscode from "vscode";

/**
 * Direktif Blade milik CF sendiri.
 *
 * Yang ada di sini hanya yang tidak dikenal Laravel - @extends, @section dan
 * kawan-kawannya sudah disediakan ekstensi grammar Blade mana pun. Daftarnya
 * disalin dari pendaftarnya di framework: CApp_Concern_BootstrapTrait,
 * CTemplate::bootBlade(), dan CManager. `@unless`/`@else`/`@end` sengaja tidak
 * ikut - ketiganya dibentuk dari nama lain saat berjalan
 * (CView_Compiler_BladeCompiler::if()), jadi tidak ada nama tetap yang bisa
 * ditawarkan.
 */
interface Directive {
    name: string;
    /** Nilai sisip; `null` berarti tanpa argumen. */
    argument: string | null;
    detail: string;
    /** Direktif penutup pasangannya, bila ada. */
    closing?: string;
}

const DIRECTIVE: Directive[] = [
    { name: "CApp", argument: "'${1:name}'", detail: "Render aplikasi CF" },
    { name: "CAppContent", argument: null, detail: "Isi halaman" },
    { name: "CAppStyles", argument: null, detail: "Tag style yang terkumpul" },
    { name: "CAppScripts", argument: null, detail: "Tag script yang terkumpul" },
    { name: "CAppTitle", argument: null, detail: "Judul aplikasi" },
    { name: "CAppPageTitle", argument: null, detail: "Judul halaman" },
    { name: "CAppNav", argument: null, detail: "Navigasi" },
    { name: "CAppSeo", argument: null, detail: "Tag meta SEO" },
    { name: "CAppMessage", argument: null, detail: "Pesan flash" },
    { name: "CAppPreloader", argument: "'${1:type}'", detail: "Preloader" },
    { name: "CAppPWA", argument: "'${1:name}'", detail: "Tag PWA" },
    { name: "CAppElement", argument: "'${1:id}'", detail: "Render satu elemen" },
    { name: "CAppComponent", argument: "'${1:name}'", detail: "Render komponen" },
    { name: "CAppReact", argument: "'${1:name}'", detail: "Render komponen React" },
    {
        name: "CAppStartReact",
        argument: "'${1:name}'",
        detail: "Awal blok React",
        closing: "CAppEndReact",
    },
    {
        name: "CAppPushScript",
        argument: null,
        detail: "Sisipkan script ke tumpukan",
        closing: "CAppEndPushScript",
    },
    {
        name: "CAppPrependScript",
        argument: null,
        detail: "Sisipkan script di awal tumpukan",
        closing: "CAppEndPrependScript",
    },
    { name: "CAppEndReact", argument: null, detail: "Akhir blok React" },
    { name: "CAppEndPushScript", argument: null, detail: "Akhir blok push script" },
    { name: "CAppEndPrependScript", argument: null, detail: "Akhir blok prepend script" },
    { name: "block", argument: "'${1:name}'", detail: "Blok template CF" },
    { name: "template", argument: "'${1:name}'", detail: "Template CF" },
    { name: "googlefonts", argument: null, detail: "Tag Google Fonts" },
    { name: "this", argument: null, detail: "Komponen saat ini" },
    { name: "entangle", argument: "'${1:property}'", detail: "Ikat properti komponen ke Alpine" },
];

/**
 * Melengkapi direktif CF sesudah `@` pada berkas Blade.
 */
export class BladeDirectiveCompletionProvider implements vscode.CompletionItemProvider {
    public static activate(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                ["blade", "php"],
                new BladeDirectiveCompletionProvider(),
                "@"
            )
        );
    }

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        // Hanya di dalam berkas Blade. Bahasa `php` ikut didaftarkan karena
        // `.blade.php` terbaca sebagai php ketika tidak ada ekstensi grammar
        // Blade yang terpasang.
        if (document.languageId !== "blade" && !document.fileName.endsWith(".blade.php")) {
            return [];
        }

        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const match = linePrefix.match(/@([A-Za-z]*)$/);
        if (!match) {
            return [];
        }

        // `@` ikut diganti, kalau tidak hasilnya jadi `@@CAppContent`.
        const range = new vscode.Range(
            position.translate(0, -(match[0].length)),
            position
        );

        return DIRECTIVE.map((directive) => {
            const item = new vscode.CompletionItem(
                "@" + directive.name,
                vscode.CompletionItemKind.Keyword
            );
            item.detail = directive.detail;
            item.range = range;
            item.filterText = "@" + directive.name;

            let insert = "@" + directive.name;
            if (directive.argument) {
                insert += "(" + directive.argument + ")";
            }
            if (directive.closing) {
                insert += "\n\t$0\n@" + directive.closing;
            }

            item.insertText = new vscode.SnippetString(insert);

            return item;
        });
    }
}
