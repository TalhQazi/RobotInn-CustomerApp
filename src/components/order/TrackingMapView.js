import React, { useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const MAP_HEIGHT = 280;

const TrackingMapView = ({
  riderCoords,
  destinationCoords,
  interactive = true,
  preview = false,
  style,
}) => {
  const webviewRef = useRef(null);

  const htmlContent = useMemo(() => {
    const initialLat = riderCoords?.lat || destinationCoords?.lat || 33.6844;
    const initialLng = riderCoords?.lng || destinationCoords?.lng || 73.0479;

    const riderMarkerStr = riderCoords 
      ? `var riderMarker = L.marker([${riderCoords.lat}, ${riderCoords.lng}], { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);`
      : 'var riderMarker = null;';
      
    const destMarkerStr = destinationCoords
      ? `var destMarker = L.marker([${destinationCoords.lat}, ${destinationCoords.lng}], { icon: destIcon }).addTo(map);`
      : 'var destMarker = null;';
      
    const routeStr = (riderCoords && destinationCoords)
      ? `window.updateRoute(${riderCoords.lat}, ${riderCoords.lng}, ${destinationCoords.lat}, ${destinationCoords.lng});`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #E2E8F0; }
          #map { width: 100vw; height: 100vh; }
          .leaflet-control-attribution { display: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            dragging: ${interactive},
            scrollWheelZoom: ${interactive},
            doubleClickZoom: ${interactive},
            touchZoom: ${interactive}
          }).setView([${initialLat}, ${initialLng}], 15);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
          }).addTo(map);

          var riderIcon = L.divIcon({
            html: '<div style="background-color: #2EC4B6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          
          var destIcon = L.divIcon({
            html: '<div style="background-color: #EF4444; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          var routeLine = null;

          window.updateRoute = function(rLat, rLng, dLat, dLng) {
            var url = 'https://router.project-osrm.org/route/v1/driving/' + rLng + ',' + rLat + ';' + dLng + ',' + dLat + '?overview=full&geometries=geojson';
            fetch(url)
              .then(function(res) { return res.json(); })
              .then(function(data) {
                if (data.routes && data.routes.length > 0) {
                  var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                  if (routeLine) {
                    routeLine.setLatLngs(coords);
                    routeLine.setStyle({ dashArray: null }); // Ensure solid line
                  } else {
                    routeLine = L.polyline(coords, {color: '#2EC4B6', weight: 4, opacity: 0.8}).addTo(map);
                  }
                  map.fitBounds(routeLine.getBounds(), { padding: [30, 30], animate: true });
                } else {
                  fallbackRoute(rLat, rLng, dLat, dLng);
                }
              })
              .catch(function(err) {
                  fallbackRoute(rLat, rLng, dLat, dLng);
              });
          };

          function fallbackRoute(rLat, rLng, dLat, dLng) {
            var fallbackCoords = [[rLat, rLng], [dLat, dLng]];
            if (routeLine) { 
              routeLine.setLatLngs(fallbackCoords); 
              routeLine.setStyle({ dashArray: '5, 10' });
            } else { 
              routeLine = L.polyline(fallbackCoords, {color: '#2EC4B6', weight: 4, opacity: 0.8, dashArray: '5, 10'}).addTo(map); 
            }
            map.fitBounds(routeLine.getBounds(), { padding: [30, 30], animate: true });
          }

          ${riderMarkerStr}
          ${destMarkerStr}
          ${routeStr}
          
          window.updateMap = function(rLat, rLng, dLat, dLng) {
            if (rLat && rLng) {
              if (riderMarker) {
                riderMarker.setLatLng([rLat, rLng]);
              } else {
                riderMarker = L.marker([rLat, rLng], { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);
              }
            }
            if (dLat && dLng) {
              if (destMarker) {
                destMarker.setLatLng([dLat, dLng]);
              } else {
                destMarker = L.marker([dLat, dLng], { icon: destIcon }).addTo(map);
              }
            }
            if (rLat && rLng && dLat && dLng) {
              window.updateRoute(rLat, rLng, dLat, dLng);
            } else if (rLat && rLng) {
              map.panTo([rLat, rLng]);
            }
          };
        </script>
      </body>
      </html>
    `;
  }, [interactive]); // Only re-create if interactive prop changes

  useEffect(() => {
    if (webviewRef.current && (riderCoords || destinationCoords)) {
      const rLat = riderCoords?.lat || 'null';
      const rLng = riderCoords?.lng || 'null';
      const dLat = destinationCoords?.lat || 'null';
      const dLng = destinationCoords?.lng || 'null';
      
      webviewRef.current.injectJavaScript(`
        if (window.updateMap) {
          window.updateMap(${rLat}, ${rLng}, ${dLat}, ${dLng});
        }
        true;
      `);
    }
  }, [riderCoords, destinationCoords]);

  const mapStyle = preview
    ? [styles.previewMap, style]
    : [styles.map, style];

  return (
    <View style={preview ? styles.previewWrap : styles.mapWrap}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://unpkg.com' }}
        style={mapStyle}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  previewWrap: {
    width: '100%',
    height: MAP_HEIGHT,
    overflow: 'hidden',
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
