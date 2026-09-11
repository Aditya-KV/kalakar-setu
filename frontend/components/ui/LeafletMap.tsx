import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  tappable?: boolean;
}

interface LeafletMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  onMarkerPress?: (id: string) => void;
}

// Fallback center (roughly the middle of India) so the map has somewhere
// sensible to sit before any marker/buyer location is known.
const DEFAULT_CENTER = { lat: 22.9734, lng: 78.6569 };

function buildHtml(center: { lat: number; lng: number }, zoom: number, markers: MapMarker[]): string {
  const markersJson = JSON.stringify(markers.map((m) => ({
    id: m.id, lat: m.lat, lng: m.lng, label: m.label || '', color: m.color || '#D97706', tappable: !!m.tappable,
  })));
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef0ee; }
  .pin-dot { width: 16px; height: 16px; border-radius: 8px; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${center.lat}, ${center.lng}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var markerLayers = {};

  function iconFor(color) {
    return L.divIcon({
      className: '',
      html: '<div class="pin-dot" style="background:' + color + '"></div>',
      iconSize: [16, 16],
    });
  }

  function clearMarkers() {
    for (var id in markerLayers) { map.removeLayer(markerLayers[id]); }
    markerLayers = {};
  }

  function updateMarkers(json) {
    var data = JSON.parse(json);
    clearMarkers();
    data.forEach(function (m) {
      var marker = L.marker([m.lat, m.lng], { icon: iconFor(m.color) });
      if (m.label) marker.bindTooltip(m.label, { direction: 'top', offset: [0, -6] });
      marker.addTo(map);
      markerLayers[m.id] = marker;
      if (m.tappable) {
        marker.on('click', function () {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
          }
        });
      }
    });
  }

  function setCenter(lat, lng, zoom) {
    map.setView([lat, lng], zoom || map.getZoom());
  }

  updateMarkers(${JSON.stringify(markersJson)});
</script>
</body>
</html>`;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({ markers, center, zoom = 13, style, onMarkerPress }) => {
  const webviewRef = useRef<WebView>(null);
  const initialCenter = center || (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : DEFAULT_CENTER);
  // Built once — later marker/center changes are pushed in via
  // injectJavaScript so the WebView doesn't reload (and flicker) on every
  // poll tick.
  const html = useMemo(() => buildHtml(initialCenter, zoom, markers), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const markersJson = JSON.stringify(markers.map((m) => ({
      id: m.id, lat: m.lat, lng: m.lng, label: m.label || '', color: m.color || '#D97706', tappable: !!m.tappable,
    })));
    webviewRef.current?.injectJavaScript(`window.updateMarkers(${JSON.stringify(markersJson)}); true;`);
  }, [markers]);

  useEffect(() => {
    if (!center) return;
    webviewRef.current?.injectJavaScript(`window.setCenter(${center.lat}, ${center.lng}); true;`);
  }, [center?.lat, center?.lng]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerPress' && data.id) onMarkerPress?.(data.id);
    } catch {
      // Ignore malformed messages from the page.
    }
  };

  return (
    <WebView
      ref={webviewRef}
      style={style}
      source={{ html }}
      originWhitelist={['*']}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
    />
  );
};
