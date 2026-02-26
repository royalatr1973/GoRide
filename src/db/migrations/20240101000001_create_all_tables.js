/**
 * Freedom ride-sharing platform — complete database schema
 */
exports.up = async function (knex) {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Passengers
  await knex.schema.createTable('passengers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 100);
    t.string('phone', 15).unique().notNullable();
    t.enu('language_preference', ['en', 'ta']).defaultTo('en');
    t.jsonb('saved_locations').defaultTo('[]');
    t.decimal('rating_avg', 2, 1).defaultTo(5.0);
    t.integer('total_rides').defaultTo(0);
    t.timestamps(true, true);
  });

  // Operators
  await knex.schema.createTable('operators', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 100).notNullable();
    t.string('phone', 15).unique().notNullable();
    t.string('business_name', 200);
    t.string('city', 50).defaultTo('Chennai');
    t.decimal('commission_rate', 4, 2).defaultTo(10.00);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Vehicles
  await knex.schema.createTable('vehicles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('operator_id').references('id').inTable('operators').onDelete('CASCADE');
    t.string('registration_number', 20).unique().notNullable();
    t.string('make', 50);
    t.string('model', 50);
    t.string('color', 30);
    t.enu('vehicle_type', ['auto', 'economy', 'sedan', 'suv']).notNullable();
    t.integer('seats');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Drivers
  await knex.schema.createTable('drivers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 100);
    t.string('phone', 15).unique().notNullable();
    t.string('profile_photo_url', 500);
    t.string('license_number', 50);
    t.uuid('operator_id').references('id').inTable('operators').onDelete('SET NULL');
    t.uuid('vehicle_id').references('id').inTable('vehicles').onDelete('SET NULL');
    t.enu('status', ['offline', 'online', 'on_trip', 'arriving']).defaultTo('offline');
    t.decimal('current_lat', 10, 7);
    t.decimal('current_lng', 10, 7);
    t.decimal('rating_avg', 2, 1).defaultTo(5.0);
    t.decimal('acceptance_rate', 4, 1).defaultTo(100.0);
    t.boolean('is_verified').defaultTo(false);
    t.timestamps(true, true);
  });

  // Rides
  await knex.schema.createTable('rides', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('passenger_id').references('id').inTable('passengers').onDelete('CASCADE').notNullable();
    t.uuid('driver_id').references('id').inTable('drivers').onDelete('SET NULL');
    t.uuid('operator_id').references('id').inTable('operators').onDelete('SET NULL');
    t.enu('status', [
      'searching', 'driver_assigned', 'driver_arriving',
      'driver_arrived', 'in_progress', 'completed', 'cancelled',
    ]).defaultTo('searching');
    t.decimal('pickup_lat', 10, 7).notNullable();
    t.decimal('pickup_lng', 10, 7).notNullable();
    t.string('pickup_address', 500);
    t.decimal('dropoff_lat', 10, 7).notNullable();
    t.decimal('dropoff_lng', 10, 7).notNullable();
    t.string('dropoff_address', 500);
    t.enu('vehicle_type_requested', ['auto', 'economy', 'sedan', 'suv']).notNullable();
    t.decimal('estimated_distance_km', 6, 2);
    t.integer('estimated_duration_minutes');
    t.decimal('estimated_fare', 8, 2);
    t.decimal('actual_fare', 8, 2);
    t.decimal('surge_multiplier', 3, 2).defaultTo(1.00);
    t.string('otp_code', 4);
    t.enu('payment_method', ['cash', 'upi']).defaultTo('cash');
    t.enu('payment_status', ['pending', 'completed']).defaultTo('pending');
    t.integer('passenger_rating');
    t.integer('driver_rating');
    t.timestamp('started_at');
    t.timestamp('completed_at');
    t.timestamp('cancelled_at');
    t.string('cancellation_reason', 500);
    t.timestamps(true, true);
  });

  // Ride Requests (driver matching queue)
  await knex.schema.createTable('ride_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('ride_id').references('id').inTable('rides').onDelete('CASCADE').notNullable();
    t.uuid('driver_id').references('id').inTable('drivers').onDelete('CASCADE').notNullable();
    t.enu('status', ['pending', 'accepted', 'declined', 'expired']).defaultTo('pending');
    t.timestamp('sent_at').defaultTo(knex.fn.now());
    t.timestamp('expires_at');
    t.timestamps(true, true);
  });

  // Fare Configuration
  await knex.schema.createTable('fare_config', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('operator_id').references('id').inTable('operators').onDelete('CASCADE').notNullable();
    t.enu('vehicle_type', ['auto', 'economy', 'sedan', 'suv']).notNullable();
    t.decimal('base_fare', 6, 2).notNullable();
    t.decimal('per_km_rate', 6, 2).notNullable();
    t.decimal('per_minute_rate', 6, 2).notNullable();
    t.decimal('minimum_fare', 6, 2).notNullable();
    t.timestamps(true, true);
    t.unique(['operator_id', 'vehicle_type']);
  });

  // Transactions
  await knex.schema.createTable('transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('ride_id').references('id').inTable('rides').onDelete('CASCADE').notNullable();
    t.decimal('total_fare', 8, 2).notNullable();
    t.decimal('commission_amount', 8, 2).notNullable();
    t.decimal('driver_earning', 8, 2).notNullable();
    t.enu('payment_method', ['cash', 'upi']).notNullable();
    t.enu('payment_status', ['pending', 'completed', 'failed']).defaultTo('pending');
    t.timestamps(true, true);
  });

  // OTP codes (for authentication)
  await knex.schema.createTable('otp_codes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('phone', 15).notNullable();
    t.string('code', 6).notNullable();
    t.enu('role', ['passenger', 'driver', 'operator']).notNullable();
    t.boolean('is_used').defaultTo(false);
    t.timestamp('expires_at').notNullable();
    t.timestamps(true, true);
  });

  // Conversation sessions (for voice AI state)
  await knex.schema.createTable('conversation_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('passenger_id').references('id').inTable('passengers').onDelete('CASCADE').notNullable();
    t.string('state', 50).defaultTo('greeting');
    t.jsonb('context').defaultTo('{}');
    t.jsonb('messages').defaultTo('[]');
    t.uuid('active_ride_id').references('id').inTable('rides').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  // Indexes for performance
  await knex.raw('CREATE INDEX idx_drivers_status ON drivers(status)');
  await knex.raw('CREATE INDEX idx_drivers_location ON drivers(current_lat, current_lng)');
  await knex.raw('CREATE INDEX idx_rides_status ON rides(status)');
  await knex.raw('CREATE INDEX idx_rides_passenger ON rides(passenger_id)');
  await knex.raw('CREATE INDEX idx_rides_driver ON rides(driver_id)');
  await knex.raw('CREATE INDEX idx_ride_requests_ride ON ride_requests(ride_id)');
  await knex.raw('CREATE INDEX idx_ride_requests_driver ON ride_requests(driver_id)');
  await knex.raw('CREATE INDEX idx_otp_phone ON otp_codes(phone, is_used)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('conversation_sessions');
  await knex.schema.dropTableIfExists('otp_codes');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('fare_config');
  await knex.schema.dropTableIfExists('ride_requests');
  await knex.schema.dropTableIfExists('rides');
  await knex.schema.dropTableIfExists('drivers');
  await knex.schema.dropTableIfExists('vehicles');
  await knex.schema.dropTableIfExists('operators');
  await knex.schema.dropTableIfExists('passengers');
};
