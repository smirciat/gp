'use strict';

const {fn, col, where, Op} = require('sequelize');

/** Strip apostrophes/backticks so O'Sullivan matches OSullivan (#200). */
export function normalizeNameSearchToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '');
}

function strippedFullNameColumn() {
  return fn(
    'REPLACE',
    fn('REPLACE', fn('LOWER', col('fullName')), "'", ''),
    '`',
    ''
  );
}

/** Sequelize predicate: normalized fullName ILIKE %token%. */
export function normalizedFullNameIlike(token) {
  const term = normalizeNameSearchToken(token);
  if (!term) return null;
  return where(strippedFullNameColumn(), {[Op.iLike]: '%' + term + '%'});
}

export function buildFullNameSearchWhere(firstName, lastName) {
  const parts = [];
  const first = firstName ? String(firstName).trim() : '';
  const last = lastName ? String(lastName).trim() : '';
  if (first) {
    const clause = normalizedFullNameIlike(first);
    if (clause) parts.push(clause);
  }
  if (last) {
    const clause = normalizedFullNameIlike(last);
    if (clause) parts.push(clause);
  }
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return {[Op.and]: parts};
}

export function buildFreeTextNameOrWhere(freeText) {
  const term = normalizeNameSearchToken(freeText);
  if (!term) return null;
  const pattern = '%' + term + '%';
  return {
    [Op.or]: [
      {userId: {[Op.iLike]: pattern}},
      {email: {[Op.iLike]: pattern}},
      where(strippedFullNameColumn(), {[Op.iLike]: pattern}),
      {account: {[Op.iLike]: pattern}}
    ]
  };
}
