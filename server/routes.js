/**
 * Main application routes
 */

'use strict';

import errors from './components/errors';
import localEnv from './config/local.env';
import path from 'path';
import lusca from 'lusca';
import bodyParser from 'body-parser';
export let str="str";

export default function(app) {
  
  app.use(bodyParser.json({ type: '*/*' }));
  
  app.options('/webhooks', (req, res) => {
  res.set({
    'Allow': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret'
  });

  res.sendStatus(204);
});

app.post('/webhooks', (req, res) => {
  
  //const secret = req.headers['x-webhook-secret'];

  //if (secret !== localEnv.takefliteWebhookSecret) {
    //return res.status(401).send('Unauthorized');
  //}
  
  try {
    const event = req.body;

    // Basic validation
    if (!event.specversion || !event.type || !event.id) {
      return res.status(400).json({
        error: 'Invalid CloudEvent'
      });
    }

    console.log('CloudEvent received');
    console.log('ID:', event.id);
    console.log('Type:', event.type);
    console.log('Source:', event.source);
    console.log('Tenant:', event.tenantid);
    console.log('Subject:', event.subject);
    console.log('Time:', event.time);

    // Event payload
    const flight = event.data;

    console.log('Flight ID:', flight.id);
    console.log('Flight Number:', flight.flightNumber);
    console.log('Departure:', flight.scheduledDepartureTime);
    console.log('Arrival:', flight.scheduledArrivalTime);

    // Route by event type
    switch (event.type) {

      case 'Takeflite.Operations.AircraftControl.FlightCompleted':
        handleFlightCompleted(flight);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(204).send();

  } catch (err) {
    console.error('Webhook processing failed:', err);
    res.status(500).send();
  }
});
  
  app.use(lusca.csrf({angular:true}));
  // Insert routes below
  app.use('/api/transactions', require('./api/transaction'));
  app.use('/api/customers', require('./api/customer'));
  app.use('/api/things', require('./api/thing'));
  app.use('/api/users', require('./api/user'));

  app.use('/auth', require('./auth').default);

  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*')
   .get(errors[404]);

  // All other routes should redirect to the index.html
  app.route('/*')
    .get((req, res) => {
      res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    });
}

function handleFlightCompleted(flight) {
    console.log('Processing completed flight:', flight.flightNumber);
  
    // Your business logic here
  }
