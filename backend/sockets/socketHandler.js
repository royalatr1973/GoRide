const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { RIDE_STATUS, DRIVER_STATUS } = require('../../config/constants');

function setupSockets(io) {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userType = decoded.userType;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userType})`);

    // Join user-specific room
    socket.join(`${socket.userType}_${socket.userId}`);

    // === DRIVER EVENTS ===

    // Driver goes online
    socket.on('driver_online', async (data) => {
      try {
        const driver = await Driver.findOneAndUpdate(
          { userId: socket.userId },
          {
            status: DRIVER_STATUS.AVAILABLE,
            socketId: socket.id,
            currentLocation: {
              type: 'Point',
              coordinates: [data.longitude, data.latitude],
              lastUpdated: new Date()
            }
          },
          { new: true }
        );

        if (driver) {
          socket.join(`driver_${driver._id}`);
          socket.driverId = driver._id;
          socket.emit('status_updated', { status: DRIVER_STATUS.AVAILABLE });
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to go online' });
      }
    });

    // Driver goes offline
    socket.on('driver_offline', async () => {
      try {
        if (socket.driverId) {
          await Driver.findByIdAndUpdate(socket.driverId, {
            status: DRIVER_STATUS.OFFLINE,
            socketId: null
          });
          socket.emit('status_updated', { status: DRIVER_STATUS.OFFLINE });
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to go offline' });
      }
    });

    // Driver location update (continuous tracking)
    socket.on('location_update', async (data) => {
      try {
        const { latitude, longitude, rideId } = data;

        // Update driver location in DB
        if (socket.driverId) {
          await Driver.findByIdAndUpdate(socket.driverId, {
            currentLocation: {
              type: 'Point',
              coordinates: [longitude, latitude],
              lastUpdated: new Date()
            }
          });
        }

        // If actively on a ride, broadcast location to passenger
        if (rideId) {
          const ride = await Ride.findById(rideId);
          if (ride && ride.passengerId) {
            io.to(`passenger_${ride.passengerId}`).emit('driver_location', {
              rideId,
              latitude,
              longitude,
              timestamp: new Date()
            });

            // Store route point
            ride.routePoints.push({ latitude, longitude, timestamp: new Date() });
            await ride.save();
          }
        }
      } catch (err) {
        // Silent fail for location updates
      }
    });

    // Driver accepts ride
    socket.on('ride_accept', async (data) => {
      try {
        const { rideId } = data;
        const ride = await Ride.findById(rideId);

        if (!ride || ride.status !== RIDE_STATUS.REQUESTED) {
          socket.emit('ride_error', { message: 'Ride is no longer available' });
          return;
        }

        const driver = await Driver.findOne({ userId: socket.userId }).populate('vehicleId');
        if (!driver) return;

        ride.driverId = driver._id;
        ride.vehicleId = driver.vehicleId?._id;
        ride.operatorId = driver.operatorId;
        ride.status = RIDE_STATUS.ACCEPTED;
        ride.acceptedAt = new Date();
        await ride.save();

        driver.status = DRIVER_STATUS.BUSY;
        await driver.save();

        // Join ride room
        socket.join(`ride_${rideId}`);

        // Notify passenger
        io.to(`passenger_${ride.passengerId}`).emit('ride_accepted', {
          rideId: ride._id,
          driver: {
            id: driver._id,
            name: driver.userId,
            rating: driver.rating,
            vehicle: driver.vehicleId,
            location: driver.currentLocation
          }
        });

        socket.emit('ride_confirmed', { ride });
      } catch (err) {
        socket.emit('ride_error', { message: 'Failed to accept ride' });
      }
    });

    // Driver rejects ride
    socket.on('ride_reject', (data) => {
      // Simply acknowledge; ride stays in "requested" status for other drivers
      socket.emit('ride_rejected', { rideId: data.rideId });
    });

    // Ride status updates from driver
    socket.on('ride_status', async (data) => {
      try {
        const { rideId, status } = data;
        const ride = await Ride.findById(rideId);
        if (!ride) return;

        ride.status = status;
        if (status === RIDE_STATUS.ARRIVING) ride.arrivingAt = new Date();
        if (status === RIDE_STATUS.STARTED) ride.startedAt = new Date();
        if (status === RIDE_STATUS.COMPLETED) {
          ride.completedAt = new Date();
          ride.distance = data.distance || ride.estimatedDistance;
          ride.duration = data.duration || ride.estimatedDuration;

          // Free driver
          if (socket.driverId) {
            const driver = await Driver.findById(socket.driverId);
            if (driver) {
              driver.status = DRIVER_STATUS.AVAILABLE;
              driver.rating.completedRides += 1;
              await driver.save();
            }
          }
        }
        await ride.save();

        // Broadcast to ride room
        io.to(`ride_${rideId}`).emit('ride_status_update', {
          rideId,
          status,
          fare: ride.fare,
          timestamp: new Date()
        });
      } catch (err) {
        socket.emit('ride_error', { message: 'Failed to update status' });
      }
    });

    // === PASSENGER EVENTS ===

    // Passenger joins their room
    socket.on('passenger_connect', () => {
      socket.join(`passenger_${socket.userId}`);
    });

    // Passenger joins ride room for tracking
    socket.on('join_ride', (data) => {
      socket.join(`ride_${data.rideId}`);
    });

    // Passenger cancels ride
    socket.on('ride_cancel', async (data) => {
      try {
        const { rideId, reason } = data;
        const ride = await Ride.findById(rideId);
        if (!ride) return;

        ride.status = RIDE_STATUS.CANCELLED;
        ride.cancelledAt = new Date();
        ride.cancellationReason = reason;
        ride.cancelledBy = socket.userType;
        await ride.save();

        // Free driver if assigned
        if (ride.driverId) {
          await Driver.findByIdAndUpdate(ride.driverId, { status: DRIVER_STATUS.AVAILABLE });
          io.to(`driver_${ride.driverId}`).emit('ride_cancelled', { rideId, reason });
        }

        io.to(`ride_${rideId}`).emit('ride_cancelled', { rideId, reason, cancelledBy: socket.userType });
      } catch (err) {
        socket.emit('ride_error', { message: 'Failed to cancel ride' });
      }
    });

    // === CHAT EVENTS ===

    socket.on('chat_message', (data) => {
      const { rideId, message } = data;
      io.to(`ride_${rideId}`).emit('chat_message', {
        rideId,
        senderId: socket.userId,
        senderType: socket.userType,
        message,
        timestamp: new Date()
      });
    });

    // === DISCONNECT ===

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId}`);

      // If driver, set to offline
      if (socket.userType === 'driver' && socket.driverId) {
        await Driver.findByIdAndUpdate(socket.driverId, {
          status: DRIVER_STATUS.OFFLINE,
          socketId: null
        });
      }
    });
  });
}

module.exports = setupSockets;
