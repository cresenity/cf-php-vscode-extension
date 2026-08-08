import { COMMAND_SYNC_LOCAL_TO_REMOTE_LOCAL_PRIORITY } from '../constants';
import { sync2RemoteLocalPriority } from '../fileHandlers';
import { checkFileCommand } from './abstract/createCommand';
import { selectFolderFallbackToConfigContext, uriFromfspath, applySelector } from './shared';

export default checkFileCommand({
  id: COMMAND_SYNC_LOCAL_TO_REMOTE_LOCAL_PRIORITY,
  getFileTarget: applySelector(uriFromfspath, selectFolderFallbackToConfigContext),

  handleFile: sync2RemoteLocalPriority,
});
