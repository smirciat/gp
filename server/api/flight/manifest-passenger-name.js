'use strict';

/**
 * Takeflite webhook manifests use name.first / name.last; API bodies use firstName / lastName.
 */
export function normalizeManifestPassengerName(name) {
  if (!name || typeof name !== 'object') {
    return { firstName: '', lastName: '' };
  }
  let firstName = String(name.firstName || name.first || '').trim();
  let lastName = String(name.lastName || name.last || '').trim();

  if (!firstName && !lastName && name.fullName) {
    const parts = String(name.fullName).trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }

  if (!firstName && lastName) {
    const arr = lastName.split(/\s+/);
    if (arr.length > 1) {
      firstName = arr.shift();
      lastName = arr.join(' ');
    }
  }
  if (firstName && !lastName) {
    const arr = firstName.split(/\s+/);
    if (arr.length > 1) {
      firstName = arr.shift();
      lastName = arr.join(' ');
    }
  }

  return { firstName, lastName };
}

export function applyManifestPassengerName(name) {
  const normalized = normalizeManifestPassengerName(name);
  if (!name || typeof name !== 'object') {
    return normalized;
  }
  name.firstName = normalized.firstName;
  name.lastName = normalized.lastName;
  if (normalized.firstName) name.first = normalized.firstName;
  if (normalized.lastName) name.last = normalized.lastName;
  return normalized;
}

export function normalizeFlightManifestPassengers(manifest) {
  if (!manifest || !manifest.flightLegs) return;
  manifest.flightLegs.forEach((leg) => {
    (leg.passengers || []).forEach((passenger) => {
      if (passenger.name) applyManifestPassengerName(passenger.name);
    });
  });
  if (manifest.passengers) {
    manifest.passengers.forEach((passenger) => {
      if (passenger.name) applyManifestPassengerName(passenger.name);
    });
  }
}
