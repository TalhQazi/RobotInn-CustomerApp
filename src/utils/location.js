import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import GeolocationService from 'react-native-geolocation-service';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_GEOCODE_URL } from './constants';

const useNativeGeolocationService = Platform.OS === 'android' || Platform.OS === 'ios';

if (Platform.OS === 'ios' && Geolocation.setRNConfiguration) {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
  });
}

function getPositionOnce(options) {
  return new Promise((resolve, reject) => {
    try {
      // Try standard Geolocation first (more stable on Android)
      if (useNativeGeolocationService) {
        try {
          const positionCallback = (position) => {
            try {
              resolve(position);
            } catch (error) {
              console.error('Position callback error:', error);
              reject(error);
            }
          };

          const errorCallback = (error) => {
            console.error('Standard Geolocation error:', error?.code, error?.message);
            reject(error);
          };

          const requestOptions = {
            timeout: options.timeout || 20000,
            maximumAge: options.maximumAge || 0,
            enableHighAccuracy: options.enableHighAccuracy || false,
          };

          // Use GeolocationService (FusedLocationProvider) on both platforms for much better accuracy
          GeolocationService.getCurrentPosition(positionCallback, errorCallback, requestOptions);
        } catch (nativeError) {
          console.error('Native geolocation error:', nativeError);
          reject(nativeError);
        }
        return;
      }
      Geolocation.getCurrentPosition(resolve, reject, options);
    } catch (error) {
      console.error('getPositionOnce error:', error);
      reject(error);
    }
  });
}

function watchForPosition(options, watchTimeoutMs) {
  return new Promise((resolve, reject) => {
    let watchId = null;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (watchId != null) {
        if (useNativeGeolocationService) {
          GeolocationService.clearWatch(watchId);
        } else {
          Geolocation.clearWatch(watchId);
        }
      }
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, { code: 3, message: 'Location request timed out. Turn on GPS and try again.' });
    }, watchTimeoutMs);

    const watchOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? false,
      distanceFilter: 0,
      interval: 1000,
      fastestInterval: 500,
      maximumAge: options.maximumAge ?? 10000,
      timeout: watchTimeoutMs,
    };

    if (useNativeGeolocationService) {
      watchId = GeolocationService.watchPosition(
        (position) => finish(resolve, position),
        (error) => finish(reject, error),
        watchOptions
      );
    } else {
      watchId = Geolocation.watchPosition(
        (position) => finish(resolve, position),
        (error) => finish(reject, error),
        watchOptions
      );
    }
  });
}

export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

    const hasFine = await PermissionsAndroid.check(fine);
    const hasCoarse = await PermissionsAndroid.check(coarse);
    if (hasFine || hasCoarse) {
      return true;
    }

    const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
    return (
      result[fine] === PermissionsAndroid.RESULTS.GRANTED ||
      result[coarse] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  if (Platform.OS === 'ios') {
    const status = await GeolocationService.requestAuthorization('whenInUse');
    return status === 'granted' || status === 'authorized' || status === 'whenInUse';
  }

  return true;
}

export async function reverseGeocodeCoordinates(lat, lng) {
  try {
    console.log('🔍 Reverse geocoding for:', lat, lng);

    // Try backup (free) service first
    const backupResult = await reverseGeocodeWithBackup(lat, lng);
    if (backupResult) {
      console.log('✅ Using free geocoding service');
      return backupResult;
    }

    // If backup fails, try Google Maps
    console.log('📍 Trying Google Maps Geocoding...');
    const url = `${GOOGLE_MAPS_GEOCODE_URL}?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    console.log('📍 Geocoding API URL:', url.split('key=')[0] + 'key=***');

    const response = await fetch(url);
    console.log('📡 API Response status:', response.status);

    if (!response.ok) {
      console.error('API response not OK:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    console.log('✅ Geocoding response:', JSON.stringify(json, null, 2));

    if (json.status === 'OK' && json.results?.length > 0) {
      const address = json.results[0].formatted_address;
      console.log('🏠 Found address:', address);
      return address;
    }

    if (json.status === 'ZERO_RESULTS') {
      console.warn('⚠️ No results found for coordinates');
    } else if (json.status === 'REQUEST_DENIED') {
      console.error('❌ Geocoding API denied - Enable it in Google Cloud Console');
    } else if (json.status === 'INVALID_REQUEST') {
      console.error('❌ Invalid request:', json.error_message);
    } else if (json.status === 'OVER_QUERY_LIMIT') {
      console.error('❌ API quota exceeded');
    }
  } catch (error) {
    console.error('❌ Reverse geocode error:', error);
  }

  const fallback = `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  console.log('📌 Using fallback format:', fallback);
  return fallback;
}

async function reverseGeocodeWithBackup(lat, lng) {
  try {
    console.log('🔄 Using OpenStreetMap (free) geocoding service...');
    // Using Open Street Map's Nominatim service (free, no API key needed)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'RobotInnApp/1.0'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ Backup geocoding failed:', response.status);
      return null;
    }

    const json = await response.json();
    console.log('✅ Backup geocoding response:', JSON.stringify(json, null, 2));

    if (json.address) {
      // Build a readable address from the components
      const parts = [];

      // Priority order for address components
      if (json.address.house_number) parts.push(json.address.house_number);
      if (json.address.road) parts.push(json.address.road);
      if (json.address.neighbourhood) parts.push(json.address.neighbourhood);
      if (json.address.suburb) parts.push(json.address.suburb);
      if (json.address.city_district) parts.push(json.address.city_district);
      if (json.address.city) parts.push(json.address.city);
      if (json.address.postcode) parts.push(json.address.postcode);
      if (json.address.country) parts.push(json.address.country);

      const address = parts.filter(Boolean).join(', ') || json.display_name;
      console.log('🏠 Address found:', address);
      return address;
    }

    if (json.display_name) {
      console.log('🏠 Display name found:', json.display_name);
      return json.display_name;
    }

    return null;
  } catch (error) {
    console.error('❌ Backup geocoding error:', error);
    return null;
  }
}

export async function getCurrentCoordinates() {
  const attempts = [
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 },
  ];

  let lastError = null;

  for (const options of attempts) {
    try {
      const promise = getPositionOnce(options);

      // Add timeout wrapper to catch hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject({ code: 3, message: 'Location request timed out' }), options.timeout + 2000);
      });

      const position = await Promise.race([promise, timeoutPromise]);

      if (position && position.coords && position.coords.latitude !== undefined) {
        return position;
      }
      lastError = { code: 2, message: 'Invalid position data received' };
    } catch (error) {
      lastError = error;
      console.log('getCurrentPosition attempt failed:', error?.code, error?.message);
    }
  }

  try {
    return await watchForPosition(
      { enableHighAccuracy: true, maximumAge: 10000 },
      30000
    );
  } catch (watchError) {
    throw lastError || watchError;
  }
}

function locationErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return 'Location permission was denied. Enable it in app settings.';
    case 2:
      return 'Location is unavailable. Turn on device location (GPS) and try again.';
    case 3:
      return 'Could not get your location in time. Enable GPS, move outdoors if possible, then try again.';
    default:
      return error?.message || 'Unable to detect current location.';
  }
}

export function showLocationErrorAlert(error) {
  const message = locationErrorMessage(error);
  const buttons = [{ text: 'OK', style: 'cancel' }];

  if (error?.code === 1 || error?.code === 2 || error?.code === 3) {
    buttons.unshift({
      text: 'Open Settings',
      onPress: () => Linking.openSettings().catch(() => {}),
    });
  }

  Alert.alert('Location error', message, buttons);
}

export async function getCurrentLocationWithAddress() {
  try {
    let hasPermission = false;
    try {
      hasPermission = await requestLocationPermission();
    } catch (permError) {
      console.error('Permission error:', permError);
      const err = { code: 1, message: 'Failed to request location permission' };
      showLocationErrorAlert(err);
      throw err;
    }

    if (!hasPermission) {
      const err = { code: 1, message: 'Location permission denied' };
      showLocationErrorAlert(err);
      throw err;
    }
  } catch (error) {
    console.error('Permission request failed:', error);
    throw error;
  }

  let position;
  try {
    position = await getCurrentCoordinates();
  } catch (error) {
    console.error('Get coordinates error:', error);
    showLocationErrorAlert(error);
    throw error;
  }

  if (!position || !position.coords || position.coords.latitude === undefined) {
    const err = { code: 2, message: 'Could not retrieve valid location data' };
    console.error('Invalid position data:', position);
    showLocationErrorAlert(err);
    throw err;
  }

  let latitude, longitude;
  try {
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;

    if (!latitude || !longitude || typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Invalid coordinates format');
    }
  } catch (parseError) {
    console.error('Coordinate parsing error:', parseError);
    const err = { code: 2, message: 'Invalid location coordinates' };
    showLocationErrorAlert(err);
    throw err;
  }

  let formattedAddress;
  try {
    formattedAddress = await reverseGeocodeCoordinates(latitude, longitude);
  } catch (geocodeError) {
    console.error('Geocoding error:', geocodeError);
    formattedAddress = `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
  }

  return {
    lat: latitude,
    lng: longitude,
    address: formattedAddress,
  };
}
