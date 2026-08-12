'use strict';

import {Flight} from '../../sqldb';

function normalizeFlightNumber(value) {
  if (!value) return '';
  return String(value).trim().split('.')[0];
}

function normalizeDateString(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).trim();
  return date.toLocaleDateString();
}

function gpPassengerShape(row) {
  const bookingNumber = row.bookingNumber || '';
  const boardPoint = row.boardPoint || {};
  const offPoint = row.offPoint || {};
  const name = row.name || {};
  const boardCode = boardPoint.code || boardPoint.name || '';
  const offCode = offPoint.code || offPoint.name || '';
  return {
    bookingNumber,
    name: {
      firstName: name.firstName || '',
      lastName: name.lastName || ''
    },
    boardPoint: {
      code: boardCode,
      name: boardPoint.name || boardCode
    },
    offPoint: {
      code: offCode,
      name: offPoint.name || offCode
    },
    description: row.description || '',
    standby: !!row.standby,
    confirmedForGoldPoints: row.confirmedForGoldPoints !== false,
    checkedIn: !!row.checkedIn,
    boarded: !!row.boarded,
    localOverlay: !!row.localOverlay,
    resBeringExportedAt: row.exportedAt || null
  };
}

export async function upsertFlightManifestFromResBering(body) {
  const dateString = normalizeDateString(body.dateString);
  const flightNumber = normalizeFlightNumber(body.flightNumber);
  if (!dateString || !flightNumber) {
    const error = new Error('dateString and flightNumber are required.');
    error.status = 400;
    throw error;
  }

  const passengers = (body.passengers || []).map(gpPassengerShape);
  const standbyPassengers = (body.standbyPassengers || []).map(gpPassengerShape);
  const flightJson = {
    flightNumber,
    dateString,
    status: body.status || 'Completed',
    passengers,
    standbyPassengers,
    flightLegs: body.flightLegs || [],
    resBeringFlightId: body.resBeringFlightId || null,
    resBeringExportedAt: body.exportedAt || new Date().toISOString(),
    source: 'reservations-bering'
  };

  let row = await Flight.findOne({
    where: {dateString, flightNumber}
  });

  if (row) {
    await row.update({
      flight: flightJson,
      date: new Date(dateString)
    });
    return {
      created: false,
      flightId: row._id,
      passengerCount: passengers.length,
      standbyCount: standbyPassengers.length
    };
  }

  row = await Flight.create({
    dateString,
    flightNumber,
    date: new Date(dateString),
    flight: flightJson
  });

  return {
    created: true,
    flightId: row._id,
    passengerCount: passengers.length,
    standbyCount: standbyPassengers.length
  };
}
