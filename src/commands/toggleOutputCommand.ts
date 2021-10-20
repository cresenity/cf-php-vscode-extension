import { COMMAND_TOGGLE_OUTPUT } from '../constant';
import * as output from '../ui/output';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_TOGGLE_OUTPUT,

  handleCommand() {
    output.toggle();
  },
});