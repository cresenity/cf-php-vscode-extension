import { ExtensionContext } from 'vscode';
import logger from './logger';
import { registerCommand } from './host';
import Command from './commands/abstract/command';
import { createCommand, createFileCommand, createFileMultiCommand } from './commands/abstract/createCommand';

import commandCancelAllTransfer from './commands/commandCancelAllTransfer';
import commandConfig from './commands/commandConfig';
import commandListActiveFolder from './commands/commandListActiveFolder';
import commandOpenSshConnection from './commands/commandOpenSshConnection';
import commandSetProfile from './commands/commandSetProfile';
import commandToggleOutputPanel from './commands/commandToggleOutputPanel';
import commandUploadChangedFiles from './commands/commandUploadChangedFiles';

import fileCommandCreateFile from './commands/fileCommandCreateFile';
import fileCommandCreateFolder from './commands/fileCommandCreateFolder';
import fileCommandDeleteRemote from './commands/fileCommandDeleteRemote';
import fileCommandDeleteLocalAndRemote from './commands/fileCommandDeleteLocalAndRemote';
import fileCommandDiffActiveFile from './commands/fileCommandDiffActiveFile';
import fileCommandDiff from './commands/fileCommandDiff';
import fileCommandDownloadActiveFile from './commands/fileCommandDownloadActiveFile';
import fileCommandDownloadActiveFolder from './commands/fileCommandDownloadActiveFolder';
import fileCommandDownloadFile from './commands/fileCommandDownloadFile';
import fileCommandDownloadFolder from './commands/fileCommandDownloadFolder';
import fileCommandDownloadForce from './commands/fileCommandDownloadForce';
import fileCommandDownloadProject from './commands/fileCommandDownloadProject';
import fileCommandDownload from './commands/fileCommandDownload';
import fileCommandEditInLocal from './commands/fileCommandEditInLocal';
import fileCommandListAll from './commands/fileCommandListAll';
import fileCommandList from './commands/fileCommandList';
import fileCommandRevealInExplorer from './commands/fileCommandRevealInExplorer';
import fileCommandRevealInRemoteExplorer from './commands/fileCommandRevealInRemoteExplorer';
import fileCommandSyncBothDirections from './commands/fileCommandSyncBothDirections';
import fileCommandSyncLocalToRemote from './commands/fileCommandSyncLocalToRemote';
import fileCommandSyncRemoteToLocal from './commands/fileCommandSyncRemoteToLocal';
import fileCommandUploadActiveFile from './commands/fileCommandUploadActiveFile';
import fileCommandUploadActiveFolder from './commands/fileCommandUploadActiveFolder';
import fileCommandUploadFile from './commands/fileCommandUploadFile';
import fileCommandUploadFolder from './commands/fileCommandUploadFolder';
import fileCommandUploadForce from './commands/fileCommandUploadForce';
import fileCommandUploadProject from './commands/fileCommandUploadProject';
import fileCommandUpload from './commands/fileCommandUpload';

import fileMultiCommandUploadActiveFileToAllProfiles from './commands/fileMultiCommandUploadActiveFileToAllProfiles';
import fileMultiCommandUploadActiveFolderToAllProfiles from './commands/fileMultiCommandUploadActiveFolderToAllProfiles';
import fileMultiCommandUploadFileToAllProfiles from './commands/fileMultiCommandUploadFileToAllProfiles';
import fileMultiCommandUploadFolderToAllProfiles from './commands/fileMultiCommandUploadFolderToAllProfiles';
import fileMultiCommandUploadForceToAllProfiles from './commands/fileMultiCommandUploadForceToAllProfiles';
import fileMultiCommandUploadProjectToAllProfiles from './commands/fileMultiCommandUploadProjectToAllProfiles';
import fileMultiCommandUploadToAllProfiles from './commands/fileMultiCommandUploadToAllProfiles';

// vscode-sftp originally discovered these modules dynamically via webpack's
// require.context(). This project builds with plain tsc (no webpack), which has
// no equivalent, so the command modules are imported and listed explicitly instead.
const plainCommandModules: Array<[string, any]> = [
  ['commandCancelAllTransfer', commandCancelAllTransfer],
  ['commandConfig', commandConfig],
  ['commandListActiveFolder', commandListActiveFolder],
  ['commandOpenSshConnection', commandOpenSshConnection],
  ['commandSetProfile', commandSetProfile],
  ['commandToggleOutputPanel', commandToggleOutputPanel],
  ['commandUploadChangedFiles', commandUploadChangedFiles],
];

const fileCommandModules: Array<[string, any]> = [
  ['fileCommandCreateFile', fileCommandCreateFile],
  ['fileCommandCreateFolder', fileCommandCreateFolder],
  ['fileCommandDeleteRemote', fileCommandDeleteRemote],
  ['fileCommandDeleteLocalAndRemote', fileCommandDeleteLocalAndRemote],
  ['fileCommandDiffActiveFile', fileCommandDiffActiveFile],
  ['fileCommandDiff', fileCommandDiff],
  ['fileCommandDownloadActiveFile', fileCommandDownloadActiveFile],
  ['fileCommandDownloadActiveFolder', fileCommandDownloadActiveFolder],
  ['fileCommandDownloadFile', fileCommandDownloadFile],
  ['fileCommandDownloadFolder', fileCommandDownloadFolder],
  ['fileCommandDownloadForce', fileCommandDownloadForce],
  ['fileCommandDownloadProject', fileCommandDownloadProject],
  ['fileCommandDownload', fileCommandDownload],
  ['fileCommandEditInLocal', fileCommandEditInLocal],
  ['fileCommandListAll', fileCommandListAll],
  ['fileCommandList', fileCommandList],
  ['fileCommandRevealInExplorer', fileCommandRevealInExplorer],
  ['fileCommandRevealInRemoteExplorer', fileCommandRevealInRemoteExplorer],
  ['fileCommandSyncBothDirections', fileCommandSyncBothDirections],
  ['fileCommandSyncLocalToRemote', fileCommandSyncLocalToRemote],
  ['fileCommandSyncRemoteToLocal', fileCommandSyncRemoteToLocal],
  ['fileCommandUploadActiveFile', fileCommandUploadActiveFile],
  ['fileCommandUploadActiveFolder', fileCommandUploadActiveFolder],
  ['fileCommandUploadFile', fileCommandUploadFile],
  ['fileCommandUploadFolder', fileCommandUploadFolder],
  ['fileCommandUploadForce', fileCommandUploadForce],
  ['fileCommandUploadProject', fileCommandUploadProject],
  ['fileCommandUpload', fileCommandUpload],
];

const fileMultiCommandModules: Array<[string, any]> = [
  ['fileMultiCommandUploadActiveFileToAllProfiles', fileMultiCommandUploadActiveFileToAllProfiles],
  ['fileMultiCommandUploadActiveFolderToAllProfiles', fileMultiCommandUploadActiveFolderToAllProfiles],
  ['fileMultiCommandUploadFileToAllProfiles', fileMultiCommandUploadFileToAllProfiles],
  ['fileMultiCommandUploadFolderToAllProfiles', fileMultiCommandUploadFolderToAllProfiles],
  ['fileMultiCommandUploadForceToAllProfiles', fileMultiCommandUploadForceToAllProfiles],
  ['fileMultiCommandUploadProjectToAllProfiles', fileMultiCommandUploadProjectToAllProfiles],
  ['fileMultiCommandUploadToAllProfiles', fileMultiCommandUploadToAllProfiles],
];

export default function init(context: ExtensionContext) {
  loadCommands(plainCommandModules, /command(.*)/, createCommand, context);
  loadCommands(fileCommandModules, /fileCommand(.*)/, createFileCommand, context);
  loadCommands(fileMultiCommandModules, /fileMultiCommand(.*)/, createFileMultiCommand, context);
}

function nomalizeCommandName(rawName) {
  const firstLetter = rawName[0].toUpperCase();
  return firstLetter + rawName.slice(1).replace(/[A-Z]/g, token => ` ${token[0]}`);
}

function loadCommands(
  modules: Array<[string, any]>,
  nameRegex: RegExp,
  commandCreator,
  context: ExtensionContext
) {
  modules.forEach(([clearName, moduleExports]) => {
    const match = nameRegex.exec(clearName);
    if (!match || !match[1]) {
      logger.warn(`Command name not found from ${clearName}`);
      return;
    }

    const commandOption = moduleExports;
    commandOption.name = nomalizeCommandName(match[1]);

    try {
      // tslint:disable-next-line variable-name
      const Cmd = commandCreator(commandOption);
      const cmdInstance: Command = new Cmd();
      logger.debug(`register command "${commandOption.name}" from "${clearName}"`);
      registerCommand(context, commandOption.id, cmdInstance.run, cmdInstance);
    } catch (error) {
      logger.error(error, `load command "${clearName}"`);
    }
  });
}
