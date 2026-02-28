const express = require('express');
const Joi = require('joi');
const db = require('../db/connection');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { calculateFare } = require('../utils/fare');

const router = express.Router();
router.use(authenticate, authorizeRole('driver'));

// POST /api/driver/go-online
router.post('/go-online', async (req, res, next) => {
  try {
    const { lat, lng } = await Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).validateAsync(req.body);

    await db('drivers').where({ id: req.user.id }).update({
      status: 'online',
      current_lat: lat,
      current_lng: lng,
    });

    res.json({ message: 'You are now online', status: 'online' });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/go-offline
router.post('/go-offline', async (req, res, next) => {
  try {
    const driver = await db('drivers').where({ id: req.user.id }).first();
    if (driver.status === 'on_trip') {
      return res.status(400).json({ error: 'Cannot go offline while on a trip' });
    }

    await db('drivers').where({ id: req.user.id }).update({ status: 'offline' });
    res.json({ message: 'You are now offline', status: 'offline' });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/update-location
router.post('/update-location', async (req, res, next) => {
  try {
    const { lat, lng } = await Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      heading: Joi.number(),
      speed: Joi.number(),
    }).validateAsync(req.body);

    await db('drivers').where({ id: req.user.id }).update({
      current_lat: lat,
      current_lng: lng,
    });

    // If driver is on a trip, broadcast location to passenger
    const activeRide = await db('rides')
      .where({ driver_id: req.user.id })
      .whereIn('status', ['driver_arriving', 'driver_arrived', 'in_progress'])
      .first();

    if (activeRide) {
      const io = require('../websocket/socketServer').getIO();
      io.to(`passenger:${activeRide.passenger_id}`).emit('driver_location', {
        ride_id: activeRide.id,
        lat,
        lng,
      });
    }

    res.json({ message: 'Location updated' });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/respond-to-request
router.post('/respond-to-request', async (req, res, next) => {
  try {
    const { ride_request_id, action } = await Joi.object({
      ride_request_id: Joi.string().uuid().required(),
      action: Joi.string().valid('accept', 'decline').required(),
    }).validateAsync(req.body);

    const rideRequest = await db('ride_requests')
      .where({ id: ride_request_id, driver_id: req.user.id, status: 'pending' })
      .first();

    if (!rideRequest) {
      return res.status(400).json({ error: 'Ride request not found or expired' });
    }

    // Check if request has expired
    if (new Date() > new Date(rideRequest.expires_at)) {
      await db('ride_requests').where({ id: ride_request_id }).update({ status: 'expired' });
      return res.status(400).json({ error: 'Ride request has expired' });
    }

    const io = require('../websocket/socketServer').getIO();

    if (action === 'accept') {
      await db('ride_requests').where({ id: ride_request_id }).update({ status: 'accepted' });

      // Expire other pending requests for this ride
      await db('ride_requests')
        .where({ ride_id: rideRequest.ride_id, status: 'pending' })
        .whereNot({ id: ride_request_id })
        .update({ status: 'expired' });

      // Assign driver to ride
      await db('rides').where({ id: rideRequest.ride_id }).update({
        driver_id: req.user.id,
        status: 'driver_assigned',
      });
      await db('drivers').where({ id: req.user.id }).update({ status: 'arriving' });

      // Get ride and driver details to notify passenger
      const ride = await db('rides').where({ id: rideRequest.ride_id }).first();
      const driver = await db('drivers').where({ id: req.user.id }).select('id', 'name', 'phone', 'rating_avg', 'current_lat', 'current_lng').first();
      const vehicle = await db('vehicles')
        .join('drivers', 'drivers.vehicle_id', 'vehicles.id')
        .where('drivers.id', req.user.id)
        .select('vehicles.*')
        .first();

      // Get operator for this driver
      const driverRecord = await db('drivers').where({ id: req.user.id }).first();
      if (driverRecord.operator_id) {
        await db('rides').where({ id: rideRequest.ride_id }).update({ operator_id: driverRecord.operator_id });
      }

      io.to(`passenger:${ride.passenger_id}`).emit('ride_status_update', {
        ride_id: ride.id,
        status: 'driver_assigned',
        driver: { name: driver.name, phone: driver.phone, rating: driver.rating_avg, lat: driver.current_lat, lng: driver.current_lng },
        vehicle: vehicle ? { registration: vehicle.registration_number, make: vehicle.make, model: vehicle.model, color: vehicle.color, type: vehicle.vehicle_type } : null,
      });

      res.json({ message: 'Ride accepted', ride_id: rideRequest.ride_id });
    } else {
      await db('ride_requests').where({ id: ride_request_id }).update({ status: 'declined' });

      // Update acceptance rate
      const { total } = await db('ride_requests').where({ driver_id: req.user.id }).count('* as total').first();
      const { accepted } = await db('ride_requests').where({ driver_id: req.user.id, status: 'accepted' }).count('* as accepted').first();
      const rate = total > 0 ? (parseInt(accepted) / parseInt(total) * 100).toFixed(1) : 100;
      await db('drivers').where({ id: req.user.id }).update({ acceptance_rate: rate });

      res.json({ message: 'Ride request declined' });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/arrive-at-pickup
router.post('/arrive-at-pickup', async (req, res, next) => {
  try {
    const { ride_id } = await Joi.object({
      ride_id: Joi.string().uuid().required(),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: ride_id, driver_id: req.user.id })
      .whereIn('status', ['driver_assigned', 'driver_arriving'])
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'Invalid ride' });
    }

    await db('rides').where({ id: ride_id }).update({ status: 'driver_arrived' });

    const io = require('../websocket/socketServer').getIO();
    io.to(`passenger:${ride.passenger_id}`).emit('driver_arrived', { ride_id });

    res.json({ message: 'Marked as arrived', otp_required: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/start-ride — requires OTP verification
router.post('/start-ride', async (req, res, next) => {
  try {
    const { ride_id, otp } = await Joi.object({
      ride_id: Joi.string().uuid().required(),
      otp: Joi.string().length(4).required(),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: ride_id, driver_id: req.user.id, status: 'driver_arrived' })
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'Invalid ride' });
    }

    if (ride.otp_code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    await db('rides').where({ id: ride_id }).update({
      status: 'in_progress',
      started_at: new Date(),
    });
    await db('drivers').where({ id: req.user.id }).update({ status: 'on_trip' });

    const io = require('../websocket/socketServer').getIO();
    io.to(`passenger:${ride.passenger_id}`).emit('ride_status_update', {
      ride_id,
      status: 'in_progress',
    });

    res.json({ message: 'Ride started' });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/end-ride
router.post('/end-ride', async (req, res, next) => {
  try {
    const { ride_id } = await Joi.object({
      ride_id: Joi.string().uuid().required(),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: ride_id, driver_id: req.user.id, status: 'in_progress' })
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'Invalid ride' });
    }

    // Calculate actual fare (use estimated for now; could recalculate based on actual route)
    const actualFare = parseFloat(ride.estimated_fare) || 100;

    // Get operator commission
    const operator = ride.operator_id ? await db('operators').where({ id: ride.operator_id }).first() : null;
    const commissionRate = operator ? parseFloat(operator.commission_rate) / 100 : 0.10;
    const commissionAmount = Math.round(actualFare * commissionRate);
    const driverEarning = actualFare - commissionAmount;

    await db('rides').where({ id: ride_id }).update({
      status: 'completed',
      actual_fare: actualFare,
      completed_at: new Date(),
    });

    await db('drivers').where({ id: req.user.id }).update({ status: 'online' });

    // Update passenger ride count
    await db('passengers').where({ id: ride.passenger_id }).increment('total_rides', 1);

    // Create transaction
    await db('transactions').insert({
      ride_id,
      total_fare: actualFare,
      commission_amount: commissionAmount,
      driver_earning: driverEarning,
      payment_method: ride.payment_method,
      payment_status: ride.payment_method === 'cash' ? 'completed' : 'pending',
    });

    const io = require('../websocket/socketServer').getIO();
    io.to(`passenger:${ride.passenger_id}`).emit('ride_completed', {
      ride_id,
      fare: actualFare,
    });

    res.json({
      message: 'Ride completed',
      fare: actualFare,
      commission: commissionAmount,
      earning: driverEarning,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/driver/rate-passenger
router.post('/rate-passenger', async (req, res, next) => {
  try {
    const { ride_id, rating } = await Joi.object({
      ride_id: Joi.string().uuid().required(),
      rating: Joi.number().integer().min(1).max(5).required(),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: ride_id, driver_id: req.user.id, status: 'completed' })
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'Cannot rate this ride' });
    }

    await db('rides').where({ id: ride_id }).update({ passenger_rating: rating });

    // Update passenger average rating
    const { avg } = await db('rides')
      .where({ passenger_id: ride.passenger_id })
      .whereNotNull('passenger_rating')
      .avg('passenger_rating as avg')
      .first();
    await db('passengers').where({ id: ride.passenger_id }).update({ rating_avg: parseFloat(avg).toFixed(1) });

    res.json({ message: 'Passenger rated', rating });
  } catch (err) {
    next(err);
  }
});

// GET /api/driver/earnings
router.get('/earnings', async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    let dateFilter;

    const now = new Date();
    if (period === 'today') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const earnings = await db('transactions')
      .join('rides', 'rides.id', 'transactions.ride_id')
      .where('rides.driver_id', req.user.id)
      .where('transactions.created_at', '>=', dateFilter)
      .select(
        db.raw('COALESCE(SUM(transactions.driver_earning), 0) as total_earning'),
        db.raw('COALESCE(SUM(transactions.total_fare), 0) as total_fare'),
        db.raw('COALESCE(SUM(transactions.commission_amount), 0) as total_commission'),
        db.raw('COUNT(*) as ride_count'),
      )
      .first();

    res.json({ period, ...earnings });
  } catch (err) {
    next(err);
  }
});

// GET /api/driver/active-ride — get current active ride for this driver
router.get('/active-ride', async (req, res, next) => {
  try {
    const ride = await db('rides')
      .where({ driver_id: req.user.id })
      .whereIn('status', ['driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'])
      .orderBy('created_at', 'desc')
      .first();

    if (!ride) {
      return res.json({ active: false });
    }

    // Get passenger info
    const passenger = await db('passengers')
      .where({ id: ride.passenger_id })
      .select('id', 'name', 'phone', 'rating_avg')
      .first();

    res.json({
      active: true,
      ride_id: ride.id,
      status: ride.status,
      pickup_lat: ride.pickup_lat,
      pickup_lng: ride.pickup_lng,
      pickup_address: ride.pickup_address,
      dropoff_lat: ride.dropoff_lat,
      dropoff_lng: ride.dropoff_lng,
      dropoff_address: ride.dropoff_address,
      estimated_fare: ride.estimated_fare,
      vehicle_type: ride.vehicle_type_requested,
      estimated_distance_km: ride.estimated_distance_km,
      estimated_duration_minutes: ride.estimated_duration_minutes,
      passenger: passenger || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
