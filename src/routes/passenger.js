const express = require('express');
const Joi = require('joi');
const axios = require('axios');
const db = require('../db/connection');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { calculateFare } = require('../utils/fare');
const { generateOTP } = require('../utils/otp');
const { findAndAssignDriver } = require('../services/driverMatching');
const { searchLocations, geocodeLocal } = require('../data/chennaiLocations');

const router = express.Router();
router.use(authenticate, authorizeRole('passenger'));

// POST /api/passenger/autocomplete — suggest locations as user types
router.post('/autocomplete', async (req, res, next) => {
  try {
    const { text } = await Joi.object({
      text: Joi.string().max(500).required(),
    }).validateAsync(req.body);

    // Try Google Places Autocomplete if API key is configured
    if (process.env.GOOGLE_CLOUD_API_KEY && process.env.GOOGLE_CLOUD_API_KEY !== 'your-google-cloud-api-key') {
      try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
          params: {
            input: text,
            components: 'country:in',
            location: '13.0827,80.2707', // Chennai center
            radius: 50000,
            key: process.env.GOOGLE_CLOUD_API_KEY,
          },
        });

        if (response.data.predictions && response.data.predictions.length > 0) {
          return res.json({
            suggestions: response.data.predictions.map((p) => ({
              description: p.description,
              place_id: p.place_id,
            })),
          });
        }
      } catch {
        // Fall through to Nominatim
      }
    }

    // Try Nominatim, fall back to local database if unreachable
    try {
      const nomResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${text}, Chennai, Tamil Nadu, India`,
          format: 'json',
          limit: 5,
          addressdetails: 1,
        },
        headers: { 'User-Agent': 'FreedomRide-Dev/1.0' },
        timeout: 3000,
      });

      if (nomResponse.data && nomResponse.data.length > 0) {
        return res.json({
          suggestions: nomResponse.data.map((r) => ({
            description: r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          })),
        });
      }
    } catch {
      // Nominatim unreachable, fall through to local
    }

    // Local Chennai location database fallback
    const localResults = searchLocations(text);
    res.json({
      suggestions: localResults.map((r) => ({
        description: `${r.name}, ${r.area}, Chennai, Tamil Nadu, India`,
        lat: r.lat,
        lng: r.lng,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/geocode — convert place name to coordinates
router.post('/geocode', async (req, res, next) => {
  try {
    const { text } = await Joi.object({
      text: Joi.string().max(500).required(),
    }).validateAsync(req.body);

    // Check if input is already coordinates (lat,lng)
    const coordMatch = text.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      // Reverse geocode the coordinates to get an address
      try {
        const revRes = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: { lat, lon: lng, format: 'json' },
          headers: { 'User-Agent': 'FreedomRide-Dev/1.0' },
        });
        return res.json({ lat, lng, address: revRes.data.display_name || `${lat},${lng}` });
      } catch {
        return res.json({ lat, lng, address: `${lat},${lng}` });
      }
    }

    // Try Google Maps if API key is configured
    if (process.env.GOOGLE_CLOUD_API_KEY && process.env.GOOGLE_CLOUD_API_KEY !== 'your-google-cloud-api-key') {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: `${text}, Chennai, Tamil Nadu`,
          key: process.env.GOOGLE_CLOUD_API_KEY,
        },
      });

      const result = response.data.results[0];
      if (result) {
        return res.json({
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.formatted_address,
        });
      }
    }

    // Try Nominatim, fall back to local database if unreachable
    try {
      const nomResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${text}, Chennai, Tamil Nadu, India`,
          format: 'json',
          limit: 1,
          addressdetails: 1,
        },
        headers: { 'User-Agent': 'FreedomRide-Dev/1.0' },
        timeout: 3000,
      });

      const nomResult = nomResponse.data[0];
      if (nomResult) {
        return res.json({
          lat: parseFloat(nomResult.lat),
          lng: parseFloat(nomResult.lon),
          address: nomResult.display_name,
        });
      }
    } catch {
      // Nominatim unreachable, fall through to local
    }

    // Local Chennai location database fallback
    const local = geocodeLocal(text);
    if (local) {
      return res.json({
        lat: local.lat,
        lng: local.lng,
        address: `${local.name}, ${local.area}, Chennai, Tamil Nadu, India`,
      });
    }

    return res.status(404).json({ error: 'Location not found' });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/reverse-geocode — convert coordinates to address
router.post('/reverse-geocode', async (req, res, next) => {
  try {
    const { lat, lng } = await Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).validateAsync(req.body);

    // Try Google Maps if API key is configured
    if (process.env.GOOGLE_CLOUD_API_KEY && process.env.GOOGLE_CLOUD_API_KEY !== 'your-google-cloud-api-key') {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: process.env.GOOGLE_CLOUD_API_KEY,
        },
      });

      const result = response.data.results[0];
      if (result) {
        return res.json({ address: result.formatted_address });
      }
    }

    // Fallback: free OpenStreetMap Nominatim reverse geocoding
    const nomResponse = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json' },
      headers: { 'User-Agent': 'FreedomRide-Dev/1.0' },
    });

    res.json({ address: nomResponse.data.display_name || 'Unknown location' });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/calculate-route
router.post('/calculate-route', async (req, res, next) => {
  try {
    const schema = Joi.object({
      pickup: Joi.object({ lat: Joi.number().required(), lng: Joi.number().required() }).required(),
      dropoff: Joi.object({ lat: Joi.number().required(), lng: Joi.number().required() }).required(),
    });
    const { pickup, dropoff } = await schema.validateAsync(req.body);

    let distanceKm, durationMinutes, polylinePoints;

    // Try Google Directions API if key is configured
    if (process.env.GOOGLE_CLOUD_API_KEY && process.env.GOOGLE_CLOUD_API_KEY !== 'your-google-cloud-api-key') {
      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${pickup.lat},${pickup.lng}`,
          destination: `${dropoff.lat},${dropoff.lng}`,
          key: process.env.GOOGLE_CLOUD_API_KEY,
        },
      });

      const route = response.data.routes[0];
      if (route) {
        const leg = route.legs[0];
        distanceKm = leg.distance.value / 1000;
        durationMinutes = Math.ceil(leg.duration.value / 60);
        polylinePoints = route.overview_polyline.points;
      }
    }

    // Fallback: free OSRM routing
    if (!distanceKm) {
      const osrmRes = await axios.get(
        `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`,
        { params: { overview: 'full', geometries: 'polyline' } }
      );

      const osrmRoute = osrmRes.data.routes[0];
      if (!osrmRoute) {
        return res.status(404).json({ error: 'No route found' });
      }

      distanceKm = osrmRoute.distance / 1000;
      durationMinutes = Math.ceil(osrmRoute.duration / 60);
      polylinePoints = osrmRoute.geometry;
    }

    // Get fare configs from all active operators
    const fareConfigs = await db('fare_config')
      .join('operators', 'fare_config.operator_id', 'operators.id')
      .where('operators.is_active', true)
      .select('fare_config.*');

    // Calculate fares for each vehicle type
    const fares = {};
    for (const type of ['auto', 'economy', 'sedan', 'suv']) {
      const config = fareConfigs.find((f) => f.vehicle_type === type);
      if (config) {
        fares[type] = calculateFare({
          baseFare: parseFloat(config.base_fare),
          perKmRate: parseFloat(config.per_km_rate),
          perMinuteRate: parseFloat(config.per_minute_rate),
          minimumFare: parseFloat(config.minimum_fare),
          distanceKm,
          durationMinutes,
        });
      }
    }

    res.json({
      distance_km: Math.round(distanceKm * 100) / 100,
      duration_minutes: durationMinutes,
      polyline: polylinePoints,
      fares,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/book-ride
router.post('/book-ride', async (req, res, next) => {
  try {
    const schema = Joi.object({
      pickup: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required(),
        address: Joi.string().max(500),
      }).required(),
      dropoff: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required(),
        address: Joi.string().max(500),
      }).required(),
      vehicle_type: Joi.string().valid('auto', 'economy', 'sedan', 'suv').required(),
      payment_method: Joi.string().valid('cash', 'upi').default('cash'),
      estimated_fare: Joi.number().positive(),
      estimated_distance_km: Joi.number().positive(),
      estimated_duration_minutes: Joi.number().integer().positive(),
    });
    const data = await schema.validateAsync(req.body);

    const otpCode = generateOTP(4);

    const [ride] = await db('rides').insert({
      passenger_id: req.user.id,
      status: 'searching',
      pickup_lat: data.pickup.lat,
      pickup_lng: data.pickup.lng,
      pickup_address: data.pickup.address,
      dropoff_lat: data.dropoff.lat,
      dropoff_lng: data.dropoff.lng,
      dropoff_address: data.dropoff.address,
      vehicle_type_requested: data.vehicle_type,
      estimated_fare: data.estimated_fare,
      estimated_distance_km: data.estimated_distance_km,
      estimated_duration_minutes: data.estimated_duration_minutes,
      otp_code: otpCode,
      payment_method: data.payment_method,
    }).returning('*');

    // Start driver matching asynchronously
    findAndAssignDriver(ride.id).catch((err) => {
      console.error('Driver matching error:', err.message);
    });

    res.status(201).json({
      ride_id: ride.id,
      status: ride.status,
      otp: otpCode,
      message: 'Searching for a driver...',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/passenger/ride/:id/status
router.get('/ride/:id/status', async (req, res, next) => {
  try {
    const ride = await db('rides')
      .where({ id: req.params.id, passenger_id: req.user.id })
      .first();

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    let driver = null;
    let vehicle = null;
    if (ride.driver_id) {
      driver = await db('drivers')
        .where({ id: ride.driver_id })
        .select('id', 'name', 'phone', 'profile_photo_url', 'current_lat', 'current_lng', 'rating_avg')
        .first();
      vehicle = await db('vehicles')
        .join('drivers', 'drivers.vehicle_id', 'vehicles.id')
        .where('drivers.id', ride.driver_id)
        .select('vehicles.registration_number', 'vehicles.make', 'vehicles.model', 'vehicles.color', 'vehicles.vehicle_type')
        .first();
    }

    res.json({
      ride_id: ride.id,
      status: ride.status,
      pickup_lat: ride.pickup_lat,
      pickup_lng: ride.pickup_lng,
      pickup_address: ride.pickup_address,
      dropoff_lat: ride.dropoff_lat,
      dropoff_lng: ride.dropoff_lng,
      dropoff_address: ride.dropoff_address,
      estimated_fare: ride.estimated_fare,
      actual_fare: ride.actual_fare,
      otp: ride.otp_code,
      payment_method: ride.payment_method,
      vehicle_type_requested: ride.vehicle_type_requested,
      driver,
      vehicle,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/ride/:id/cancel
router.post('/ride/:id/cancel', async (req, res, next) => {
  try {
    const { reason } = await Joi.object({
      reason: Joi.string().max(500),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: req.params.id, passenger_id: req.user.id })
      .whereIn('status', ['searching', 'driver_assigned', 'driver_arriving'])
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'Ride cannot be cancelled' });
    }

    await db('rides').where({ id: ride.id }).update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: reason,
    });

    // If a driver was assigned, set them back to online
    if (ride.driver_id) {
      await db('drivers').where({ id: ride.driver_id }).update({ status: 'online' });
    }

    // Expire any pending ride requests
    await db('ride_requests').where({ ride_id: ride.id, status: 'pending' }).update({ status: 'expired' });

    const io = require('../websocket/socketServer').getIO();
    if (ride.driver_id) {
      io.to(`driver:${ride.driver_id}`).emit('ride_cancelled', { ride_id: ride.id, reason });
    }

    res.json({ message: 'Ride cancelled', ride_id: ride.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/ride/:id/rate
router.post('/ride/:id/rate', async (req, res, next) => {
  try {
    const { rating, feedback } = await Joi.object({
      rating: Joi.number().integer().min(1).max(5).required(),
      feedback: Joi.string().max(500),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: req.params.id, passenger_id: req.user.id, status: 'completed' })
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'Cannot rate this ride' });
    }

    await db('rides').where({ id: ride.id }).update({ driver_rating: rating });

    // Update driver average rating
    if (ride.driver_id) {
      const { avg } = await db('rides')
        .where({ driver_id: ride.driver_id })
        .whereNotNull('driver_rating')
        .avg('driver_rating as avg')
        .first();
      await db('drivers').where({ id: ride.driver_id }).update({ rating_avg: parseFloat(avg).toFixed(1) });
    }

    res.json({ message: 'Rating submitted', rating });
  } catch (err) {
    next(err);
  }
});

// GET /api/passenger/ride-history
router.get('/ride-history', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const rides = await db('rides')
      .where({ passenger_id: req.user.id })
      .whereIn('status', ['completed', 'cancelled'])
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db('rides')
      .where({ passenger_id: req.user.id })
      .whereIn('status', ['completed', 'cancelled'])
      .count();

    res.json({ rides, total: parseInt(count), page, limit });
  } catch (err) {
    next(err);
  }
});

// POST /api/passenger/share-trip
router.post('/share-trip', async (req, res, next) => {
  try {
    const { ride_id, contact_phone } = await Joi.object({
      ride_id: Joi.string().uuid().required(),
      contact_phone: Joi.string().pattern(/^\+91\d{10}$/).required(),
    }).validateAsync(req.body);

    const ride = await db('rides')
      .where({ id: ride_id, passenger_id: req.user.id })
      .whereIn('status', ['driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'])
      .first();

    if (!ride) {
      return res.status(400).json({ error: 'No active ride to share' });
    }

    // In production, send SMS with tracking link
    const trackingUrl = `${process.env.BASE_URL || 'https://freedom.app'}/track/${ride.id}`;
    console.log(`[DEV] Trip shared: ${trackingUrl} → ${contact_phone}`);

    res.json({ message: 'Trip shared successfully', tracking_url: trackingUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
