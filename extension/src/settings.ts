export type Setting = 'hints' | 'sound';

const key = (name: Setting) => `chess-review.${name}`;

/** A switch of the window, remembered in the extension's storage; on unless turned off. */
export function readSetting(name: Setting, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(key(name)) !== 'off';
  } catch {
    return true;
  }
}

export function writeSetting(name: Setting, on: boolean, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(key(name), on ? 'on' : 'off');
  } catch {
    // Blocked storage: the switch works for this window only.
  }
}
