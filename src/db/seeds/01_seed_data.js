const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  // Clear existing data
  await knex('conversation_sessions').del();
  await knex('otp_codes').del();
  await knex('transactions').del();
  await knex('fare_config').del();
  await knex('ride_requests').del();
  await knex('rides').del();
  await knex('drivers').del();
  await knex('vehicles').del();
  await knex('operators').del();
  await knex('passengers').del();

  // Seed operator
  const operatorId = uuidv4();
  await knex('operators').insert({
    id: operatorId,
    name: 'Rajesh Kumar',
    phone: '+919876543210',
    business_name: 'Chennai City Rides',
    city: 'Chennai',
    commission_rate: 10.00,
  });

  // Seed vehicles
  const vehicles = [
    { id: uuidv4(), operator_id: operatorId, registration_number: 'TN-09-AB-1234', make: 'Maruti', model: 'Swift', color: 'White', vehicle_type: 'economy', seats: 4 },
    { id: uuidv4(), operator_id: operatorId, registration_number: 'TN-09-CD-5678', make: 'Hyundai', model: 'Verna', color: 'Silver', vehicle_type: 'sedan', seats: 4 },
    { id: uuidv4(), operator_id: operatorId, registration_number: 'TN-09-EF-9012', make: 'Bajaj', model: 'RE Auto', color: 'Green', vehicle_type: 'auto', seats: 3 },
    { id: uuidv4(), operator_id: operatorId, registration_number: 'TN-09-GH-3456', make: 'Toyota', model: 'Innova', color: 'Black', vehicle_type: 'suv', seats: 6 },
  ];
  await knex('vehicles').insert(vehicles);

  // Seed drivers
  await knex('drivers').insert([
    { id: uuidv4(), name: 'Murugan', phone: '+919000000001', license_number: 'TN0120230001', operator_id: operatorId, vehicle_id: vehicles[0].id, status: 'online', current_lat: 13.0827, current_lng: 80.2707, is_verified: true },
    { id: uuidv4(), name: 'Senthil', phone: '+919000000002', license_number: 'TN0120230002', operator_id: operatorId, vehicle_id: vehicles[1].id, status: 'online', current_lat: 13.0600, current_lng: 80.2500, is_verified: true },
    { id: uuidv4(), name: 'Kannan', phone: '+919000000003', license_number: 'TN0120230003', operator_id: operatorId, vehicle_id: vehicles[2].id, status: 'online', current_lat: 13.0400, current_lng: 80.2300, is_verified: true },
    { id: uuidv4(), name: 'Arun', phone: '+919000000004', license_number: 'TN0120230004', operator_id: operatorId, vehicle_id: vehicles[3].id, status: 'offline', current_lat: 13.0100, current_lng: 80.2100, is_verified: true },
  ]);

  // Seed fare config
  await knex('fare_config').insert([
    { operator_id: operatorId, vehicle_type: 'auto', base_fare: 30, per_km_rate: 12, per_minute_rate: 1, minimum_fare: 50 },
    { operator_id: operatorId, vehicle_type: 'economy', base_fare: 50, per_km_rate: 15, per_minute_rate: 1.5, minimum_fare: 80 },
    { operator_id: operatorId, vehicle_type: 'sedan', base_fare: 80, per_km_rate: 20, per_minute_rate: 2, minimum_fare: 120 },
    { operator_id: operatorId, vehicle_type: 'suv', base_fare: 120, per_km_rate: 28, per_minute_rate: 3, minimum_fare: 200 },
  ]);

  // Seed a test passenger
  await knex('passengers').insert({
    id: uuidv4(),
    name: 'Priya',
    phone: '+919111111111',
    language_preference: 'ta',
  });
};
