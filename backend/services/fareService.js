const FarePricing = require('../models/FarePricing');
const { DEFAULT_FARE } = require('../../config/constants');
const { calculateDistance } = require('../utils/helpers');

/**
 * Get fare pricing for an operator (or default)
 */
async function getFarePricing(operatorId) {
  if (operatorId) {
    const pricing = await FarePricing.findOne({ operatorId, isActive: true });
    if (pricing) return pricing;
  }
  return DEFAULT_FARE;
}

/**
 * Calculate fare estimate for a ride
 */
async function calculateFare({ pickupLat, pickupLng, dropLat, dropLng, vehicleType = 'sedan', operatorId = null }) {
  const pricing = await getFarePricing(operatorId);

  const distance = calculateDistance(pickupLat, pickupLng, dropLat, dropLng);
  const duration = Math.round((distance / 25) * 60); // Assume 25 km/h avg city speed

  const baseFare = pricing.baseFare || pricing.BASE_FARE;
  const perKmRate = pricing.perKmRate || pricing.PER_KM_RATE;
  const perMinuteRate = pricing.perMinuteRate || pricing.PER_MINUTE_RATE;
  const minimumFare = pricing.minimumFare || pricing.MINIMUM_FARE;
  const surgeMultiplier = pricing.surgeMultiplier || pricing.SURGE_MULTIPLIER || 1.0;

  // Vehicle type multiplier
  let vehicleMultiplier = 1.0;
  if (pricing.vehicleTypeRates && pricing.vehicleTypeRates[vehicleType]) {
    vehicleMultiplier = pricing.vehicleTypeRates[vehicleType].multiplier;
  }

  const distanceFare = distance * perKmRate;
  const timeFare = duration * perMinuteRate;
  let totalFare = (baseFare + distanceFare + timeFare) * vehicleMultiplier * surgeMultiplier;

  // Apply minimum fare
  totalFare = Math.max(totalFare, minimumFare);

  // Round to nearest integer
  totalFare = Math.round(totalFare);

  return {
    baseFare: Math.round(baseFare),
    distanceFare: Math.round(distanceFare),
    timeFare: Math.round(timeFare),
    surgeMultiplier,
    vehicleMultiplier,
    discount: 0,
    tax: 0,
    totalFare,
    distance: Math.round(distance * 10) / 10, // 1 decimal
    duration: Math.round(duration)
  };
}

/**
 * Calculate final fare after ride completion
 */
function calculateFinalFare({ actualDistance, actualDuration, baseFare, perKmRate, perMinuteRate, surgeMultiplier = 1.0, minimumFare = 80 }) {
  const distanceFare = actualDistance * perKmRate;
  const timeFare = actualDuration * perMinuteRate;
  let totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;
  totalFare = Math.max(totalFare, minimumFare);
  return Math.round(totalFare);
}

module.exports = {
  calculateFare,
  calculateFinalFare,
  getFarePricing
};
