import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Linking, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { SITE_URL } from "../api/config";
import { DEFAULT_VIEW, TILE_ATTRIBUTION, TILE_URL, mapPoints, pointsKey } from "../api/spotMap";
import { colors, radius, shadow } from "../theme";

// The same OpenStreetMap map as the website, drawn by Leaflet in a WebView:
// free, no Google account or key. The pins come in through injectJavaScript;
// a tap on one comes back as a message and opens the spot's card.
const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: #e8e4dc; }
  .wrap { background: none; border: none; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    width: 38px; height: 38px; box-sizing: border-box;
    border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    background: #fff; border: 3px solid ${colors.primary};
    box-shadow: 0 4px 10px rgba(40, 20, 15, 0.3);
  }
  .gift { border-color: #f0a020; background: #fff4e0; }
  .emoji { transform: rotate(45deg); font-size: 17px; line-height: 1; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function send(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  if (!window.L) {
    send({ type: "error" });
  } else {
    var map = L.map("map").setView([${DEFAULT_VIEW.lat}, ${DEFAULT_VIEW.lng}], ${DEFAULT_VIEW.zoom});
    L.tileLayer(${JSON.stringify(TILE_URL)}, { maxZoom: 19, attribution: ${JSON.stringify(TILE_ATTRIBUTION)} }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    window.setPoints = function (points) {
      layer.clearLayers();
      points.forEach(function (p) {
        var icon = L.divIcon({
          className: "wrap",
          html: '<span class="pin' + (p.gift ? " gift" : "") + '"><span class="emoji">' + p.emoji + "</span></span>",
          iconSize: [38, 46],
          iconAnchor: [19, 44]
        });
        L.marker([p.lat, p.lng], { icon: icon, zIndexOffset: p.gift ? 1000 : 0 })
          .on("click", function () { send({ type: "open", id: p.id }); })
          .addTo(layer);
      });
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
      else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points.map(function (p) { return [p.lat, p.lng]; })), { padding: [40, 40], maxZoom: 15 });
      }
    };
    send({ type: "ready" });
  }
</script>
</body>
</html>`;

// onTouch(true/false): the screen stops scrolling while a finger is on the
// map, so dragging moves the map instead of the page.
export default function SpotsMap({ spots, onOpen, onTouch, height = 440 }) {
  const { t } = useTranslation();
  const webview = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef({ spots, onOpen });
  latest.current = { spots, onOpen };
  const key = pointsKey(mapPoints(spots));

  // Only what a pin needs - the names (typed by members) never go in.
  useEffect(() => {
    if (!ready) return;
    const points = mapPoints(latest.current.spots).map(({ id, lat, lng, emoji, gift }) => ({ id, lat, lng, emoji, gift }));
    webview.current?.injectJavaScript(`window.setPoints(${JSON.stringify(points)}); true;`);
  }, [ready, key]);

  function onMessage(event) {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === "ready") setReady(true);
    else if (message.type === "error") setFailed(true);
    else if (message.type === "open") {
      const spot = latest.current.spots.find((s) => s.id === message.id);
      if (spot) latest.current.onOpen(spot);
    }
  }

  // The page itself loads here; a link (OpenStreetMap's credit) opens in the browser.
  function onNavigate(request) {
    const url = request.url || "";
    if (url === "about:blank" || url.startsWith("data:") || url.replace(/\/$/, "") === SITE_URL) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }

  return (
    <View
      style={[styles.box, { height }]}
      onTouchStart={() => onTouch?.(true)}
      onTouchEnd={() => onTouch?.(false)}
      onTouchCancel={() => onTouch?.(false)}
    >
      <WebView
        ref={webview}
        // The site's address as the page's origin: OpenStreetMap asks maps to
        // say where they're shown.
        source={{ html: HTML, baseUrl: SITE_URL }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onNavigate}
        setSupportMultipleWindows={false}
        nestedScrollEnabled
        onError={() => setFailed(true)}
        style={styles.webview}
      />
      {!ready || failed ? (
        <View style={styles.cover} pointerEvents="none">
          {failed ? (
            <Text style={styles.coverText}>{t("dateSpots.mapOffline")}</Text>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.coverText}>{t("dateSpots.mapLoading")}</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#e8e4dc",
    ...shadow.sm,
  },
  webview: { flex: 1, backgroundColor: "#e8e4dc" },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e8e4dc",
    padding: 20,
  },
  coverText: { color: colors.textSoft, fontSize: 14, textAlign: "center" },
});
