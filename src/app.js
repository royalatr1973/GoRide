const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const passengerRoutes = require('./routes/passenger');
const driverRoutes = require('./routes/driver');
const operatorRoutes = require('./routes/operator');
const voiceRoutes = require('./routes/voice');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security & parsing middleware
const isDev = process.env.NODE_ENV !== 'production';
app.use(helmet({
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com"],
      connectSrc: ["'self'", "https://router.project-osrm.org", "wss:", "ws:"],
    },
  },
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve operator dashboard static files
app.use('/dashboard', express.static(path.join(__dirname, '../operator-dashboard/build')));

// Serve driver app static files
app.use('/driver', express.static(path.join(__dirname, '../driver-app/build')));

// Serve passenger app static files
app.use(express.static(path.join(__dirname, '../passenger-app/build')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/passenger', passengerRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/voice', voiceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Freedom Ride API', timestamp: new Date().toISOString() });
});

// Debug endpoint — check what's in the database (dev only)
app.get('/api/debug/drivers', async (req, res) => {
  try {
    const db = require('./db/connection');
    const drivers = await db('drivers').select('*');
    const vehicles = await db('vehicles').select('*');
    const operators = await db('operators').select('*');
    const rides = await db('rides').select('id', 'status', 'vehicle_type_requested', 'driver_id', 'cancellation_reason').orderBy('created_at', 'desc').limit(10);
    res.json({ drivers, vehicles, operators, recent_rides: rides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint — check WebSocket rooms and connected sockets
app.get('/api/debug/sockets', (req, res) => {
  try {
    const { getIO } = require('./websocket/socketServer');
    const io = getIO();
    const rooms = {};
    for (const [roomName, socketIds] of io.sockets.adapter.rooms) {
      // Skip per-socket rooms (socket IDs also appear as room names)
      if (!io.sockets.sockets.has(roomName)) {
        rooms[roomName] = Array.from(socketIds);
      }
    }
    const connectedCount = io.sockets.sockets.size;
    res.json({ connected_sockets: connectedCount, rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tile proxy — serves map tiles from the backend so they aren't blocked by CSP or firewalls
app.get('/api/tiles/:z/:x/:y', (req, res) => {
  const { z, x, y } = req.params;
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  require('https').get(url, { headers: { 'User-Agent': 'GoRide/1.0' } }, (tileRes) => {
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    tileRes.pipe(res);
  }).on('error', () => {
    res.status(502).end();
  });
});

// SPA fallback for driver app
app.get('/driver/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../driver-app/build', 'index.html'));
});

// SPA fallback for operator dashboard
app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../operator-dashboard/build', 'index.html'));
});

// Serve passenger app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../passenger-app/build', 'index.html'));
});

// Error handler
app.use(errorHandler);

module.exports = app;
