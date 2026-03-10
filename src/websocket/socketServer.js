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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('[Socket] Auth failed:', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.user;
    console.log(`Socket connected: ${role}:${id}`);

    // Join role-specific room
    const room = `${role}:${id}`;
    socket.join(room);

    // Verify room was joined
    const roomSockets = io.sockets.adapter.rooms.get(room);
    console.log(`[Socket] Joined room '${room}' — ${roomSockets ? roomSockets.size : 0} socket(s) in room`);

    // For drivers, verify DB record exists and look up operator_id
    if (role === 'driver') {
      try {
        const db = require('../db/connection');
        const driver = await db('drivers').where({ id }).select('id', 'name', 'operator_id').first();
        if (driver) {
          console.log(`[Socket] Driver verified: ${driver.name} (${driver.id})`);
          if (driver.operator_id) {
            socket.user.operator_id = driver.operator_id;
          }
        } else {
          console.warn(`[Socket] WARNING: No driver found in DB with id=${id}`);
        }
      } catch (err) {
        console.error(`[Socket] DB lookup error for driver ${id}:`, err.message);
      }

      socket.on('driver:location_update', async (data) => {
        // Broadcast to operator dashboard (use looked-up operator_id)
        if (socket.user.operator_id) {
          io.to(`operator:${socket.user.operator_id}`).emit('driver_location_update', {
            driver_id: id,
            ...data,
          });
        }

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

// Helper to notify an operator's dashboard about ride/driver changes
function notifyOperator(operatorId, event, data) {
  if (!io || !operatorId) return;
  io.to(`operator:${operatorId}`).emit(event, data);
}

module.exports = { initSocketServer, getIO, notifyOperator };
