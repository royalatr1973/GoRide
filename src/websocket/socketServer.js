const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    console.log(`Socket connected: ${role}:${id}`);

    // Join role-specific room
    socket.join(`${role}:${id}`);

    // Driver location updates → broadcast to passenger + operator
    if (role === 'driver') {
      socket.on('driver:location_update', async (data) => {
        // Broadcast to operator dashboard
        io.to(`operator:${socket.user.operator_id}`).emit('driver_location_update', {
          driver_id: id,
          ...data,
        });

        // Broadcast to passenger of active ride
        try {
          const db = require('../db/connection');
          const activeRide = await db('rides')
            .where({ driver_id: id })
            .whereIn('status', ['driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'])
            .first();
          if (activeRide) {
            io.to(`passenger:${activeRide.passenger_id}`).emit('driver_location', {
              ride_id: activeRide.id,
              lat: data.lat,
              lng: data.lng,
            });
          }
        } catch { /* ignore */ }
      });
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${role}:${id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

module.exports = { initSocketServer, getIO };
