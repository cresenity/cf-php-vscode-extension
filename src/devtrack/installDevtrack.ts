import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import logger from '../logger';

const DEVTRACK_EXTENSION_ID = 'cresenity.devtrack';

interface VersionResponse {
    errCode: number;
    errMessage?: string;
    version?: string;
    downloadUrl?: string;
}

function getDevtrackBaseUrl(): string {
    return vscode.workspace.getConfiguration('phpcf').get('devtrackBaseUrl', 'https://devcloud.cresenity.com');
}

const MAX_REDIRECTS = 5;

/**
 * GET that follows redirects. `https.get` does not follow them on its own, and
 * a devcloud host that 301s to its canonical name would otherwise be read as a
 * successful response whose body is the redirect HTML - surfacing as a JSON
 * parse error that says nothing about the real cause.
 */
function httpGet(url: string, timeout: number, redirectsLeft = MAX_REDIRECTS): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
        const get = url.startsWith('http:') ? http.get : https.get;

        get(url, { timeout }, (res) => {
            const status = res.statusCode || 0;
            const location = res.headers.location;

            if (status >= 300 && status < 400 && location) {
                res.resume();

                if (redirectsLeft <= 0) {
                    reject(new Error(`Too many redirects while requesting ${url}`));
                    return;
                }

                resolve(httpGet(new URL(location, url).toString(), timeout, redirectsLeft - 1));
                return;
            }

            if (status >= 400) {
                res.resume();
                reject(new Error(`Request to ${url} failed with status ${status}`));
                return;
            }

            resolve(res);
        })
            .on('timeout', () => reject(new Error(`Request to ${url} timed out`)))
            .on('error', reject);
    });
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await httpGet(url, 10000);

    const body = await new Promise<string>((resolve, reject) => {
        let buffer = '';
        res.on('data', (chunk) => (buffer += chunk));
        res.on('end', () => resolve(buffer));
        res.on('error', reject);
    });

    try {
        return JSON.parse(body) as T;
    } catch {
        // Quote what actually arrived - "Unexpected token <" alone sends people
        // hunting for a bug in the extension instead of a wrong base URL.
        throw new Error(`${url} did not return JSON. Response started with: ${body.slice(0, 80)}`);
    }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
    const res = await httpGet(url, 60000);

    try {
        await new Promise<void>((resolve, reject) => {
            const file = fs.createWriteStream(destPath);

            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
            file.on('error', reject);
            res.on('error', reject);
        });
    } catch (error) {
        // A half-written .vsix installs as a corrupt extension - leave nothing behind.
        fs.rmSync(destPath, { force: true });
        throw error;
    }
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
        const wasInstalled = isDevtrackInstalled();
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

        // A first install activates on its own - nothing of it is loaded yet,
        // so there is nothing to restart.
        if (!wasInstalled) {
            vscode.window.showInformationMessage(`DevTrack v${version.version} installed and ready.`);
            return;
        }

        // An update cannot replace the running code in place, but only the
        // extension host has to restart - not the whole window. Editors,
        // layout and terminals survive that.
        const restart = await vscode.window.showInformationMessage(
            `DevTrack updated to v${version.version}. Restart extensions to finish?`,
            'Restart Extensions'
        );

        if (restart === 'Restart Extensions') {
            await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
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

function getInstalledDevtrackVersion(): string | undefined {
    return vscode.extensions.getExtension(DEVTRACK_EXTENSION_ID)?.packageJSON.version;
}

/**
 * Compares two `x.y.z` version strings numerically, part by part - a plain
 * string compare would rank "1.9.0" before "1.10.0".
 */
function isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;

        if (l !== c) {
            return l > c;
        }
    }

    return false;
}

/**
 * User-triggered check: installs DevTrack if missing, otherwise compares the
 * installed version against devcloud's published one and offers to update.
 */
export async function checkDevtrackUpdate(): Promise<void> {
    if (!isDevtrackInstalled()) {
        const choice = await vscode.window.showInformationMessage(
            'DevTrack (Cresenity time tracking) is not installed. Install it now?',
            'Install DevTrack',
            'Not Now'
        );

        if (choice === 'Install DevTrack') {
            await installDevtrack();
        }

        return;
    }

    const installedVersion = getInstalledDevtrackVersion();

    try {
        const baseUrl = getDevtrackBaseUrl();
        const version = await fetchJson<VersionResponse>(`${baseUrl}/devtrack/extension/version`);

        if (version.errCode !== 0 || !version.version) {
            vscode.window.showErrorMessage(
                `Could not check DevTrack version: ${version.errMessage || 'no build published yet'}`
            );
            return;
        }

        if (!installedVersion || !isNewerVersion(version.version, installedVersion)) {
            vscode.window.showInformationMessage(
                `DevTrack is up to date (v${installedVersion || '?'}).`
            );
            return;
        }

        const choice = await vscode.window.showInformationMessage(
            `DevTrack update available: v${installedVersion} → v${version.version}. Update now?`,
            'Update Now',
            'Not Now'
        );

        if (choice === 'Update Now') {
            await installDevtrack();
        }
    } catch (error) {
        logger.error(error instanceof Error ? error : String(error));
        vscode.window.showErrorMessage(
            'Failed to check DevTrack version. See the CF PHP output channel for details.'
        );
    }
}
