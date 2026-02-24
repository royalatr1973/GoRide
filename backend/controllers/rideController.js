const rideService = require('../services/rideService');
const fareService = require('../services/fareService');

exports.createRide = async (req, res, next) => {
  try {
    const { pickupLocation, dropLocation, vehicleType, paymentMethod } = req.body;

    if (!pickupLocation || !dropLocation) {
      return res.status(400).json({ success: false, error: 'Pickup and drop locations are required' });
    }

    const ride = await rideService.createRide({
      passengerId: req.user.userId,
      pickupLocation,
      dropLocation,
      vehicleType,
      paymentMethod
    });

    // Broadcast to nearby drivers via Socket.io
    const io = req.app.get('io');
    const nearbyDrivers = await rideService.findNearbyDrivers(
      pickupLocation.latitude, pickupLocation.longitude
    );

    nearbyDrivers.forEach(driver => {
      if (driver.driverId) {
        io.to(`driver_${driver.driverId}`).emit('ride_request', {
          rideId: ride._id,
          pickupLocation: ride.pickupLocation,
          dropLocation: ride.dropLocation,
          estimatedFare: ride.estimatedFare,
          estimatedDistance: ride.estimatedDistance,
          estimatedDuration: ride.estimatedDuration,
          vehicleType: ride.vehicleType,
          passengerName: req.user.profile.firstName
        });
      }
    });

    res.status(201).json({ success: true, data: { ride, nearbyDrivers: nearbyDrivers.length } });
  } catch (error) {
    next(error);
  }
};

exports.getRide = async (req, res, next) => {
  try {
    const ride = await rideService.getRideById(req.params.id);
    res.json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

exports.acceptRide = async (req, res, next) => {
  try {
    const Driver = require('../models/Driver');
    const driver = await Driver.findOne({ userId: req.user.userId });

    if (!driver) {
      return res.status(400).json({ success: false, error: 'Driver profile not found' });
    }

    const ride = await rideService.acceptRide(req.params.id, driver._id);
    const fullRide = await rideService.getRideById(ride._id);

    // Notify passenger
    const io = req.app.get('io');
    io.to(`passenger_${ride.passengerId}`).emit('ride_accepted', {
      rideId: ride._id,
      driver: {
        name: req.user.profile.firstName,
        rating: driver.rating,
        vehicle: driver.vehicleId,
        location: driver.currentLocation
      }
    });

    res.json({ success: true, data: { ride: fullRide } });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const ride = await rideService.updateRideStatus(req.params.id, status, {
      reason,
      cancelledBy: req.user.userType,
      distance: req.body.distance,
      duration: req.body.duration
    });

    // Broadcast status change
    const io = req.app.get('io');
    io.to(`ride_${ride._id}`).emit('ride_status_update', {
      rideId: ride._id,
      status: ride.status,
      updatedAt: new Date()
    });

    res.json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

exports.getNearbyDrivers = async (req, res, next) => {
  try {
    const { latitude, longitude, radius } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
    }

    const drivers = await rideService.findNearbyDrivers(
      parseFloat(latitude), parseFloat(longitude), parseInt(radius) || undefined
    );

    res.json({ success: true, data: { drivers, count: drivers.length } });
  } catch (error) {
    next(error);
  }
};

exports.getFareEstimate = async (req, res, next) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, vehicleType } = req.query;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({ success: false, error: 'Pickup and drop coordinates are required' });
    }

    const fare = await fareService.calculateFare({
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      dropLat: parseFloat(dropLat),
      dropLng: parseFloat(dropLng),
      vehicleType: vehicleType || 'sedan'
    });

    res.json({ success: true, data: { fare } });
  } catch (error) {
    next(error);
  }
};
