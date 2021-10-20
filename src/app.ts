import * as LRU from 'lru-cache';
import StatusBar from './ui/StatusBar';
import { COMMAND_TOGGLE_OUTPUT } from './constant';
import AppState from './modules/AppState';

interface App {
  fsCache: LRU<string, string>;
  state: AppState;
  statusBar: StatusBar;
}

const app: App = Object.create(null);

app.state = new AppState();
app.statusBar = new StatusBar(
  () => {
    if (app.state.profile) {
      return `phpcf: ${app.state.profile}`;
    } else {
      return 'phpcf';
    }
  },
  'phpcf@cresenity',
  COMMAND_TOGGLE_OUTPUT
);
app.fsCache = new LRU<string, string>({ max: 6 });

export default app;