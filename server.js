const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./backend/routes/auth.routes');
const passengerRoutes = require('./backend/routes/passengers.routes');
const driverRoutes = require('./backend/routes/drivers.routes');
const rideRoutes = require('./backend/routes/rides.routes');
const vehicleRoutes = require('./backend/routes/vehicles.routes');
const operatorRoutes = require('./backend/routes/operators.routes');

// Import middleware
const errorHandler = require('./backend/middleware/errorHandler');

// Import socket handler
const setupSockets = require('./backend/sockets/socketHandler');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Make io accessible to routes
app.set('io', io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/passenger', express.static(path.join(__dirname, 'frontend', 'passenger')));
app.use('/driver', express.static(path.join(__dirname, 'frontend', 'driver')));
app.use('/operator', express.static(path.join(__dirname, 'frontend', 'operator')));
app.use('/common', express.static(path.join(__dirname, 'frontend', 'common')));
app.use('/uploads', express.static(path.join(__dirname, 'backend', 'uploads')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/passengers', passengerRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/operators', operatorRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Landing page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'common', 'landing.html'));
});

// Error handler (must be last)
app.use(errorHandler);

// Setup Socket.io events
setupSockets(io);

// Start server
server.listen(env.PORT, () => {
  console.log(`GoRide server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`Passenger app: ${env.SERVER_URL}/passenger`);
  console.log(`Driver app:    ${env.SERVER_URL}/driver`);
  console.log(`Operator app:  ${env.SERVER_URL}/operator`);
});

module.exports = { app, server, io };
