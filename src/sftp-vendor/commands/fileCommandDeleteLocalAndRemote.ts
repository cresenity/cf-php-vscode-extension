import { COMMAND_DELETE_LOCAL_AND_REMOTE } from '../constants';
import { upath } from '../core';
import { removeLocalAndRemote } from '../fileHandlers';
import { showConfirmMessage } from '../host';
import { checkFileCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';

export default checkFileCommand({
  id: COMMAND_DELETE_LOCAL_AND_REMOTE,
  async getFileTarget(item, items) {
    const targets = await uriFromExplorerContextOrEditorContext(item, items);

    if (!targets) {
      return;
    }

    const filename = Array.isArray(targets)
      ? targets.map(t => upath.basename(t.fsPath)).join(',')
      : upath.basename(targets.fsPath);
    const result = await showConfirmMessage(
      `Are you sure you want to delete '${filename}' locally and on the remote server?`,
      'Delete',
      'Cancel'
    );

    return result ? targets : undefined;
  },

  handleFile: removeLocalAndRemote,
});
