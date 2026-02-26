const db = require('../db/connection');
const { haversineDistance } = require('../utils/geo');

const MAX_RADIUS_KM = 5;
const REQUEST_TIMEOUT_SEC = 15;
const MAX_ATTEMPTS = 5;

/**
 * Driver matching algorithm:
 * 1. Find online drivers with matching vehicle type within 5km
 * 2. Score by: distance (50%), rating (30%), acceptance rate (20%)
 * 3. Send request to top driver with 15-second timeout
 * 4. If declined/expired, try next driver
 * 5. After 5 failures → no drivers available
 */
async function findAndAssignDriver(rideId) {
  const ride = await db('rides').where({ id: rideId }).first();
  if (!ride || ride.status !== 'searching') return;

  const pickupLat = parseFloat(ride.pickup_lat);
  const pickupLng = parseFloat(ride.pickup_lng);

  // Find eligible drivers
  const candidates = await db('drivers')
    .where({ status: 'online', is_verified: true })
    .join('vehicles', 'drivers.vehicle_id', 'vehicles.id')
    .where('vehicles.vehicle_type', ride.vehicle_type_requested)
    .where('vehicles.is_active', true)
    .join('operators', 'drivers.operator_id', 'operators.id')
    .where('operators.is_active', true)
    .select('drivers.*');

  // Filter by distance and score
  const scored = candidates
    .map((driver) => {
      const distance = haversineDistance(
        pickupLat, pickupLng,
        parseFloat(driver.current_lat), parseFloat(driver.current_lng),
      );
      if (distance > MAX_RADIUS_KM) return null;

      // Normalize scores (lower distance = higher score)
      const distanceScore = (1 - distance / MAX_RADIUS_KM) * 0.5;
      const ratingScore = (parseFloat(driver.rating_avg) / 5) * 0.3;
      const acceptanceScore = (parseFloat(driver.acceptance_rate) / 100) * 0.2;

      return {
        ...driver,
        distance,
        score: distanceScore + ratingScore + acceptanceScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    await db('rides').where({ id: rideId }).update({ status: 'cancelled', cancellation_reason: 'No drivers available' });
    notifyPassenger(ride.passenger_id, 'ride_status_update', { ride_id: rideId, status: 'cancelled', reason: 'No drivers available' });
    return;
  }

  // Try drivers one by one
  const alreadyDeclined = await db('ride_requests')
    .where({ ride_id: rideId })
    .whereIn('status', ['declined', 'expired'])
    .pluck('driver_id');

  const eligible = scored.filter((d) => !alreadyDeclined.includes(d.id));
  let attempts = 0;

  for (const driver of eligible) {
    if (attempts >= MAX_ATTEMPTS) break;

    // Re-check ride status (may have been cancelled)
    const currentRide = await db('rides').where({ id: rideId }).first();
    if (currentRide.status !== 'searching') return;

    // Create ride request
    const expiresAt = new Date(Date.now() + REQUEST_TIMEOUT_SEC * 1000);
    const [request] = await db('ride_requests').insert({
      ride_id: rideId,
      driver_id: driver.id,
      status: 'pending',
      expires_at: expiresAt,
    }).returning('*');

    // Notify driver via WebSocket
    notifyDriver(driver.id, 'new_ride_request', {
      request_id: request.id,
      pickup: { lat: pickupLat, lng: pickupLng, address: ride.pickup_address },
      dropoff: { lat: parseFloat(ride.dropoff_lat), lng: parseFloat(ride.dropoff_lng), address: ride.dropoff_address },
      fare: parseFloat(ride.estimated_fare),
      passenger_name: await getPassengerName(ride.passenger_id),
      distance_km: driver.distance.toFixed(1),
      expires_in: REQUEST_TIMEOUT_SEC,
    });

    // Wait for response or timeout
    const accepted = await waitForResponse(request.id, REQUEST_TIMEOUT_SEC);
    if (accepted) return; // Driver accepted, ride is assigned

    attempts++;
  }

  // All attempts exhausted
  await db('rides').where({ id: rideId }).update({ status: 'cancelled', cancellation_reason: 'No drivers available' });
  notifyPassenger(ride.passenger_id, 'ride_status_update', { ride_id: rideId, status: 'cancelled', reason: 'No drivers available' });
}

async function waitForResponse(requestId, timeoutSec) {
  const start = Date.now();
  const timeoutMs = timeoutSec * 1000;

  while (Date.now() - start < timeoutMs) {
    await sleep(2000); // Poll every 2 seconds
    const request = await db('ride_requests').where({ id: requestId }).first();

    if (request.status === 'accepted') return true;
    if (request.status === 'declined') return false;
  }

  // Expired
  await db('ride_requests').where({ id: requestId, status: 'pending' }).update({ status: 'expired' });
  return false;
}

async function getPassengerName(passengerId) {
  const p = await db('passengers').where({ id: passengerId }).first();
  return p ? p.name || 'Passenger' : 'Passenger';
}

function notifyPassenger(passengerId, event, data) {
  try {
    const { getIO } = require('../websocket/socketServer');
    getIO().to(`passenger:${passengerId}`).emit(event, data);
  } catch { /* socket not initialized in tests */ }
}

function notifyDriver(driverId, event, data) {
  try {
    const { getIO } = require('../websocket/socketServer');
    getIO().to(`driver:${driverId}`).emit(event, data);
  } catch { /* socket not initialized in tests */ }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { findAndAssignDriver };
