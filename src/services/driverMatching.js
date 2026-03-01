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
  let ride;
  try {
    ride = await db('rides').where({ id: rideId }).first();
  } catch (err) {
    console.error('[DriverMatch] DB error fetching ride:', err.message);
    return;
  }
  if (!ride || ride.status !== 'searching') return;

  const pickupLat = parseFloat(ride.pickup_lat);
  const pickupLng = parseFloat(ride.pickup_lng);

  console.log(`[DriverMatch] Searching for '${ride.vehicle_type_requested}' driver near (${pickupLat}, ${pickupLng})`);

  // Find eligible drivers (include 'arriving' so drivers can be reused in demo)
  let candidates;
  try {
    candidates = await db('drivers')
      .where('drivers.is_verified', true)
      .whereIn('drivers.status', ['online', 'arriving'])
      .join('vehicles', 'drivers.vehicle_id', 'vehicles.id')
      .where('vehicles.vehicle_type', ride.vehicle_type_requested)
      .where('vehicles.is_active', true)
      .join('operators', 'drivers.operator_id', 'operators.id')
      .where('operators.is_active', true)
      .select('drivers.*');
  } catch (err) {
    console.error('[DriverMatch] DB query error:', err.message);
    // Fallback: try simpler query without joins
    try {
      console.log('[DriverMatch] Trying fallback query...');
      candidates = await db('drivers')
        .where('drivers.is_verified', true)
        .whereIn('drivers.status', ['online', 'arriving']);
      // Filter by vehicle type manually
      const driverIds = candidates.map(d => d.id);
      if (driverIds.length > 0) {
        const vehicles = await db('vehicles').whereIn('id', candidates.map(d => d.vehicle_id));
        const vehicleMap = {};
        vehicles.forEach(v => { vehicleMap[v.id] = v; });
        candidates = candidates.filter(d => {
          const v = vehicleMap[d.vehicle_id];
          return v && v.vehicle_type === ride.vehicle_type_requested && v.is_active;
        });
      }
    } catch (err2) {
      console.error('[DriverMatch] Fallback query also failed:', err2.message);
      await db('rides').where({ id: rideId }).update({ status: 'cancelled', cancellation_reason: 'Driver matching error' }).catch(() => {});
      notifyPassenger(ride.passenger_id, 'ride_status_update', { ride_id: rideId, status: 'cancelled', reason: 'No drivers available' });
      return;
    }
  }

  console.log(`[DriverMatch] Found ${candidates.length} candidate driver(s)`);

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

  console.log(`[DriverMatch] ${scored.length} driver(s) within ${MAX_RADIUS_KM}km radius`);

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
  // Keep driver 'online' so they remain available for demo bookings
  await db('drivers').where({ id: driver.id }).update({ status: 'online' });

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

  // Notify driver of the assigned ride
  notifyDriver(driver.id, 'ride_request', {
    ride_id: rideId,
    ride_request_id: request.id,
    status: 'driver_assigned',
    pickup_address: ride.pickup_address,
    dropoff_address: ride.dropoff_address,
    pickup_lat: ride.pickup_lat,
    pickup_lng: ride.pickup_lng,
    dropoff_lat: ride.dropoff_lat,
    dropoff_lng: ride.dropoff_lng,
    estimated_fare: ride.estimated_fare,
    vehicle_type: ride.vehicle_type_requested,
    distance_km: ride.estimated_distance_km,
    duration_minutes: ride.estimated_duration_minutes,
  });

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

  // Notify operator dashboard about new ride assignment
  if (driverRecord.operator_id) {
    try {
      const { notifyOperator } = require('../websocket/socketServer');
      notifyOperator(driverRecord.operator_id, 'ride_status_changed', {
        ride_id: rideId, status: 'driver_assigned', driver_name: driver.name,
      });
    } catch { /* ignore */ }
  }

  console.log(`[DriverMatch] Auto-assigned driver ${driver.name} to ride ${rideId}`);
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
