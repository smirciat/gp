/**
 * Transaction model events
 */

'use strict';

import {EventEmitter} from 'events';
var Transaction = require('../../sqldb').Transaction;
var TransactionEvents = new EventEmitter();

// Set max event listeners (0 == unlimited)
TransactionEvents.setMaxListeners(0);

// Model events
var events = {
  'afterCreate': 'save',
  'afterUpdate': 'save',
  'afterDestroy': 'remove'
};

// Register the event emitter to the model events
for (var e in events) {
  var event = events[e];
  Transaction.hook(e, emitEvent(event));
}

function emitEvent(event) {
  return function(doc, options, done) {
    TransactionEvents.emit(event + ':' + doc._id, doc);
    TransactionEvents.emit(event, doc);
    //done(null);
  }
}

export default TransactionEvents;
