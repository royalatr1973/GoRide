const db = require('../db/connection');
const { haversineDistance } = require('../utils/geo');

const MAX_RADIUS_KM = 50;
const AUTO_ACCEPT_DELAY_SEC = 5;

/**
 * Driver matching algorithm:
 * 1. Find online drivers with matching vehicle type within radius
 * 2. Score by: distance (50%), rating (30%), acceptance rate (20%)
 * 3. Auto-assign best available driver after a short delay
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

  // Simulate realistic search delay before assigning
  await sleep(AUTO_ACCEPT_DELAY_SEC * 1000);

  // Re-check ride status (may have been cancelled during wait)
  const currentRide = await db('rides').where({ id: rideId }).first();
  if (currentRide.status !== 'searching') return;

  const driver = scored[0];

  // Create ride request and auto-accept it
  const [request] = await db('ride_requests').insert({
    ride_id: rideId,
    driver_id: driver.id,
    status: 'accepted',
    expires_at: new Date(Date.now() + 30000),
  }).returning('*');

  // Assign driver to ride
  await db('rides').where({ id: rideId }).update({
    driver_id: driver.id,
    status: 'driver_assigned',
  });
  await db('drivers').where({ id: driver.id }).update({ status: 'arriving' });

  // Get driver's operator for the ride
  const driverRecord = await db('drivers').where({ id: driver.id }).first();
  if (driverRecord.operator_id) {
    await db('rides').where({ id: rideId }).update({ operator_id: driverRecord.operator_id });
  }

  // Get vehicle info
  const vehicle = await db('vehicles')
    .join('drivers', 'drivers.vehicle_id', 'vehicles.id')
    .where('drivers.id', driver.id)
    .select('vehicles.*')
    .first();

  // Notify passenger that driver has been assigned
  notifyPassenger(ride.passenger_id, 'ride_status_update', {
    ride_id: rideId,
    status: 'driver_assigned',
    driver: {
      name: driver.name,
      phone: driver.phone,
      rating: driver.rating_avg,
      lat: driver.current_lat,
      lng: driver.current_lng,
    },
    vehicle: vehicle ? {
      registration: vehicle.registration_number,
      make: vehicle.make,
      model: vehicle.model,
      color: vehicle.color,
      type: vehicle.vehicle_type,
    } : null,
  });

  console.log(`[DriverMatch] Auto-assigned driver ${driver.name} to ride ${rideId}`);
}

function notifyPassenger(passengerId, event, data) {
  try {
    const { getIO } = require('../websocket/socketServer');
    getIO().to(`passenger:${passengerId}`).emit(event, data);
  } catch { /* socket not initialized in tests */ }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { findAndAssignDriver };
