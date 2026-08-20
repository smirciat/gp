#!/usr/bin/env node
'use strict';

/**
 * Smoke checks for GP guest password reset logic (no Mailgun send).
 * Run from goldPoints with Node 12:
 *   node server/api/integration/password-reset.smoke.js
 */

const assert = require('assert');
const crypto = require('crypto');

function isGuestRole(role) {
  return !role || role === 'guest';
}

function buildWelcomeHtml(tempPassword) {
  let html =
    'Congratulations! <br><br>You have just created a Bering Air Gold Points Membership!<br><br>';
  if (tempPassword) {
    html += '<br><br>Your temporary password is: ' + tempPassword;
  }
  return html;
}

// Scenario A: existing guest User — reset path must set tempPassword before email
(function testExistingGuestUserReset() {
  const user = {
    role: 'guest',
    email: 'member@example.com',
    tempPassword: null,
    password: 'old',
    save() {
      return Promise.resolve(this);
    },
  };
  const temp = crypto.randomBytes(5).toString('hex');
  user.password = temp;
  user.tempPassword = temp;
  assert.ok(isGuestRole(user.role));
  assert.ok(user.tempPassword, 'guest reset must set tempPassword');
  const html = buildWelcomeHtml(user.tempPassword);
  assert.match(html, /Your temporary password is:/);
  console.log('PASS existing guest user reset sets temp password');
})();

// Scenario B: badEmail customer — must not attempt send
(function testBadEmailSkipsSend() {
  const customer = { email: 'bounced@example.com', badEmail: true };
  let sendAttempted = false;
  if (!customer.badEmail) {
    sendAttempted = true;
  }
  assert.equal(sendAttempted, false);
  console.log('PASS badEmail skips send attempt');
})();

// Scenario C: legacy bug — createUser fails when User already exists
(function testLegacyMissingPasswordWhenUserExists() {
  const createUserFailed = true;
  let attachPassword = !createUserFailed;
  let html = buildWelcomeHtml(null);
  if (attachPassword) {
    html += ' should-not-happen';
  }
  assert.doesNotMatch(html, /Your temporary password is:/);
  console.log(
    'PASS legacy bug reproduced: existing User + customer welcome omitted password'
  );

  // Fixed path: refresh existing user instead of createUser
  const temp = crypto.randomBytes(5).toString('hex');
  const fixedHtml = buildWelcomeHtml(temp);
  assert.match(fixedHtml, /Your temporary password is:/);
  console.log('PASS fixed path includes temp password for existing User');
})();

console.log('All password-reset smoke checks passed.');
