// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readSetting, writeSetting } from './settings';

beforeEach(() => {
  localStorage.clear();
});

describe('settings', () => {
  it('are on until turned off', () => {
    expect(readSetting('hints')).toBe(true);
    expect(readSetting('sound')).toBe(true);
  });

  it('remember a switch turned off, and on again', () => {
    writeSetting('hints', false);
    expect(readSetting('hints')).toBe(false);
    writeSetting('hints', true);
    expect(readSetting('hints')).toBe(true);
  });

  it('keep each switch apart', () => {
    writeSetting('sound', false);

    expect(readSetting('hints')).toBe(true);
    expect(readSetting('sound')).toBe(false);
  });

  it('work without storage: on, and switching does not throw', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('blocked');
      },
    };

    expect(readSetting('hints', blocked)).toBe(true);
    expect(() => writeSetting('hints', false, blocked)).not.toThrow();
  });
});
