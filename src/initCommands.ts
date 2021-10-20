
import { ExtensionContext } from 'vscode';
import logger from './logger';
import { registerCommand } from './host';
import Command from './commands/abstract/command';
import { createCommand } from './commands/abstract/createCommand';

import toggleOutputCommand from './commands/toggleOutputCommand';



export default function init(context: ExtensionContext) {
    loadCommand(context,toggleOutputCommand);
}


function loadCommand(context,commandOption) {
    const Cmd = createCommand(commandOption);
    const cmdInstance: Command = new Cmd();
    logger.debug(`register command "${commandOption.name}"`);
    registerCommand(context, commandOption.id, cmdInstance.run, cmdInstance);
}
