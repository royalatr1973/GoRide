const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const Rating = require('../models/Rating');
const rideService = require('../services/rideService');
const { DRIVER_STATUS } = require('../../config/constants');

exports.getProfile = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.userId })
      .populate('vehicleId')
      .populate('operatorId');

    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver profile not found' });
    }

    res.json({ success: true, data: { driver } });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!Object.values(DRIVER_STATUS).includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.userId },
      { status },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver profile not found' });
    }

    // Broadcast status change via socket
    const io = req.app.get('io');
    io.to(`driver_${driver._id}`).emit('driver_status_changed', { status });

    res.json({ success: true, data: { driver } });
  } catch (error) {
    next(error);
  }
};

exports.updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.userId },
      {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
          lastUpdated: new Date()
        }
      },
      { new: true }
    );

    res.json({ success: true, data: { location: driver.currentLocation } });
  } catch (error) {
    next(error);
  }
};

exports.getActiveRides = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.userId });
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver profile not found' });
    }

    const rides = await Ride.find({
      driverId: driver._id,
      status: { $in: ['accepted', 'arriving', 'started'] }
    }).populate({ path: 'passengerId', select: 'profile phone' })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { rides } });
  } catch (error) {
    next(error);
  }
};

exports.getRideHistory = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await rideService.getUserRides(req.user.userId, 'driver', {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getEarnings = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.userId });
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver profile not found' });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRides, weekRides, monthRides] = await Promise.all([
      Ride.find({ driverId: driver._id, status: 'completed', completedAt: { $gte: todayStart } }),
      Ride.find({ driverId: driver._id, status: 'completed', completedAt: { $gte: weekStart } }),
      Ride.find({ driverId: driver._id, status: 'completed', completedAt: { $gte: monthStart } })
    ]);

    const sum = rides => rides.reduce((acc, r) => acc + (r.fare?.totalFare || 0), 0);

    res.json({
      success: true,
      data: {
        today: { rides: todayRides.length, earnings: sum(todayRides) },
        thisWeek: { rides: weekRides.length, earnings: sum(weekRides) },
        thisMonth: { rides: monthRides.length, earnings: sum(monthRides) },
        totalRides: driver.rating.completedRides,
        averageRating: driver.rating.averageRating
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.ratePassenger = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const ride = await Ride.findById(req.params.rideId);

    if (!ride || ride.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Invalid ride for rating' });
    }

    await Rating.create({
      rideId: ride._id,
      raterId: req.user.userId,
      ratedUserId: ride.passengerId,
      rating,
      review
    });

    ride.passengerRating = { score: rating, review, ratedAt: new Date() };
    await ride.save();

    res.json({ success: true, message: 'Rating submitted' });
  } catch (error) {
    next(error);
  }
};
