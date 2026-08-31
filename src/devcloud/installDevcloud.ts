import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import logger from '../logger';

/** Superseded 2026-08-30 by `cresenity.devcloud` - kept only so a leftover install can be found and removed. */
const LEGACY_DEVTRACK_EXTENSION_ID = 'cresenity.devtrack';
const DEVCLOUD_EXTENSION_ID = 'cresenity.devcloud';

interface VersionResponse {
    errCode: number;
    errMessage?: string;
    version?: string;
    downloadUrl?: string;
}

/**
 * `phpcf.devtrackBaseUrl` was renamed to `phpcf.devcloudBaseUrl` - removed
 * from package.json's schema, but VS Code still returns whatever a user
 * already had in their own settings.json for an undeclared key. Falls back
 * to it only when the new key was never explicitly set, so anyone who
 * pointed this at something other than the default (e.g. a dev instance)
 * doesn't silently lose that on update.
 */
function getDevcloudBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('phpcf');
    const legacyBaseUrl = config.get<string>('devtrackBaseUrl');

    return config.get('devcloudBaseUrl', legacyBaseUrl || 'https://devcloud.cresenity.com');
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

export function isDevcloudInstalled(): boolean {
    return vscode.extensions.getExtension(DEVCLOUD_EXTENSION_ID) !== undefined;
}

function isLegacyDevtrackInstalled(): boolean {
    return vscode.extensions.getExtension(LEGACY_DEVTRACK_EXTENSION_ID) !== undefined;
}

/**
 * Removes the pre-2026-08-30 `cresenity.devtrack` install, if any, now that
 * `cresenity.devcloud` is installed. VS Code treats a changed extension id as
 * a completely different extension - it will never replace the old one on
 * its own, so this is the only automatic path off of it (the other install
 * path, the new extension's own self-update, cannot uninstall itself
 * cleanly - see that repo's CLAUDE.md). Never fails the calling install.
 */
async function uninstallLegacyDevtrackIfPresent(): Promise<void> {
    if (!isLegacyDevtrackInstalled()) {
        return;
    }

    try {
        await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', LEGACY_DEVTRACK_EXTENSION_ID);
        logger.info(`Uninstalled legacy extension ${LEGACY_DEVTRACK_EXTENSION_ID}`);
    } catch (error) {
        // Non-fatal: the new extension is already installed and working:
        // failing to clean up the old one is a cosmetic duplicate, not a
        // broken install.
        logger.error(error instanceof Error ? error : String(error));
    }
}

/**
 * Downloads the latest Devcloud .vsix from devcloud (not published to the
 * Marketplace, so this is the only way to get it) and installs it via the
 * same command VS Code uses for Marketplace installs.
 */
export async function installDevcloud(): Promise<void> {
    try {
        const wasInstalled = isDevcloudInstalled();
        const baseUrl = getDevcloudBaseUrl();
        const version = await fetchJson<VersionResponse>(`${baseUrl}/devcloud/extension/version`);

        if (version.errCode !== 0 || !version.downloadUrl) {
            vscode.window.showErrorMessage(
                `Could not fetch Devcloud extension: ${version.errMessage || 'no build published yet'}`
            );
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Installing Devcloud extension...' },
            async () => {
                const vsixPath = path.join(os.tmpdir(), `devcloud-${version.version}.vsix`);

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

        await uninstallLegacyDevtrackIfPresent();

        // A first install activates on its own - nothing of it is loaded yet,
        // so there is nothing to restart.
        if (!wasInstalled) {
            vscode.window.showInformationMessage(`Devcloud extension v${version.version} installed and ready.`);
            return;
        }

        // An update cannot replace the running code in place, but only the
        // extension host has to restart - not the whole window. Editors,
        // layout and terminals survive that.
        const restart = await vscode.window.showInformationMessage(
            `Devcloud extension updated to v${version.version}. Restart extensions to finish?`,
            'Restart Extensions'
        );

        if (restart === 'Restart Extensions') {
            await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
        }
    } catch (error) {
        logger.error(error instanceof Error ? error : String(error));
        vscode.window.showErrorMessage(
            'Failed to install the Devcloud extension. See the CF PHP output channel for details.'
        );
    }
}

/** Shown once on activation if Devcloud isn't installed yet - not an error, just a nudge. */
export async function checkDevcloudInstalled(): Promise<void> {
    if (isDevcloudInstalled()) {
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        'Devcloud (Cresenity time tracking) is not installed. Install it now?',
        'Install Devcloud',
        'Not Now'
    );

    if (choice === 'Install Devcloud') {
        await installDevcloud();
    }
}

function getInstalledDevcloudVersion(): string | undefined {
    return vscode.extensions.getExtension(DEVCLOUD_EXTENSION_ID)?.packageJSON.version;
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
 * User-triggered check: installs Devcloud if missing, otherwise compares the
 * installed version against devcloud's published one and offers to update.
 */
export async function checkDevcloudUpdate(): Promise<void> {
    if (!isDevcloudInstalled()) {
        const choice = await vscode.window.showInformationMessage(
            'Devcloud (Cresenity time tracking) is not installed. Install it now?',
            'Install Devcloud',
            'Not Now'
        );

        if (choice === 'Install Devcloud') {
            await installDevcloud();
        }

        return;
    }

    const installedVersion = getInstalledDevcloudVersion();

    try {
        const baseUrl = getDevcloudBaseUrl();
        const version = await fetchJson<VersionResponse>(`${baseUrl}/devcloud/extension/version`);

        if (version.errCode !== 0 || !version.version) {
            vscode.window.showErrorMessage(
                `Could not check Devcloud extension version: ${version.errMessage || 'no build published yet'}`
            );
            return;
        }

        if (!installedVersion || !isNewerVersion(version.version, installedVersion)) {
            vscode.window.showInformationMessage(
                `Devcloud extension is up to date (v${installedVersion || '?'}).`
            );
            return;
        }

        const choice = await vscode.window.showInformationMessage(
            `Devcloud extension update available: v${installedVersion} → v${version.version}. Update now?`,
            'Update Now',
            'Not Now'
        );

        if (choice === 'Update Now') {
            await installDevcloud();
        }
    } catch (error) {
        logger.error(error instanceof Error ? error : String(error));
        vscode.window.showErrorMessage(
            'Failed to check the Devcloud extension version. See the CF PHP output channel for details.'
        );
    }
}
