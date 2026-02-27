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
app.use(helmet({
  contentSecurityPolicy: {
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

// Serve passenger app for all non-API routes (SPA fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/dashboard')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../passenger-app/build', 'index.html'));
});

// Error handler
app.use(errorHandler);

module.exports = app;
