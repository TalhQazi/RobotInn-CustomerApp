import React, { useMemo, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { buildStaticMapUrl, getGoogleMapsUrl } from '../../utils/maps';
import TrackingMapView from './TrackingMapView';

const MAP_HEIGHT = 280;

const LiveTrackingMap = ({
  riderCoords,
  destinationCoords,
  distanceText,
  loading,
  isTracking,
  trackingActive,
}) => {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [staticMapFailed, setStaticMapFailed] = useState(false);

  const hasCoords = !!(riderCoords || destinationCoords);
  const showDefaultMap = isTracking && !hasCoords;
  const canShowMap = true;
  const canOpenMap = hasCoords;

  const mapUrl = useMemo(() => {
    if (!hasCoords) {
      return null;
    }

    const cacheKey = [
      riderCoords?.lat?.toFixed(5) || 'nr',
      riderCoords?.lng?.toFixed(5) || 'nr',
      destinationCoords?.lat?.toFixed(5) || 'nd',
      destinationCoords?.lng?.toFixed(5) || 'nd',
    ].join('_');

    return buildStaticMapUrl({
      rider: riderCoords,
      destination: destinationCoords,
      cacheKey,
    });
  }, [hasCoords, riderCoords, destinationCoords]);

  const useStaticPreview = !!mapUrl && !staticMapFailed;

  const emptyMessage = useMemo(() => {
    if (isTracking && !riderCoords) {
      return 'Waiting for rider GPS signal...';
    }
    if (isTracking) {
      return 'Loading live map...';
    }
    return 'Map will appear when your rider is on the way';
  }, [isTracking, riderCoords]);

  const handleOpenMap = () => {
    if (!canOpenMap) {
      return;
    }
    setMapExpanded(true);
  };

  const handleOpenExternalMaps = async () => {
    const url = getGoogleMapsUrl({ rider: riderCoords, destination: destinationCoords });
    if (!url) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unavailable', 'Could not open maps on this device');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not open maps');
    }
  };

  const renderMapPreview = () => {
    if (loading && !canShowMap) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2EC4B6" />
          <Text style={styles.loadingText}>Loading live map...</Text>
        </View>
      );
    }

    if (canShowMap) {
      return (
        <>
          {useStaticPreview ? (
            <Image
              source={{ uri: mapUrl }}
              style={styles.mapImage}
              resizeMode="cover"
              onError={() => setStaticMapFailed(true)}
            />
          ) : (
            <TrackingMapView
              riderCoords={riderCoords}
              destinationCoords={destinationCoords}
              interactive={false}
              preview
              showDefaultRegion={showDefaultMap}
            />
          )}
          {canOpenMap && (
            <View style={styles.openMapHint}>
              <Ionicons name="expand-outline" size={16} color="#fff" />
              <Text style={styles.openMapHintText}>Tap to open live map</Text>
            </View>
          )}
        </>
      );
    }

    return (
      <View style={styles.center}>
        <Ionicons name="map-outline" size={42} color="#94A3B8" />
        <Text style={styles.loadingText}>{emptyMessage}</Text>
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        {canOpenMap ? (
          <TouchableOpacity
            style={styles.mapPressable}
            activeOpacity={0.92}
            onPress={handleOpenMap}
          >
            {renderMapPreview()}
          </TouchableOpacity>
        ) : (
          renderMapPreview()
        )}

        <View style={styles.overlayHeader} pointerEvents="none">
          <View style={styles.titleRow}>
            <Ionicons name="location-sharp" size={20} color="#fff" />
            <Text style={styles.title}>Track your rider</Text>
          </View>
          {trackingActive && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {distanceText ? (
          <View style={styles.distanceBadge} pointerEvents="none">
            <View style={styles.pulsingDot} />
            <Text style={styles.distanceText}>{distanceText}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={mapExpanded}
        animationType="slide"
        onRequestClose={() => setMapExpanded(false)}
      >
        <SafeAreaView style={styles.fullscreenContainer}>
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity
              style={styles.fullscreenCloseButton}
              onPress={() => setMapExpanded(false)}
            >
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <View style={styles.fullscreenTitleWrap}>
              <Text style={styles.fullscreenTitle}>Live tracking</Text>
              {trackingActive ? (
                <View style={styles.fullscreenLivePill}>
                  <View style={styles.fullscreenLiveDot} />
                  <Text style={styles.fullscreenLiveText}>LIVE</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.fullscreenExternalButton}
              onPress={handleOpenExternalMaps}
            >
              <Ionicons name="navigate-outline" size={22} color="#2EC4B6" />
            </TouchableOpacity>
          </View>

          <TrackingMapView
            riderCoords={riderCoords}
            destinationCoords={destinationCoords}
            interactive
            showDefaultRegion={showDefaultMap}
            style={styles.fullscreenMap}
          />

          <View style={styles.fullscreenLegend}>
            {riderCoords ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2EC4B6' }]} />
                <Text style={styles.legendText}>Rider</Text>
              </View>
            ) : null}
            {destinationCoords ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Delivery</Text>
              </View>
            ) : null}
          </View>

          {distanceText ? (
            <View style={styles.fullscreenDistanceBar}>
              <Ionicons name="bicycle-outline" size={18} color="#2EC4B6" />
              <Text style={styles.fullscreenDistanceText}>{distanceText}</Text>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    height: MAP_HEIGHT,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  mapPressable: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  mapImage: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  center: {
    height: MAP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
  },
  openMapHint: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  openMapHintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  overlayHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2EC4B6',
  },
  distanceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  fullscreenCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenExternalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8FAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenTitleWrap: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  fullscreenLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  fullscreenLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  fullscreenLiveText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  fullscreenMap: {
    flex: 1,
  },
  fullscreenLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  fullscreenDistanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fullscreenDistanceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
});

export default LiveTrackingMap;
