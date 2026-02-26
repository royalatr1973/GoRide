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

    // Driver location updates
    if (role === 'driver') {
      socket.on('driver:location_update', (data) => {
        // Broadcast to relevant passengers handled via REST API
        // This event can be used for real-time operator map
        io.to(`operator:${socket.user.operator_id}`).emit('driver_location_update', {
          driver_id: id,
          ...data,
        });
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
