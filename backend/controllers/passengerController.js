const rideService = require('../services/rideService');
const Rating = require('../models/Rating');
const Ride = require('../models/Ride');
const Driver = require('../models/Driver');

exports.getRideHistory = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await rideService.getUserRides(req.user.userId, 'passenger', {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getActiveRides = async (req, res, next) => {
  try {
    const rides = await Ride.find({
      passengerId: req.user.userId,
      status: { $in: ['requested', 'accepted', 'arriving', 'started'] }
    }).populate({
      path: 'driverId',
      populate: [
        { path: 'userId', select: 'profile phone' },
        { path: 'vehicleId' }
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: { rides } });
  } catch (error) {
    next(error);
  }
};

exports.rateRide = async (req, res, next) => {
  try {
    const { rating, review, tags } = req.body;
    const ride = await Ride.findById(req.params.rideId);

    if (!ride) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }

    if (ride.passengerId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to rate this ride' });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Can only rate completed rides' });
    }

    // Create rating record
    const ratingDoc = await Rating.create({
      rideId: ride._id,
      raterId: req.user.userId,
      ratedUserId: ride.driverId,
      rating,
      review,
      tags
    });

    // Update ride with passenger rating
    ride.driverRating = { score: rating, review, ratedAt: new Date() };
    await ride.save();

    // Update driver's average rating
    if (ride.driverId) {
      const driver = await Driver.findById(ride.driverId);
      if (driver) {
        const totalScore = driver.rating.averageRating * driver.rating.totalRatings + rating;
        driver.rating.totalRatings += 1;
        driver.rating.averageRating = Math.round((totalScore / driver.rating.totalRatings) * 10) / 10;
        await driver.save();
      }
    }

    res.json({ success: true, data: { rating: ratingDoc } });
  } catch (error) {
    next(error);
  }
};
