'use strict';

import {describe, expect, it} from 'vitest';

import {householdIncludesUserId} from './household-transfer';

describe('householdIncludesUserId', () => {
  const membership = {
    members: [
      {userId: '100', fullName: 'Primary'},
      {userId: '200', fullName: 'Associate'}
    ]
  };

  it('detects primary and associates', () => {
    expect(householdIncludesUserId(membership, '100')).toBe(true);
    expect(householdIncludesUserId(membership, '200')).toBe(true);
    expect(householdIncludesUserId(membership, '300')).toBe(false);
  });
});
