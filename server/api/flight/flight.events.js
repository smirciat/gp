/**
 * Flight model events
 */

'use strict';

import {EventEmitter} from 'events';
var Flight = require('../../sqldb').Flight;
var FlightEvents = new EventEmitter();

// Set max event listeners (0 == unlimited)
FlightEvents.setMaxListeners(0);

// Model events
var events = {
  'afterCreate': 'save',
  'afterUpdate': 'save',
  'afterDestroy': 'remove'
};

// Register the event emitter to the model events
for (var e in events) {
  var event = events[e];
  Flight.addHook(e, emitEvent(event));
}

function emitEvent(event) {
  return async function(doc, options, done) {
    FlightEvents.emit(event + ':' + doc._id, doc);
    FlightEvents.emit(event, doc);
    //done(null);
  };
}

export default FlightEvents;
