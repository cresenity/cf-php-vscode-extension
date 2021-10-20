import { getUserSetting } from '../host';

export function getExtensionSetting() {
  return getUserSetting('phpcf');
}
