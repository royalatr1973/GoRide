/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Estimate ride duration based on distance
 * Assumes average speed of 25 km/h in city
 * @returns duration in minutes
 */
function estimateDuration(distanceKm) {
  const avgSpeedKmh = 25;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

/**
 * Generate a unique booking reference
 */
function generateBookingRef() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `GR-${dateStr}-${random}`;
}

/**
 * Paginate results helper
 */
function paginate(page = 1, limit = 20) {
  const skip = (Math.max(1, page) - 1) * limit;
  return { skip, limit: Math.min(limit, 100) };
}

module.exports = {
  calculateDistance,
  estimateDuration,
  generateBookingRef,
  paginate
};
