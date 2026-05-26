import React, { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getMapRegion, DEFAULT_MAP_REGION } from '../../utils/maps';

const MAP_HEIGHT = 280;

const TrackingMapView = ({
  riderCoords,
  destinationCoords,
  interactive = true,
  preview = false,
  style,
  showDefaultRegion = false,
}) => {
  const mapRef = useRef(null);

  const region = useMemo(
    () => getMapRegion(riderCoords, destinationCoords, showDefaultRegion) || DEFAULT_MAP_REGION,
    [riderCoords, destinationCoords, showDefaultRegion]
  );

  const routeCoordinates = useMemo(() => {
    if (riderCoords && destinationCoords) {
      return [
        { latitude: riderCoords.lat, longitude: riderCoords.lng },
        { latitude: destinationCoords.lat, longitude: destinationCoords.lng },
      ];
    }
    return [];
  }, [riderCoords, destinationCoords]);

  useEffect(() => {
    if (!mapRef.current || !region) {
      return;
    }

    mapRef.current.animateToRegion(region, 450);
  }, [region]);

  const mapStyle = preview
    ? [styles.previewMap, style]
    : [styles.map, style];

  return (
    <View style={preview ? styles.previewWrap : styles.mapWrap}>
      <MapView
        ref={mapRef}
        style={mapStyle}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={preview ? region : undefined}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        liteMode={Platform.OS === 'android' && preview}
        showsUserLocation={false}
        showsMyLocationButton={false}
        loadingEnabled
        moveOnMarkerPress={false}
      >
        {riderCoords ? (
          <Marker
            coordinate={{ latitude: riderCoords.lat, longitude: riderCoords.lng }}
            title="Rider"
            description="Your rider is here"
            pinColor="green"
          />
        ) : null}

        {destinationCoords ? (
          <Marker
            coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
            title="Delivery"
            description="Your delivery address"
            pinColor="red"
          />
        ) : null}

        {routeCoordinates.length > 1 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2EC4B6"
            strokeWidth={4}
          />
        ) : null}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
  },
  previewWrap: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  previewMap: {
    width: '100%',
    height: MAP_HEIGHT,
  },
});

export default TrackingMapView;
