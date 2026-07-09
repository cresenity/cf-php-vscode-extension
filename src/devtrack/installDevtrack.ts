import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import logger from '../logger';

const DEVTRACK_EXTENSION_ID = 'cresenity.devtrack';

interface VersionResponse {
    errCode: number;
    errMessage?: string;
    version?: string;
    downloadUrl?: string;
}

function getDevtrackBaseUrl(): string {
    return vscode.workspace.getConfiguration('phpcf').get('devtrackBaseUrl', 'https://cpanel.ittron.co.id');
}

function fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 10000 }, (res) => {
            if ((res.statusCode || 0) >= 400) {
                res.resume();
                reject(new Error(`Request to ${url} failed with status ${res.statusCode}`));
                return;
            }

            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body) as T);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);

        https.get(url, { timeout: 60000 }, (res) => {
            if ((res.statusCode || 0) >= 400) {
                res.resume();
                reject(new Error(`Download from ${url} failed with status ${res.statusCode}`));
                return;
            }

            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

export function isDevtrackInstalled(): boolean {
    return vscode.extensions.getExtension(DEVTRACK_EXTENSION_ID) !== undefined;
}

/**
 * Downloads the latest DevTrack .vsix from devcloud (not published to the
 * Marketplace, so this is the only way to get it) and installs it via the
 * same command VS Code uses for Marketplace installs.
 */
export async function installDevtrack(): Promise<void> {
    try {
        const baseUrl = getDevtrackBaseUrl();
        const version = await fetchJson<VersionResponse>(`${baseUrl}/devtrack/extension/version`);

        if (version.errCode !== 0 || !version.downloadUrl) {
            vscode.window.showErrorMessage(
                `Could not fetch DevTrack: ${version.errMessage || 'no build published yet'}`
            );
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Installing DevTrack extension...' },
            async () => {
                const vsixPath = path.join(os.tmpdir(), `devtrack-${version.version}.vsix`);

                await downloadFile(version.downloadUrl as string, vsixPath);

                try {
                    await vscode.commands.executeCommand(
                        'workbench.extensions.installExtension',
                        vscode.Uri.file(vsixPath)
                    );
                } finally {
                    fs.unlinkSync(vsixPath);
                }
            }
        );

        const reload = await vscode.window.showInformationMessage(
            'DevTrack installed. Reload window to activate it?',
            'Reload Now'
        );

        if (reload === 'Reload Now') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    } catch (error) {
        logger.error(error instanceof Error ? error : String(error));
        vscode.window.showErrorMessage(
            'Failed to install DevTrack extension. See the CF PHP output channel for details.'
        );
    }
}

/** Shown once on activation if DevTrack isn't installed yet - not an error, just a nudge. */
export async function checkDevtrackInstalled(): Promise<void> {
    if (isDevtrackInstalled()) {
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        'DevTrack (Cresenity time tracking) is not installed. Install it now?',
        'Install DevTrack',
        'Not Now'
    );

    if (choice === 'Install DevTrack') {
        await installDevtrack();
    }
}
