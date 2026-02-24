const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const { RIDE_STATUS, DRIVER_STATUS, NEARBY_DRIVER_RADIUS } = require('../../config/constants');
const { calculateDistance } = require('../utils/helpers');
const fareService = require('./fareService');
const { BadRequestError, NotFoundError } = require('../utils/errors');

/**
 * Create a new ride request
 */
async function createRide({ passengerId, pickupLocation, dropLocation, vehicleType, paymentMethod }) {
  // Calculate fare estimate
  const fareEstimate = await fareService.calculateFare({
    pickupLat: pickupLocation.latitude,
    pickupLng: pickupLocation.longitude,
    dropLat: dropLocation.latitude,
    dropLng: dropLocation.longitude,
    vehicleType
  });

  const ride = await Ride.create({
    passengerId,
    pickupLocation,
    dropLocation,
    vehicleType: vehicleType || 'sedan',
    paymentMethod: paymentMethod || 'cash',
    estimatedFare: fareEstimate.totalFare,
    estimatedDistance: fareEstimate.distance,
    estimatedDuration: fareEstimate.duration,
    fare: {
      baseFare: fareEstimate.baseFare,
      distanceFare: fareEstimate.distanceFare,
      timeFare: fareEstimate.timeFare,
      surgeMultiplier: fareEstimate.surgeMultiplier,
      totalFare: fareEstimate.totalFare
    },
    status: RIDE_STATUS.REQUESTED,
    requestedAt: new Date()
  });

  return ride;
}

/**
 * Find nearby available drivers
 */
async function findNearbyDrivers(latitude, longitude, radiusMeters = NEARBY_DRIVER_RADIUS) {
  const drivers = await Driver.find({
    status: DRIVER_STATUS.AVAILABLE,
    isActive: true,
    isVerified: true,
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusMeters
      }
    }
  }).populate({
    path: 'userId',
    select: 'profile.firstName profile.lastName profile.profileImage'
  }).populate('vehicleId')
    .limit(10);

  return drivers.map(driver => ({
    driverId: driver._id,
    userId: driver.userId,
    name: driver.userId ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName}` : 'Unknown',
    profileImage: driver.userId?.profile?.profileImage || '',
    rating: driver.rating,
    vehicle: driver.vehicleId,
    location: driver.currentLocation,
    distance: calculateDistance(
      latitude, longitude,
      driver.currentLocation.coordinates[1],
      driver.currentLocation.coordinates[0]
    )
  }));
}

/**
 * Accept a ride (driver)
 */
async function acceptRide(rideId, driverId) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new NotFoundError('Ride not found');
  if (ride.status !== RIDE_STATUS.REQUESTED) {
    throw new BadRequestError('Ride is no longer available');
  }

  const driver = await Driver.findById(driverId);
  if (!driver || driver.status !== DRIVER_STATUS.AVAILABLE) {
    throw new BadRequestError('Driver is not available');
  }

  ride.driverId = driverId;
  ride.vehicleId = driver.vehicleId;
  ride.operatorId = driver.operatorId;
  ride.status = RIDE_STATUS.ACCEPTED;
  ride.acceptedAt = new Date();
  await ride.save();

  // Mark driver as busy
  driver.status = DRIVER_STATUS.BUSY;
  await driver.save();

  return ride;
}

/**
 * Update ride status
 */
async function updateRideStatus(rideId, status, extras = {}) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new NotFoundError('Ride not found');

  const validTransitions = {
    [RIDE_STATUS.REQUESTED]: [RIDE_STATUS.ACCEPTED, RIDE_STATUS.CANCELLED],
    [RIDE_STATUS.ACCEPTED]: [RIDE_STATUS.ARRIVING, RIDE_STATUS.CANCELLED],
    [RIDE_STATUS.ARRIVING]: [RIDE_STATUS.STARTED, RIDE_STATUS.CANCELLED],
    [RIDE_STATUS.STARTED]: [RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED],
    [RIDE_STATUS.COMPLETED]: [],
    [RIDE_STATUS.CANCELLED]: []
  };

  if (!validTransitions[ride.status]?.includes(status)) {
    throw new BadRequestError(`Cannot transition from ${ride.status} to ${status}`);
  }

  ride.status = status;

  if (status === RIDE_STATUS.ARRIVING) ride.arrivingAt = new Date();
  if (status === RIDE_STATUS.STARTED) ride.startedAt = new Date();
  if (status === RIDE_STATUS.COMPLETED) {
    ride.completedAt = new Date();
    if (extras.distance) ride.distance = extras.distance;
    if (extras.duration) ride.duration = extras.duration;

    // Free up driver
    if (ride.driverId) {
      await Driver.findByIdAndUpdate(ride.driverId, { status: DRIVER_STATUS.AVAILABLE });
    }
  }
  if (status === RIDE_STATUS.CANCELLED) {
    ride.cancelledAt = new Date();
    ride.cancellationReason = extras.reason || '';
    ride.cancelledBy = extras.cancelledBy || 'system';

    // Free up driver if assigned
    if (ride.driverId) {
      await Driver.findByIdAndUpdate(ride.driverId, { status: DRIVER_STATUS.AVAILABLE });
    }
  }

  await ride.save();
  return ride;
}

/**
 * Get ride by ID with populated fields
 */
async function getRideById(rideId) {
  const ride = await Ride.findById(rideId)
    .populate({ path: 'passengerId', select: 'profile email phone' })
    .populate({
      path: 'driverId',
      populate: [
        { path: 'userId', select: 'profile email phone' },
        { path: 'vehicleId' }
      ]
    });

  if (!ride) throw new NotFoundError('Ride not found');
  return ride;
}

/**
 * Get rides for a user
 */
async function getUserRides(userId, userType, { page = 1, limit = 20, status } = {}) {
  const query = {};

  if (userType === 'passenger') {
    query.passengerId = userId;
  } else if (userType === 'driver') {
    const driver = await Driver.findOne({ userId });
    if (driver) query.driverId = driver._id;
  }

  if (status) query.status = status;

  const skip = (page - 1) * limit;
  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'passengerId', select: 'profile' })
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'profile' }
      }),
    Ride.countDocuments(query)
  ]);

  return { rides, total, page, totalPages: Math.ceil(total / limit) };
}

module.exports = {
  createRide,
  findNearbyDrivers,
  acceptRide,
  updateRideStatus,
  getRideById,
  getUserRides
};
