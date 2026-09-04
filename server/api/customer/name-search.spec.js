'use strict';

import {describe, expect, it} from 'vitest';
import {normalizeNameSearchToken} from './name-search';

describe('normalizeNameSearchToken', () => {
  it('strips apostrophes so O Sullivan matches (#200)', () => {
    expect(normalizeNameSearchToken("O'Sullivan")).toBe('osullivan');
    expect(normalizeNameSearchToken('OSullivan')).toBe('osullivan');
    expect(normalizeNameSearchToken('  Robert  ')).toBe('robert');
  });
});
