const Operator = require('../models/Operator');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Ride = require('../models/Ride');
const User = require('../models/User');

exports.getDashboard = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const [totalDrivers, activeDrivers, totalVehicles, activeVehicles, totalRides, todayRides] = await Promise.all([
      Driver.countDocuments({ operatorId: operator._id }),
      Driver.countDocuments({ operatorId: operator._id, status: 'available', isActive: true }),
      Vehicle.countDocuments({ operatorId: operator._id }),
      Vehicle.countDocuments({ operatorId: operator._id, isActive: true }),
      Ride.countDocuments({ operatorId: operator._id }),
      Ride.countDocuments({
        operatorId: operator._id,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    ]);

    // Today's revenue
    const todayRevenue = await Ride.aggregate([
      {
        $match: {
          operatorId: operator._id,
          status: 'completed',
          completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      },
      { $group: { _id: null, total: { $sum: '$fare.totalFare' } } }
    ]);

    res.json({
      success: true,
      data: {
        operator,
        stats: {
          totalDrivers,
          activeDrivers,
          totalVehicles,
          activeVehicles,
          totalRides,
          todayRides,
          todayRevenue: todayRevenue[0]?.total || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getDrivers = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const drivers = await Driver.find({ operatorId: operator._id })
      .populate({ path: 'userId', select: 'profile email phone' })
      .populate('vehicleId');

    res.json({ success: true, data: { drivers } });
  } catch (error) {
    next(error);
  }
};

exports.addDriver = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const { email, phone, password, firstName, lastName, licenseNumber, licenseExpiry } = req.body;

    // Create user account for driver
    const user = await User.create({
      email,
      phone,
      passwordHash: password,
      userType: 'driver',
      profile: { firstName, lastName }
    });

    const driver = await Driver.create({
      userId: user._id,
      licenseNumber,
      licenseExpiry,
      operatorId: operator._id
    });

    operator.stats.totalDrivers += 1;
    await operator.save();

    res.status(201).json({ success: true, data: { driver, user } });
  } catch (error) {
    next(error);
  }
};

exports.getRides = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const { page = 1, limit = 20, status } = req.query;
    const query = { operatorId: operator._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rides, total] = await Promise.all([
      Ride.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({ path: 'passengerId', select: 'profile' })
        .populate({ path: 'driverId', populate: { path: 'userId', select: 'profile' } }),
      Ride.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: { rides, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    next(error);
  }
};

exports.getEarnings = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'today') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === 'week') { startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); }
    else startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const earnings = await Ride.aggregate([
      { $match: { operatorId: operator._id, status: 'completed', completedAt: { $gte: startDate } } },
      { $group: { _id: null, totalRevenue: { $sum: '$fare.totalFare' }, totalRides: { $sum: 1 }, avgFare: { $avg: '$fare.totalFare' } } }
    ]);

    res.json({
      success: true,
      data: {
        period,
        totalRevenue: earnings[0]?.totalRevenue || 0,
        totalRides: earnings[0]?.totalRides || 0,
        avgFare: Math.round(earnings[0]?.avgFare || 0)
      }
    });
  } catch (error) {
    next(error);
  }
};
