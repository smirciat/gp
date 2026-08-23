/**
 * Main application routes
 */

'use strict';

import errors from './components/errors';
import localEnv from './config/local.env';
import https from'https';
import path from 'path';
import lusca from 'lusca';
import bodyParser from 'body-parser';
export let str="str";

export default function(app) {
  //needed for webhooks route
  app.use(bodyParser.json({ type: '*/*' }));
  app.use('/api/transactions/webhooks', require('./api/transaction/indexWebhooks'));
  app.use('/api/integrations/resbering/v1', require('./api/integration/indexResBering'));
  app.use('/api/integrations/bering-public/v1', require('./api/integration/indexBeringPublic'));

  app.get('/api/meta/site', function(req, res) {
    res.json({
      staffUiRetired: String(localEnv.GP_STAFF_UI_RETIRED || '') === '1',
      staffOpsUrl:
        (localEnv.GP_STAFF_OPS_URL &&
          String(localEnv.GP_STAFF_OPS_URL).trim()) ||
        'https://reservations.beringair.com/gold-points',
      guestUiRetired: String(localEnv.GP_GUEST_UI_RETIRED || '') === '1',
      guestPublicUrl:
        (localEnv.GP_GUEST_PUBLIC_URL &&
          String(localEnv.GP_GUEST_PUBLIC_URL).trim()) ||
        'https://public.beringair.com/public/gold-points',
    });
  });

  app.use(lusca.csrf({angular:true}));
  // Insert routes below
  app.use('/api/events', require('./api/event'));
  app.use('/api/flights', require('./api/flight'));
  app.use('/api/transactions', require('./api/transaction'));
  app.use('/api/customers', require('./api/customer'));
  app.use('/api/things', require('./api/thing'));
  app.use('/api/users', require('./api/user'));

  app.use('/auth', require('./auth').default);

  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*')
   .get(errors[404]);
      
  app.get(/^\/(?!api|auth).*$/, function(req, res, next) {

    // reject obvious scan requests
    if (req.path.match(/\.[a-z0-9]+$/i)) {
      return res.status(404).send('Not Found');
  }
    res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    //res.sendFile(path.resolve(appConfig.root + '/client/index.html'));
  });
}

function handleFlightCompleted(flight) {
    console.log('Processing completed flight:', flight.flightNumber);
  
    // Your business logic here
  }
