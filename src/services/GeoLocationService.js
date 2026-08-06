/**
 * GeoLocationService.js  –  RobotInn Customer Mobile App
 *
 * Geographical location & distance calculation helper:
 * - Haversine Distance in Kilometers
 * - Radius checking
 * - Distance string formatting
 */

class GeoLocationService {
  /**
   * Calculate Haversine distance in KM between two lat/lng coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const p1 = parseFloat(lat1);
    const p2 = parseFloat(lon1);
    const p3 = parseFloat(lat2);
    const p4 = parseFloat(lon2);

    if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4) || (p1 === 0 && p2 === 0) || (p3 === 0 && p4 === 0)) {
      return 9999; // Return large distance if coordinates are missing/invalid
    }

    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(p3 - p1);
    const dLon = this.deg2rad(p4 - p2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(p1)) *
        Math.cos(this.deg2rad(p3)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    return parseFloat(distanceKm.toFixed(2));
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Format distance into human readable string e.g. "1.2 km" or "450 m"
   */
  formatDistance(distanceKm) {
    const dist = parseFloat(distanceKm);
    if (isNaN(dist) || dist >= 9000) return 'Distance N/A';
    if (dist < 1) {
      return `${Math.round(dist * 1000)} m`;
    }
    return `${dist.toFixed(1)} km`;
  }

  /**
   * Check if location (lat, lng) is within specified radius (in km) from center
   */
  isWithinRadius(centerLat, centerLng, targetLat, targetLng, radiusKm) {
    const distance = this.calculateDistance(centerLat, centerLng, targetLat, targetLng);
    return distance <= parseFloat(radiusKm);
  }
}

export default new GeoLocationService();
