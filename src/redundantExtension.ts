import * as vscode from "vscode";

/**
 * Ekstensi yang fungsinya sudah disertakan phpcf.
 *
 * Membiarkannya terpasang bukan sekadar mubazir. Dua ekstensi yang sama-sama
 * mendaftar sebagai formatter membuat VS Code menanyakan mana yang dipakai tiap
 * kali Format Document ditekan, dan dua-duanya berjalan saat simpan. Yang
 * mendaftarkan snippet yang sama membuat tiap snippet muncul dua kali. Yang
 * mendaftarkan grammar dengan scopeName yang sama hanya menyisakan satu
 * pemenang, dan bukan yang ini yang tentu menang.
 */
interface Redundant {
    id: string;
    name: string;
    reason: string;
}

const REDUNDANT: Redundant[] = [
    {
        id: "junstyle.php-cs-fixer",
        name: "PHP CS Fixer",
        reason: "phpcf sudah menjalankan php-cs-fixer sendiri, termasuk saat menyimpan.",
    },
    {
        id: "ikappas.phpcs",
        name: "phpcs",
        reason: "phpcf sudah menampilkan diagnostik phpcs sendiri.",
    },
    {
        id: "shufo.vscode-blade-formatter",
        name: "Laravel Blade Formatter",
        reason: "phpcf memanggil pustaka blade-formatter yang sama secara langsung.",
    },
    {
        id: "onecentlin.laravel-blade",
        name: "Laravel Blade Snippets",
        reason: "phpcf sudah membawa bahasa, grammar, dan snippet Blade-nya sendiri.",
    },
    {
        id: "liximomo.sftp",
        name: "SFTP",
        reason: "phpcf sudah menyertakan SFTP/FTP sendiri sejak 1.3.511.",
    },
    {
        id: "natizyskunk.sftp",
        name: "SFTP",
        reason: "phpcf sudah menyertakan SFTP/FTP sendiri sejak 1.3.511.",
    },
];

const DISMISS_KEY = "phpcf.redundantExtension.dismissed";

/**
 * Memberi tahu sekali per ekstensi, lalu diam.
 *
 * Pemberitahuan yang muncul tiap kali VS Code dibuka akan diabaikan orang -
 * jadi pilihan "Jangan ingatkan lagi" disimpan permanen di globalState.
 */
export function checkRedundantExtension(state: vscode.Memento) {
    const dismissed = state.get<string[]>(DISMISS_KEY, []);

    for (const item of REDUNDANT) {
        if (dismissed.indexOf(item.id) !== -1) {
            continue;
        }
        const installed = vscode.extensions.getExtension(item.id);
        if (!installed) {
            continue;
        }

        const uninstall = "Uninstall";
        const showIt = "Lihat Ekstensi";
        const never = "Jangan ingatkan lagi";

        vscode.window
            .showInformationMessage(
                `Ekstensi "${item.name}" (${item.id}) dapat di-uninstall. ${item.reason}`,
                uninstall,
                showIt,
                never
            )
            .then((choice) => {
                if (choice === uninstall) {
                    // VS Code tidak menyediakan API uninstall untuk ekstensi;
                    // perintah internal ini yang dipakai UI-nya sendiri.
                    vscode.commands.executeCommand(
                        "workbench.extensions.uninstallExtension",
                        item.id
                    );
                } else if (choice === showIt) {
                    vscode.commands.executeCommand(
                        "workbench.extensions.search",
                        "@id:" + item.id
                    );
                } else if (choice === never) {
                    state.update(DISMISS_KEY, dismissed.concat([item.id]));
                }
            });
    }
}

/**
 * Daftar id ekstensi mubazir yang sedang terpasang - dipakai baris status
 * aktivasi supaya keadaannya terlihat walau pemberitahuannya sudah didiamkan.
 */
export function installedRedundantExtension(): string[] {
    return REDUNDANT.filter((item) => vscode.extensions.getExtension(item.id)).map(
        (item) => item.id
    );
}
