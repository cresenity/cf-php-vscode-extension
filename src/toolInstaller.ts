import * as vscode from "vscode";
import PHPCF from "./phpcf";
import cf from "./cf";

/**
 * Memasang phar yang dibutuhkan lewat perintah phpcf-nya sendiri.
 *
 * Binernya sengaja diambil dari pemasangan phpcf (`.bin/{tool}/{phar}`), bukan
 * dari PATH atau salinan yang dibawa ekstensi: seluruh proyek CF di mesin ini
 * memakai phar yang sama, sehingga hasil formatnya seragam dengan yang
 * dijalankan `phpcf php-cs-fixer:format` di terminal.
 */
interface Tool {
    key: string;
    label: string;
    command: string;
    isInstalled: () => boolean;
}

const TOOL: { [key: string]: Tool } = {
    "php-cs-fixer": {
        key: "php-cs-fixer",
        label: "php-cs-fixer",
        // CConsole_Command_Phpcsfixer_InstallCommand. Bukan `phpcs:install` -
        // pesan galat lama menyebut yang itu, dan menjalankannya memasang phpcs
        // sehingga php-cs-fixer tetap tidak ada.
        command: "php-cs-fixer:install",
        isInstalled: () => cf.isPhpCsFixerInstalled(),
    },
    phpcs: {
        key: "phpcs",
        label: "phpcs",
        command: "phpcs:install",
        isInstalled: () => cf.isPhpCsInstalled(),
    },
};

const busy: { [key: string]: boolean } = {};

/**
 * Memastikan sebuah phar tersedia, memasangnya bila belum.
 *
 * @param key            'php-cs-fixer' atau 'phpcs'
 * @param askFirst       tanyakan dulu, alih-alih langsung memasang
 * @returns              true bila sudah tersedia sesudah pemanggilan ini
 */
export async function ensureTool(key: string, askFirst: boolean = false): Promise<boolean> {
    const tool = TOOL[key];
    if (!tool) {
        return false;
    }
    if (tool.isInstalled()) {
        return true;
    }
    // Dua kejadian simpan berturut-turut tidak boleh memicu dua unduhan ke
    // berkas yang sama.
    if (busy[key]) {
        return false;
    }

    if (!cf.isPhpcfInstalled()) {
        vscode.window.showErrorMessage(
            `${tool.label} belum terpasang, dan phpcf juga tidak ditemukan - tidak ada yang dapat memasangnya.`
        );

        return false;
    }

    if (askFirst) {
        const install = "Pasang sekarang";
        const choice = await vscode.window.showWarningMessage(
            `${tool.label} belum terpasang. Pasang lewat "phpcf ${tool.command}"?`,
            install,
            "Nanti"
        );
        if (choice !== install) {
            return false;
        }
    }

    busy[key] = true;

    try {
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Memasang ${tool.label} lewat phpcf ${tool.command}`,
                cancellable: false,
            },
            async () => {
                try {
                    await PHPCF.run(tool.command);
                } catch (e) {
                    // PHPCF.execute menolak dengan stderr saat stdout kosong;
                    // keberhasilannya diperiksa dari berkasnya, bukan dari itu.
                }

                const ok = tool.isInstalled();
                if (ok) {
                    vscode.window.showInformationMessage(`${tool.label} terpasang.`);
                } else {
                    vscode.window.showErrorMessage(
                        `Gagal memasang ${tool.label}. Coba jalankan "phpcf ${tool.command}" di terminal.`
                    );
                }

                return ok;
            }
        );
    } finally {
        busy[key] = false;
    }
}

/**
 * Dipanggil saat aktivasi - memasang yang belum ada tanpa bertanya, karena
 * setelan bawaannya memang menjalankan php-cs-fixer tiap simpan dan tanpa
 * phar-nya fitur itu diam saja.
 *
 * @returns void
 */
export function ensureToolOnActivate() {
    // Bawaannya menjalankan php-cs-fixer tiap simpan, dan tanpa phar-nya fitur
    // itu diam saja - jadi dipasang tanpa bertanya. phpcs hanya ditawarkan,
    // sebab diagnostiknya tidak seharusnya mengunduh apa pun diam-diam.
    if (!cf.isPhpCsFixerInstalled()) {
        ensureTool("php-cs-fixer");
    }
    if (!cf.isPhpCsInstalled()) {
        ensureTool("phpcs", true);
    }
}
