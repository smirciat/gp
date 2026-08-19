'use strict';

const crypto = require('crypto');
import localEnv from '../../config/local.env';

const twilio = require('twilio')(
  localEnv.TWILIO_ACCOUNT_SID,
  localEnv.TWILIO_AUTH_TOKEN
);

const TTL_MS = 15 * 60 * 1000;
let pendingCodes = [];

function pruneExpired(now = Date.now()) {
  pendingCodes = pendingCodes.filter((row) => row.exp > now);
}

export function phoneLast4(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export async function sendTransferSms({userId, phone} = {}) {
  const id = userId != null ? String(userId).trim() : '';
  const to = phone != null ? String(phone).trim() : '';
  if (!id || !to) {
    const err = new Error(
      'We need a phone number associated with your account to authenticate a transfer.'
    );
    err.status = 400;
    err.code = 'no_phone';
    throw err;
  }

  const code = crypto.randomInt(100000, 1000000);
  const now = Date.now();
  pruneExpired(now);
  pendingCodes = pendingCodes.filter((row) => row.userId !== id);
  pendingCodes.push({userId: id, code, exp: now + TTL_MS});

  const msg =
    'NOREPLY: Bering Air Gold Points Authentication token is ' +
    code +
    ' Enter it in the browser to confirm your transfer.';

  try {
    await twilio.messages.create({
      from: localEnv.TWILIO_PHONE_NUMBER,
      to,
      body: msg
    });
  } catch (err) {
    console.log(err);
    const fail = new Error('SMS message failed to send');
    fail.status = 502;
    fail.code = 'sms_failed';
    throw fail;
  }

  return {sent: true, phoneLast4: phoneLast4(to)};
}

export function consumeTransferCode(userId, code) {
  const id = userId != null ? String(userId).trim() : '';
  const entered = Number(code);
  pruneExpired();
  const index = pendingCodes.findIndex((row) => row.userId === id);
  if (index < 0) {
    const err = new Error('No verification code available for this member.');
    err.status = 400;
    err.code = 'verification_failed';
    throw err;
  }
  if (pendingCodes[index].code !== entered) {
    const err = new Error('Six digit code did not match, try again.');
    err.status = 400;
    err.code = 'verification_failed';
    throw err;
  }
  pendingCodes.splice(index, 1);
  return true;
}
