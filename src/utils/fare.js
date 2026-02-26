/**
 * Calculate fare based on fare config, distance, duration, and surge.
 */
function calculateFare({ baseFare, perKmRate, perMinuteRate, minimumFare, distanceKm, durationMinutes, surgeMultiplier = 1.0 }) {
  let fare = baseFare + (distanceKm * perKmRate) + (durationMinutes * perMinuteRate);
  if (fare < minimumFare) fare = minimumFare;
  fare *= surgeMultiplier;
  return Math.round(fare); // Round to nearest rupee
}

module.exports = { calculateFare };
