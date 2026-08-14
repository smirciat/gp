'use strict';

import {runFullBalanceAudit} from './balance-audit.service';

function formatPartNumber(parts, type) {
  var match = parts.find(function(part) {
    return part.type === type;
  });
  if (match && match.value != null && match.value !== '') {
    return Number(match.value);
  }
  return 0;
}

function alaskaHourMinute() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Anchorage',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(new Date());
  const hour = formatPartNumber(parts, 'hour');
  const minute = formatPartNumber(parts, 'minute');
  return {hour, minute};
}

let lastRunDateKey = '';

function todayKeyAlaska() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Anchorage'
  }).format(new Date());
}

async function tickBalanceAudit() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  if (process.env.GP_BALANCE_AUDIT === '0') {
    return;
  }

  const {hour, minute} = alaskaHourMinute();
  if (hour !== 3 || minute > 5) {
    return;
  }

  const dateKey = todayKeyAlaska();
  if (lastRunDateKey === dateKey) {
    return;
  }
  lastRunDateKey = dateKey;

  try {
    const result = await runFullBalanceAudit();
    console.log(
      '[ cron ] GP balance audit complete:',
      result.mismatchCount,
      'mismatch(es) at',
      result.checkedAt
    );
  } catch (err) {
    console.error('[ cron ] GP balance audit failed', err);
    lastRunDateKey = '';
  }
}

export function scheduleBalanceAudit() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ cron ] GP balance audit: skipped (production only; GP_BALANCE_AUDIT=0 to disable on prod)');
    return;
  }
  if (process.env.GP_BALANCE_AUDIT === '0') {
    console.log('[ cron ] GP balance audit: disabled (GP_BALANCE_AUDIT=0)');
    return;
  }

  setInterval(tickBalanceAudit, 60 * 1000);
  console.log('[ cron ] GP balance audit: daily ~03:00 America/Anchorage (alert-only)');
}
