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
    if (useNativeGeolocationService) {
      GeolocationService.getCurrentPosition(resolve, reject, {
        ...options,
        forceRequestLocation: true,
        showLocationDialog: true,
      });
      return;
    }
    Geolocation.getCurrentPosition(resolve, reject, options);
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
      forceRequestLocation: true,
      showLocationDialog: true,
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
    const url = `${GOOGLE_MAPS_GEOCODE_URL}?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const json = await response.json();
    if (json.status === 'OK' && json.results?.length > 0) {
      return json.results[0].formatted_address;
    }
    if (json.status === 'REQUEST_DENIED') {
      console.warn('Geocoding API denied:', json.error_message);
    }
  } catch (error) {
    console.error('Reverse geocode error:', error);
  }
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

export async function getCurrentCoordinates() {
  const attempts = [
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 },
    { enableHighAccuracy: false, timeout: 40000, maximumAge: 0 },
    { enableHighAccuracy: true, timeout: 45000, maximumAge: 0 },
  ];

  let lastError = null;
  for (const options of attempts) {
    try {
      return await getPositionOnce(options);
    } catch (error) {
      lastError = error;
      console.log('getCurrentPosition attempt failed:', error?.code, error?.message);
    }
  }

  try {
    return await watchForPosition(
      { enableHighAccuracy: false, maximumAge: 120000 },
      40000
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

/**
 * Returns { lat, lng, address } after permission + GPS + reverse geocode.
 */
export async function getCurrentLocationWithAddress() {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    const err = { code: 1, message: 'Permission denied' };
    showLocationErrorAlert(err);
    throw err;
  }

  let position;
  try {
    position = await getCurrentCoordinates();
  } catch (error) {
    showLocationErrorAlert(error);
    throw error;
  }

  const { latitude, longitude } = position.coords;
  const formattedAddress = await reverseGeocodeCoordinates(latitude, longitude);

  return {
    lat: latitude,
    lng: longitude,
    address: formattedAddress,
  };
}
