const Vehicle = require('../models/Vehicle');
const Operator = require('../models/Operator');
const Driver = require('../models/Driver');

exports.addVehicle = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const vehicle = await Vehicle.create({
      ...req.body,
      operatorId: operator._id
    });

    operator.stats.totalVehicles += 1;
    await operator.save();

    res.status(201).json({ success: true, data: { vehicle } });
  } catch (error) {
    next(error);
  }
};

exports.getVehicles = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({ userId: req.user.userId });
    if (!operator) {
      return res.status(404).json({ success: false, error: 'Operator profile not found' });
    }

    const vehicles = await Vehicle.find({ operatorId: operator._id })
      .populate({ path: 'driverId', populate: { path: 'userId', select: 'profile' } });

    res.json({ success: true, data: { vehicles } });
  } catch (error) {
    next(error);
  }
};

exports.getVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate({ path: 'driverId', populate: { path: 'userId', select: 'profile' } });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    res.json({ success: true, data: { vehicle } });
  } catch (error) {
    next(error);
  }
};

exports.updateVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    res.json({ success: true, data: { vehicle } });
  } catch (error) {
    next(error);
  }
};

exports.deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    // Unassign from driver if assigned
    if (vehicle.driverId) {
      await Driver.findByIdAndUpdate(vehicle.driverId, { vehicleId: null });
    }

    res.json({ success: true, message: 'Vehicle deactivated' });
  } catch (error) {
    next(error);
  }
};

exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId } = req.body;

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { driverId },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    await Driver.findByIdAndUpdate(driverId, { vehicleId: vehicle._id });

    res.json({ success: true, data: { vehicle } });
  } catch (error) {
    next(error);
  }
};
