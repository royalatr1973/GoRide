module.exports = {
  USER_TYPES: {
    PASSENGER: 'passenger',
    DRIVER: 'driver',
    OPERATOR: 'operator'
  },

  RIDE_STATUS: {
    REQUESTED: 'requested',
    ACCEPTED: 'accepted',
    ARRIVING: 'arriving',
    STARTED: 'started',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  DRIVER_STATUS: {
    AVAILABLE: 'available',
    BUSY: 'busy',
    OFFLINE: 'offline'
  },

  PAYMENT_METHODS: {
    CASH: 'cash',
    CARD: 'card',
    WALLET: 'wallet',
    UPI: 'upi'
  },

  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },

  VEHICLE_TYPES: {
    SEDAN: 'sedan',
    SUV: 'suv',
    HATCHBACK: 'hatchback',
    AUTO: 'auto'
  },

  DOCUMENT_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  // Fare defaults (can be overridden by operator pricing)
  DEFAULT_FARE: {
    BASE_FARE: 50,
    PER_KM_RATE: 12,
    PER_MINUTE_RATE: 2,
    MINIMUM_FARE: 80,
    SURGE_MULTIPLIER: 1.0
  },

  // Search radius for nearby drivers (in meters)
  NEARBY_DRIVER_RADIUS: 5000,

  // Location update interval (ms)
  LOCATION_UPDATE_INTERVAL: 5000
};
