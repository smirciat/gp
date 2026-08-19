'use strict';

// Use local.env.js for environment variables that grunt will set when the server starts locally.
// Use for your api keys, secrets, etc. This file should not be tracked by git.
//
// You will need to set these on the server you deploy to.

module.exports = {
  DOMAIN:           'http://localhost:9000',
  SESSION_SECRET:   'goldpoints-secret',

  // Control debug level for modules using visionmedia/debug
  DEBUG: '',

  // Integration API tokens (Bearer or X-GP-Integration-Key header) — mount before CSRF in routes.js
  RESBERING_INTEGRATION_TOKEN: '',
  BERING_PUBLIC_INTEGRATION_TOKEN: '',

  // Optional comma-separated browser origins for integration clients
  INTEGRATION_CORS_ORIGINS: '',

  // Phase A staff cutover (#167): set to '1' to hide legacy staff hub; members stay on guest UI.
  GP_STAFF_UI_RETIRED: '',
  GP_STAFF_OPS_URL: 'https://reservations.beringair.com/gold-points'
};
