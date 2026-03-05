const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

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

// Build directories
const driverBuild = path.join(__dirname, '../driver-app/build');
const dashboardBuild = path.join(__dirname, '../operator-dashboard/build');
const passengerBuild = path.join(__dirname, '../passenger-app/build');

const buildExists = (dir) => fs.existsSync(dir);
const missingBuildPage = (appName) => `<!doctype html><html><head><title>${appName} - Build Missing</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>${appName} build not found</h2><p>Run this from the project root:</p><pre style="background:#f3f4f6;padding:16px;border-radius:8px;display:inline-block">npm run build:apps</pre></body></html>`;

// Helper: read a sub-app's index.html and ensure asset paths include the sub-path prefix.
// This fixes builds where react-scripts didn't apply the "homepage" field.
function getSubAppHtml(buildDir, prefix) {
  try {
    const raw = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
    // If paths already have the prefix, return as-is
    if (raw.includes(`="${prefix}/static/`)) return raw;
    // Rewrite /static/ references to include the sub-app prefix
    return raw
      .replace(/(src|href)="\/static\//g, `$1="${prefix}/static/`)
      .replace(/(src|href)="\/favicon/g, `$1="${prefix}/favicon`);
  } catch (e) {
    return missingBuildPage(prefix.slice(1));
  }
}

// Cache patched HTML at startup
const driverHtml = getSubAppHtml(driverBuild, '/driver');
const dashboardHtml = getSubAppHtml(dashboardBuild, '/dashboard');

// Serve sub-app static files (index: false — we serve patched HTML ourselves)
if (buildExists(dashboardBuild)) {
  app.use('/dashboard', express.static(dashboardBuild, { index: false }));
} else {
  console.warn('WARNING: operator-dashboard/build not found. Run: npm run build:apps');
}

if (buildExists(driverBuild)) {
  app.use('/driver', express.static(driverBuild, { index: false }));
} else {
  console.warn('WARNING: driver-app/build not found. Run: npm run build:apps');
}

// Serve passenger app static files
if (buildExists(passengerBuild)) {
  app.use(express.static(passengerBuild));
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

// Debug endpoint — check driver matching readiness
app.get('/api/debug/match-check', async (req, res) => {
  try {
    const db = require('./db/connection');
    const drivers = await db('drivers').select('*');
    const results = [];

    for (const d of drivers) {
      const checks = {
        id: d.id,
        name: d.name,
        phone: d.phone,
        status: d.status,
        is_verified: d.is_verified,
        has_location: !!(d.current_lat && d.current_lng),
        vehicle_id: d.vehicle_id,
        operator_id: d.operator_id,
        vehicle: null,
        operator: null,
        issues: [],
      };

      if (!d.is_verified) checks.issues.push('NOT VERIFIED (is_verified=false)');
      if (!['online', 'arriving'].includes(d.status)) checks.issues.push(`STATUS is "${d.status}" (needs "online" or "arriving")`);
      if (!d.current_lat || !d.current_lng) checks.issues.push('NO LOCATION SET (current_lat/lng missing)');

      if (d.vehicle_id) {
        const v = await db('vehicles').where({ id: d.vehicle_id }).first();
        if (v) {
          checks.vehicle = { type: v.vehicle_type, make: v.make, model: v.model, is_active: v.is_active, reg: v.registration_number };
          if (!v.is_active) checks.issues.push('VEHICLE NOT ACTIVE');
        } else {
          checks.issues.push('VEHICLE NOT FOUND in DB');
        }
      } else {
        checks.issues.push('NO VEHICLE ASSIGNED');
      }

      if (d.operator_id) {
        const op = await db('operators').where({ id: d.operator_id }).first();
        if (op) {
          checks.operator = { name: op.name, is_active: op.is_active };
          if (!op.is_active) checks.issues.push('OPERATOR NOT ACTIVE');
        } else {
          checks.issues.push('OPERATOR NOT FOUND in DB');
        }
      } else {
        checks.issues.push('NO OPERATOR ASSIGNED');
      }

      checks.ready = checks.issues.length === 0;
      results.push(checks);
    }

    // Also check WebSocket rooms for drivers
    try {
      const { getIO } = require('./websocket/socketServer');
      const io = getIO();
      for (const r of results) {
        const room = `driver:${r.id}`;
        const sockets = io.sockets.adapter.rooms.get(room);
        r.websocket_connected = sockets ? sockets.size : 0;
      }
    } catch {}

    res.json({ drivers: results });
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

// SPA fallback for driver app (serves patched HTML with correct asset paths)
app.get(['/driver', '/driver/*'], (req, res) => {
  res.type('html').send(driverHtml);
});

// SPA fallback for operator dashboard (serves patched HTML with correct asset paths)
app.get(['/dashboard', '/dashboard/*'], (req, res) => {
  res.type('html').send(dashboardHtml);
});

// Serve passenger app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const index = path.join(passengerBuild, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.send(missingBuildPage('Passenger App'));
});

// Error handler
app.use(errorHandler);

module.exports = app;
