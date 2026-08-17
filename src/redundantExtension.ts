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
    /**
     * Bahasa yang ekstensi ini mungkin dipasang sebagai formatter bawaannya.
     *
     * `[lang].editor.defaultFormatter` yang menunjuk ekstensi tercabut tidak
     * memberi galat - Format Document hanya berhenti bekerja. Karena itu
     * setelannya dialihkan, bukan sekadar dirapikan.
     */
    formatterFor?: string[];
}

/** Id ekstensi ini, tujuan pengalihan defaultFormatter. */
const OWN_ID = "cresenity.php-cf";

const REDUNDANT: Redundant[] = [
    {
        id: "junstyle.php-cs-fixer",
        name: "PHP CS Fixer",
        reason: "phpcf sudah menjalankan php-cs-fixer sendiri, termasuk saat menyimpan.",
        formatterFor: ["php"],
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
        formatterFor: ["blade"],
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
 * Ekstensi terpasang dengan id itu, tanpa peduli besar-kecil huruf.
 *
 * Id di marketplace mempertahankan huruf yang dipakai penerbitnya - misalnya
 * `Natizyskunk.sftp` berhuruf besar. Mencocokkannya persis membuat satu huruf
 * yang salah tulis di daftar ini berakhir sebagai deteksi yang diam saja, bukan
 * sebagai galat yang kelihatan.
 */
function findInstalled(id: string): vscode.Extension<any> | undefined {
    const wanted = id.toLowerCase();

    return vscode.extensions.all.find((item) => item.id.toLowerCase() === wanted);
}

/**
 * Mengalihkan `[lang].editor.defaultFormatter` yang menunjuk ekstensi ini.
 *
 * Hanya yang benar-benar menunjuk ekstensi tersebut yang diubah - pilihan
 * formatter lain milik pengguna tidak disentuh. Setelan `sftp.*` sengaja tidak
 * ikut dibersihkan sama sekali: ekstensi ini memakai awalan yang sama, jadi
 * menghapusnya akan membuang setelan yang masih terpakai.
 *
 * @returns bahasa yang setelannya berubah
 */
async function migrateFormatterSetting(item: Redundant): Promise<string[]> {
    const changed: string[] = [];

    for (const languageId of item.formatterFor || []) {
        const editor = vscode.workspace.getConfiguration("editor", { languageId });
        const current = editor.get<string>("defaultFormatter");

        if (!current || current.toLowerCase() !== item.id.toLowerCase()) {
            continue;
        }

        try {
            await editor.update(
                "defaultFormatter",
                OWN_ID,
                vscode.ConfigurationTarget.Global,
                true
            );
            changed.push(languageId);
        } catch (e) {
            vscode.window.showWarningMessage(
                `Gagal mengubah formatter [${languageId}]: ` +
                    (e instanceof Error ? e.message : String(e))
            );
        }
    }

    return changed;
}

/**
 * Mencabut ekstensi, lalu membereskan setelan yang menunjuknya.
 *
 * Urutannya penting: setelan dialihkan sesudah pencabutan berhasil, supaya
 * pencabutan yang dibatalkan pengguna tidak meninggalkan setelan yang sudah
 * berubah.
 */
async function uninstallAndMigrate(item: Redundant, installed: vscode.Extension<any>) {
    try {
        await vscode.commands.executeCommand(
            "workbench.extensions.uninstallExtension",
            installed.id
        );
    } catch (e) {
        vscode.window.showErrorMessage(
            `Gagal meng-uninstall ${item.name}: ` + (e instanceof Error ? e.message : String(e))
        );

        return;
    }

    const changed = await migrateFormatterSetting(item);

    const reload = "Muat Ulang Jendela";
    const message = changed.length
        ? `${item.name} dicabut. Formatter untuk ${changed
              .map((languageId) => "[" + languageId + "]")
              .join(", ")} dialihkan ke phpcf.`
        : `${item.name} dicabut.`;

    const choice = await vscode.window.showInformationMessage(message, reload);
    if (choice === reload) {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
}

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
        const installed = findInstalled(item.id);
        if (!installed) {
            continue;
        }

        const uninstall = item.formatterFor ? "Uninstall & sesuaikan setelan" : "Uninstall";
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
                    // perintah internal ini yang dipakai UI-nya sendiri. Yang
                    // dikirim id milik ekstensi terpasang, bukan ejaan di daftar
                    // ini - keduanya bisa berbeda besar-kecil hurufnya.
                    uninstallAndMigrate(item, installed);
                } else if (choice === showIt) {
                    vscode.commands.executeCommand(
                        "workbench.extensions.search",
                        "@id:" + installed.id
                    );
                } else if (choice === never) {
                    state.update(DISMISS_KEY, dismissed.concat([item.id]));
                }
            });
    }
}

/**
 * Membereskan defaultFormatter yang menunjuk ekstensi yang sudah tidak ada.
 *
 * Mencabut ekstensi tidak ikut membersihkan setelan yang menyebutnya, dan
 * `[php].editor.defaultFormatter` yang menunjuk ekstensi tercabut membuat
 * Format Document berhenti bekerja tanpa pesan apa pun. Jadi keadaan ini
 * diperiksa terpisah dari daftar mubazir di atas, yang hanya melihat ekstensi
 * yang masih terpasang.
 */
export async function checkStaleFormatterSetting() {
    for (const item of REDUNDANT) {
        if (!item.formatterFor || findInstalled(item.id)) {
            continue;
        }

        for (const languageId of item.formatterFor) {
            const editor = vscode.workspace.getConfiguration("editor", { languageId });
            const current = editor.get<string>("defaultFormatter");

            if (!current || current.toLowerCase() !== item.id.toLowerCase()) {
                continue;
            }

            const fix = "Alihkan ke phpcf";
            const choice = await vscode.window.showWarningMessage(
                `Formatter [${languageId}] menunjuk "${current}", yang tidak terpasang - `
                    + "Format Document tidak akan bekerja.",
                fix,
                "Biarkan"
            );

            if (choice !== fix) {
                continue;
            }

            await editor.update(
                "defaultFormatter",
                OWN_ID,
                vscode.ConfigurationTarget.Global,
                true
            );
            vscode.window.showInformationMessage(
                `Formatter [${languageId}] dialihkan ke phpcf.`
            );
        }
    }
}

/**
 * Daftar id ekstensi mubazir yang sedang terpasang - dipakai baris status
 * aktivasi supaya keadaannya terlihat walau pemberitahuannya sudah didiamkan.
 */
export function installedRedundantExtension(): string[] {
    return REDUNDANT.filter((item) => findInstalled(item.id)).map((item) => item.id);
}
