import { useCallback, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

type Props = {
  lat: number;
  lng: number;
  size: number;
  onReady: (fileUri: string) => void;
  onFail: () => void;
};

/** Renders a small map and exports a local image file via takeSnapshot (works when HTTP static maps do not). */
export function SitePhotoMapSnapshot({ lat, lng, size, onReady, onFail }: Props) {
  const mapRef = useRef<MapView>(null);
  const doneRef = useRef(false);

  const region = useMemo(
    () => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }),
    [lat, lng],
  );

  const capture = useCallback(() => {
    if (doneRef.current) return;
    const map = mapRef.current;
    if (!map) {
      onFail();
      return;
    }
    doneRef.current = true;
    void (async () => {
      try {
        await new Promise((r) => setTimeout(r, Platform.OS === "android" ? 700 : 450));
        const raw = await map.takeSnapshot({
          width: size,
          height: size,
          format: "jpg",
          quality: 0.92,
          result: "file",
        });
        const uri = raw.startsWith("file://") ? raw : `file://${raw}`;
        onReady(uri);
      } catch {
        onFail();
      }
    })();
  }, [size, onReady, onFail]);

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }]} collapsable={false}>
      <MapView
        ref={mapRef}
        style={{ width: size, height: size }}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        initialRegion={region}
        onMapReady={capture}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        loadingEnabled
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#2d3436",
    borderRadius: 8,
  },
});
