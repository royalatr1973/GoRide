const express = require('express');
const Joi = require('joi');
const db = require('../db/connection');
const { authenticate, authorizeRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorizeRole('operator'));

// GET /api/operator/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const operatorId = req.user.id;

    const [activeDrivers] = await db('drivers').where({ operator_id: operatorId }).whereNot({ status: 'offline' }).count('* as count');
    const [totalDrivers] = await db('drivers').where({ operator_id: operatorId }).count('* as count');
    const [totalVehicles] = await db('vehicles').where({ operator_id: operatorId, is_active: true }).count('* as count');
    const [ongoingRides] = await db('rides').where({ operator_id: operatorId }).whereIn('status', ['searching', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress']).count('* as count');

    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [revenue] = await db('transactions')
      .join('rides', 'rides.id', 'transactions.ride_id')
      .where('rides.operator_id', operatorId)
      .where('transactions.created_at', '>=', today)
      .select(
        db.raw('COALESCE(SUM(transactions.total_fare), 0) as total_fare'),
        db.raw('COALESCE(SUM(transactions.commission_amount), 0) as commission'),
      );

    res.json({
      active_drivers: parseInt(activeDrivers.count),
      total_drivers: parseInt(totalDrivers.count),
      total_vehicles: parseInt(totalVehicles.count),
      ongoing_rides: parseInt(ongoingRides.count),
      today_revenue: parseFloat(revenue.total_fare),
      today_commission: parseFloat(revenue.commission),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/operator/drivers
router.get('/drivers', async (req, res, next) => {
  try {
    const drivers = await db('drivers')
      .where('drivers.operator_id', req.user.id)
      .leftJoin('vehicles', 'drivers.vehicle_id', 'vehicles.id')
      .select(
        'drivers.*',
        'vehicles.registration_number',
        'vehicles.make as vehicle_make',
        'vehicles.model as vehicle_model',
        'vehicles.vehicle_type',
      );

    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

// POST /api/operator/drivers/add
router.post('/drivers/add', async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().max(100).required(),
      phone: Joi.string().pattern(/^\+91\d{10}$/).required(),
      license_number: Joi.string().max(50).required(),
      vehicle_id: Joi.string().uuid(),
    });
    const data = await schema.validateAsync(req.body);

    const [driver] = await db('drivers').insert({
      name: data.name,
      phone: data.phone,
      license_number: data.license_number,
      vehicle_id: data.vehicle_id,
      operator_id: req.user.id,
    }).returning('*');

    res.status(201).json({ message: 'Driver added', driver });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Driver with this phone already exists' });
    }
    next(err);
  }
});

// DELETE /api/operator/drivers/:id
router.delete('/drivers/:id', async (req, res, next) => {
  try {
    const deleted = await db('drivers')
      .where({ id: req.params.id, operator_id: req.user.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ message: 'Driver deleted' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/operator/drivers/:id
router.put('/drivers/:id', async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().max(100),
      license_number: Joi.string().max(50),
      vehicle_id: Joi.string().uuid().allow(null),
    });
    const data = await schema.validateAsync(req.body);

    const [updated] = await db('drivers')
      .where({ id: req.params.id, operator_id: req.user.id })
      .update(data)
      .returning('*');

    if (!updated) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ message: 'Driver updated', driver: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/operator/vehicles
router.get('/vehicles', async (req, res, next) => {
  try {
    const vehicles = await db('vehicles')
      .where({ operator_id: req.user.id })
      .orderBy('created_at', 'desc');

    res.json({ vehicles });
  } catch (err) {
    next(err);
  }
});

// POST /api/operator/vehicles/add
router.post('/vehicles/add', async (req, res, next) => {
  try {
    const schema = Joi.object({
      registration_number: Joi.string().max(20).required(),
      make: Joi.string().max(50).required(),
      model: Joi.string().max(50).required(),
      color: Joi.string().max(30),
      vehicle_type: Joi.string().valid('auto', 'economy', 'sedan', 'suv').required(),
      seats: Joi.number().integer().min(1).max(10),
    });
    const data = await schema.validateAsync(req.body);

    const [vehicle] = await db('vehicles').insert({
      ...data,
      operator_id: req.user.id,
    }).returning('*');

    res.status(201).json({ message: 'Vehicle added', vehicle });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Vehicle with this registration already exists' });
    }
    next(err);
  }
});

// DELETE /api/operator/vehicles/:id
router.delete('/vehicles/:id', async (req, res, next) => {
  try {
    const deleted = await db('vehicles')
      .where({ id: req.params.id, operator_id: req.user.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json({ message: 'Vehicle deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/operator/rides
router.get('/rides', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('rides')
      .where('rides.operator_id', req.user.id)
      .leftJoin('passengers', 'rides.passenger_id', 'passengers.id')
      .leftJoin('drivers', 'rides.driver_id', 'drivers.id')
      .select(
        'rides.*',
        'passengers.name as passenger_name',
        'drivers.name as driver_name',
      )
      .orderBy('rides.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    if (status) {
      query = query.where('rides.status', status);
    }

    const rides = await query;
    res.json({ rides, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/operator/earnings
router.get('/earnings', async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
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
      .where('rides.operator_id', req.user.id)
      .where('transactions.created_at', '>=', dateFilter)
      .select(
        db.raw('COALESCE(SUM(transactions.total_fare), 0) as total_revenue'),
        db.raw('COALESCE(SUM(transactions.commission_amount), 0) as total_commission'),
        db.raw('COUNT(*) as total_rides'),
      )
      .first();

    // Per-driver breakdown
    const driverBreakdown = await db('transactions')
      .join('rides', 'rides.id', 'transactions.ride_id')
      .join('drivers', 'rides.driver_id', 'drivers.id')
      .where('rides.operator_id', req.user.id)
      .where('transactions.created_at', '>=', dateFilter)
      .groupBy('drivers.id', 'drivers.name')
      .select(
        'drivers.id',
        'drivers.name',
        db.raw('SUM(transactions.total_fare) as total_fare'),
        db.raw('SUM(transactions.driver_earning) as driver_earning'),
        db.raw('SUM(transactions.commission_amount) as commission'),
        db.raw('COUNT(*) as rides'),
      );

    res.json({ period, summary: earnings, driver_breakdown: driverBreakdown });
  } catch (err) {
    next(err);
  }
});

// PUT /api/operator/fare-config
router.put('/fare-config', async (req, res, next) => {
  try {
    const schema = Joi.object({
      vehicle_type: Joi.string().valid('auto', 'economy', 'sedan', 'suv').required(),
      base_fare: Joi.number().positive().required(),
      per_km_rate: Joi.number().positive().required(),
      per_minute_rate: Joi.number().positive().required(),
      minimum_fare: Joi.number().positive().required(),
    });
    const data = await schema.validateAsync(req.body);

    // Upsert fare config
    const existing = await db('fare_config')
      .where({ operator_id: req.user.id, vehicle_type: data.vehicle_type })
      .first();

    let fareConfig;
    if (existing) {
      [fareConfig] = await db('fare_config')
        .where({ id: existing.id })
        .update({
          base_fare: data.base_fare,
          per_km_rate: data.per_km_rate,
          per_minute_rate: data.per_minute_rate,
          minimum_fare: data.minimum_fare,
        })
        .returning('*');
    } else {
      [fareConfig] = await db('fare_config')
        .insert({ operator_id: req.user.id, ...data })
        .returning('*');
    }

    res.json({ message: 'Fare config updated', fare_config: fareConfig });
  } catch (err) {
    next(err);
  }
});

// GET /api/operator/live-map — all driver locations
router.get('/live-map', async (req, res, next) => {
  try {
    const drivers = await db('drivers')
      .where({ operator_id: req.user.id })
      .whereNot({ status: 'offline' })
      .select('id', 'name', 'status', 'current_lat', 'current_lng');

    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
