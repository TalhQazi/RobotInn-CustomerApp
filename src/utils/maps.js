import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_GEOCODE_URL } from './constants';

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';

const geocodeCache = new Map();

export function normalizeRiderLocation(location) {
  if (!location) {
    return null;
  }

  const latitude = location.latitude ?? location.lat;
  const longitude = location.longitude ?? location.lng;

  if (latitude == null || longitude == null) {
    return null;
  }

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
    updatedAt: location.updatedAt || null,
  };
}

export async function geocodeAddress(address, area) {
  if (!address || address === '—') {
    return null;
  }

  const key = `${String(address).trim().toLowerCase()}|${String(area || '').trim().toLowerCase()}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  const cleanAddress = String(address).trim();
  const cleanArea = area ? String(area).trim() : '';

  const hasIslamabad = cleanAddress.toLowerCase().includes('islamabad');
  const hasPakistan = cleanAddress.toLowerCase().includes('pakistan');

  let suffix = '';
  if (!hasIslamabad) suffix += ', Islamabad';
  if (!hasPakistan) suffix += ', Pakistan';

  const queries = [];
  
  if (cleanArea) {
    const hasAreaInAddress = cleanAddress.toLowerCase().includes(cleanArea.toLowerCase());
    if (!hasAreaInAddress) {
      queries.push(`${cleanAddress}, ${cleanArea}${suffix}`);
    } else {
      queries.push(`${cleanAddress}${suffix}`);
    }
  } else {
    queries.push(`${cleanAddress}${suffix}`);
  }

  if (cleanArea && !cleanAddress.toLowerCase().includes(cleanArea.toLowerCase())) {
    queries.push(`${cleanAddress}${suffix}`);
  }

  if (cleanArea) {
    const areaHasIslamabad = cleanArea.toLowerCase().includes('islamabad');
    const areaHasPakistan = cleanArea.toLowerCase().includes('pakistan');
    let areaSuffix = '';
    if (!areaHasIslamabad) areaSuffix += ', Islamabad';
    if (!areaHasPakistan) areaSuffix += ', Pakistan';
    queries.push(`${cleanArea}${areaSuffix}`);
  }

  for (const queryText of queries) {
    try {
      const query = encodeURIComponent(queryText);
      const url = `${GOOGLE_MAPS_GEOCODE_URL}?address=${query}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const json = await response.json();

      if (json.status === 'OK' && json.results?.[0]?.geometry?.location) {
        const { lat, lng } = json.results[0].geometry.location;
        const coords = { lat, lng };
        geocodeCache.set(key, coords);
        return coords;
      }
    } catch (error) {
      console.error('geocodeAddress error:', error);
    }
  }

  return null;
}

export async function getDrivingDistance(origin, destination) {
  if (!origin?.lat || !destination?.lat) {
    return null;
  }

  try {
    const origins = `${origin.lat},${origin.lng}`;
    const destinations = `${destination.lat},${destination.lng}`;
    const url = `${DISTANCE_MATRIX_URL}?origins=${origins}&destinations=${destinations}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const json = await response.json();
    const element = json?.rows?.[0]?.elements?.[0];

    if (element?.status === 'OK') {
      return {
        distanceText: element.distance?.text || '',
        durationText: element.duration?.text || '',
        distanceMeters: element.distance?.value || 0,
        durationSeconds: element.duration?.value || 0,
      };
    }
  } catch (error) {
    console.error('getDrivingDistance error:', error);
  }

  return null;
}

const DEFAULT_MAP_REGION = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function buildStaticMapUrl({ rider, destination, width = 640, height = 280, cacheKey }) {
  if (!rider?.lat && !destination?.lat) {
    return null;
  }

  const parts = [
    `${STATIC_MAP_URL}?size=${width}x${height}`,
    'scale=2',
    'maptype=roadmap',
    `key=${GOOGLE_MAPS_API_KEY}`,
  ];

  if (rider?.lat && rider?.lng) {
    parts.push(`markers=color:0x2EC4B6|label:R|${rider.lat},${rider.lng}`);
  }

  if (destination?.lat && destination?.lng) {
    parts.push(`markers=color:red|label:D|${destination.lat},${destination.lng}`);
  }

  if (rider?.lat && destination?.lat) {
    parts.push(
      `path=color:0x2EC4B6ff|weight:4|${rider.lat},${rider.lng}|${destination.lat},${destination.lng}`
    );
    parts.push(`center=${(rider.lat + destination.lat) / 2},${(rider.lng + destination.lng) / 2}`);
    parts.push('zoom=13');
  } else if (rider?.lat) {
    parts.push(`center=${rider.lat},${rider.lng}`);
    parts.push('zoom=15');
  } else {
    parts.push(`center=${destination.lat},${destination.lng}`);
    parts.push('zoom=15');
  }

  if (cacheKey) {
    parts.push(`_t=${encodeURIComponent(String(cacheKey))}`);
  }

  return parts.join('&');
}

export function getMapRegion(rider, destination, useDefault = false) {
  if (rider?.lat && rider?.lng && destination?.lat && destination?.lng) {
    const minLat = Math.min(rider.lat, destination.lat);
    const maxLat = Math.max(rider.lat, destination.lat);
    const minLng = Math.min(rider.lng, destination.lng);
    const maxLng = Math.max(rider.lng, destination.lng);
    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.015);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.015);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }

  if (rider?.lat && rider?.lng) {
    return {
      latitude: rider.lat,
      longitude: rider.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  if (destination?.lat && destination?.lng) {
    return {
      latitude: destination.lat,
      longitude: destination.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  return useDefault ? DEFAULT_MAP_REGION : null;
}

export { DEFAULT_MAP_REGION };

export function getGoogleMapsUrl({ rider, destination }) {
  if (rider?.lat && destination?.lat) {
    return `https://www.google.com/maps/dir/?api=1&origin=${rider.lat},${rider.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  }
  if (rider?.lat) {
    return `https://www.google.com/maps?q=${rider.lat},${rider.lng}`;
  }
  if (destination?.lat) {
    return `https://www.google.com/maps?q=${destination.lat},${destination.lng}`;
  }
  return null;
}

export function formatEtaWindow(estimatedArrivalTime) {
  if (!estimatedArrivalTime) {
    return null;
  }
  const eta = new Date(estimatedArrivalTime);
  if (Number.isNaN(eta.getTime())) {
    return null;
  }
  return eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
