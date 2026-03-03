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

// Helper: check if a build directory exists
const fs = require('fs');
const buildExists = (dir) => fs.existsSync(path.join(__dirname, dir));
const missingBuildPage = (appName) => `<!doctype html><html><head><title>${appName} - Build Missing</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>${appName} build not found</h2><p>Run this from the project root:</p><pre style="background:#f3f4f6;padding:16px;border-radius:8px;display:inline-block">npm run build:apps</pre></body></html>`;

// Serve operator dashboard static files
if (buildExists('../operator-dashboard/build')) {
  app.use('/dashboard', express.static(path.join(__dirname, '../operator-dashboard/build')));
} else {
  console.warn('WARNING: operator-dashboard/build not found. Run: npm run build:apps');
}

// Serve driver app static files
if (buildExists('../driver-app/build')) {
  app.use('/driver', express.static(path.join(__dirname, '../driver-app/build')));
} else {
  console.warn('WARNING: driver-app/build not found. Run: npm run build:apps');
}

// Serve passenger app static files
if (buildExists('../passenger-app/build')) {
  app.use(express.static(path.join(__dirname, '../passenger-app/build')));
} else {
  console.warn('WARNING: passenger-app/build not found. Run: npm run build:apps');
}

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
app.get('/driver', (req, res) => {
  const index = path.join(__dirname, '../driver-app/build', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send(missingBuildPage('Driver App'));
});
app.get('/driver/*', (req, res) => {
  const index = path.join(__dirname, '../driver-app/build', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send(missingBuildPage('Driver App'));
});

// SPA fallback for operator dashboard
app.get('/dashboard', (req, res) => {
  const index = path.join(__dirname, '../operator-dashboard/build', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send(missingBuildPage('Operator Dashboard'));
});
app.get('/dashboard/*', (req, res) => {
  const index = path.join(__dirname, '../operator-dashboard/build', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send(missingBuildPage('Operator Dashboard'));
});

// Serve passenger app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const index = path.join(__dirname, '../passenger-app/build', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send(missingBuildPage('Passenger App'));
});

// Error handler
app.use(errorHandler);

module.exports = app;
