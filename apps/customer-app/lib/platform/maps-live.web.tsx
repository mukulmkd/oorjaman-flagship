import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, spacing } from "@oorjaman/config";
import { getGoogleMapsApiKey } from "../google-maps";

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const PROVIDER_GOOGLE = "google" as const;

export function isLiveMapsEnabled(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

type LatLngLiteral = { lat: number; lng: number };

type GoogleMapsNamespace = {
  Map: new (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => {
    fitBounds: (bounds: unknown, padding?: number | Record<string, number>) => void;
    setCenter: (c: LatLngLiteral) => void;
    setZoom: (z: number) => void;
  };
  Marker: new (opts: Record<string, unknown>) => {
    setMap: (map: unknown) => void;
    setPosition: (p: LatLngLiteral) => void;
  };
  Polyline: new (opts: Record<string, unknown>) => {
    setMap: (map: unknown) => void;
    setPath: (path: LatLngLiteral[]) => void;
  };
  LatLngBounds: new () => {
    extend: (p: LatLngLiteral) => void;
    isEmpty: () => boolean;
  };
};

declare global {
  interface Window {
    google?: { maps: GoogleMapsNamespace };
    __oorjamanMapsInit?: () => void;
  }
}

type MapHandle = {
  fitToCoordinates: (
    coordinates: Array<{ latitude: number; longitude: number }>,
    options?: { edgePadding?: { top: number; right: number; bottom: number; left: number } },
  ) => void;
};

type MapContextValue = {
  map: InstanceType<GoogleMapsNamespace["Map"]> | null;
  maps: GoogleMapsNamespace | null;
};

const MapContext = createContext<MapContextValue>({ map: null, maps: null });

const MAPS_SCRIPT_BASE = "https://maps.googleapis.com/maps/api/js";

let mapsLoaderPromise: Promise<GoogleMapsNamespace> | null = null;

function regionToZoom(region: Region): number {
  const delta = Math.max(region.latitudeDelta, region.longitudeDelta, 0.001);
  const zoom = Math.round(Math.log2(360 / delta));
  return Math.min(18, Math.max(4, zoom));
}

function loadGoogleMapsJs(apiKey: string): Promise<GoogleMapsNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser."));
  }
  if (window.google?.maps?.Map) {
    return Promise.resolve(window.google.maps);
  }
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const callbackName = "__oorjamanMapsInit";
    window[callbackName] = () => {
      if (window.google?.maps?.Map) {
        resolve(window.google.maps);
      } else {
        mapsLoaderPromise = null;
        reject(new Error("Google Maps JS failed to initialize."));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-oorjaman-maps="1"]`,
    );
    if (existing) {
      if (window.google?.maps?.Map) resolve(window.google.maps);
      return;
    }

    const script = document.createElement("script");
    script.dataset.oorjamanMaps = "1";
    script.async = true;
    script.defer = true;
    script.src = `${MAPS_SCRIPT_BASE}?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.onerror = () => {
      mapsLoaderPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API."));
    };
    document.head.appendChild(script);
  });

  return mapsLoaderPromise;
}

type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  provider?: unknown;
  initialRegion?: Region;
  children?: ReactNode;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  toolbarEnabled?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  onMapReady?: () => void;
};

export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  { style, initialRegion, children, onMapReady, scrollEnabled = true, zoomEnabled = true },
  ref,
) {
  const hostRef = useRef<View>(null);
  const mapRef = useRef<InstanceType<GoogleMapsNamespace["Map"]> | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiKey = getGoogleMapsApiKey();

  useImperativeHandle(
    ref,
    () => ({
      fitToCoordinates: (coordinates, options) => {
        const map = mapRef.current;
        const maps = mapsRef.current;
        if (!map || !maps || coordinates.length === 0) return;
        const bounds = new maps.LatLngBounds();
        for (const c of coordinates) {
          bounds.extend({ lat: c.latitude, lng: c.longitude });
        }
        if (bounds.isEmpty?.()) return;
        const pad = options?.edgePadding;
        map.fitBounds(
          bounds,
          pad
            ? { top: pad.top, right: pad.right, bottom: pad.bottom, left: pad.left }
            : 48,
        );
      },
    }),
    [],
  );

  useEffect(() => {
    if (!apiKey) {
      setError(
        "Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (Maps JavaScript API) and restrict HTTP referrers to app.oorjaman.com (+ Vercel previews).",
      );
      return;
    }

    let cancelled = false;
    let map: InstanceType<GoogleMapsNamespace["Map"]> | null = null;

    void (async () => {
      try {
        const maps = await loadGoogleMapsJs(apiKey);
        if (cancelled) return;
        mapsRef.current = maps;

        const node = hostRef.current as unknown as HTMLElement | null;
        if (!node) {
          setError("Map container is not available.");
          return;
        }

        // Ensure the RN Web host fills the parent before creating the map.
        node.style.width = "100%";
        node.style.height = "100%";
        node.style.minHeight = "160px";

        const region = initialRegion ?? {
          latitude: 20.5937,
          longitude: 78.9629,
          latitudeDelta: 12,
          longitudeDelta: 12,
        };

        map = new maps.Map(node, {
          center: { lat: region.latitude, lng: region.longitude },
          zoom: regionToZoom(region),
          disableDefaultUI: true,
          gestureHandling: scrollEnabled || zoomEnabled ? "auto" : "none",
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        setReady(true);
        onMapReady?.();
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load Google Maps.");
        }
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
    };
    // initialRegion is seed-only; fitToCoordinates handles live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const ctx = useMemo(
    () => ({ map: ready ? mapRef.current : null, maps: ready ? mapsRef.current : null }),
    [ready],
  );

  if (error) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackTitle}>Live map unavailable</Text>
        <Text style={styles.fallbackBody}>{error}</Text>
      </View>
    );
  }

  return (
    <MapContext.Provider value={ctx}>
      <View style={[styles.host, style]}>
        <View ref={hostRef} style={StyleSheet.absoluteFill} collapsable={false} />
        {ready ? children : null}
      </View>
    </MapContext.Provider>
  );
});

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  children?: ReactNode;
  anchor?: { x: number; y: number };
  tracksViewChanges?: boolean;
  title?: string;
};

export function Marker({ coordinate, title, children }: MarkerProps) {
  const { map, maps } = useContext(MapContext);
  const markerRef = useRef<InstanceType<GoogleMapsNamespace["Marker"]> | null>(null);

  const label = useMemo(() => {
    if (title) return title;
    let found: string | undefined;
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { label?: string };
      if (typeof props.label === "string") found = props.label;
    });
    return found;
  }, [children, title]);

  useEffect(() => {
    if (!map || !maps) return;
    const marker = new maps.Marker({
      map,
      position: { lat: coordinate.latitude, lng: coordinate.longitude },
      title: label,
      label: label
        ? {
            text: label.slice(0, 3),
            color: "#ffffff",
            fontWeight: "600",
            fontSize: "11px",
          }
        : undefined,
    });
    markerRef.current = marker;
    return () => {
      marker.setMap(null);
      markerRef.current = null;
    };
  }, [map, maps, label]);

  useEffect(() => {
    markerRef.current?.setPosition({
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    });
  }, [coordinate.latitude, coordinate.longitude]);

  return null;
}

type PolylineProps = {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
};

export function Polyline({
  coordinates,
  strokeColor = colors.primary,
  strokeWidth = 4,
}: PolylineProps) {
  const { map, maps } = useContext(MapContext);
  const lineRef = useRef<InstanceType<GoogleMapsNamespace["Polyline"]> | null>(null);

  useEffect(() => {
    if (!map || !maps) return;
    const path = coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude }));
    const line = new maps.Polyline({
      map,
      path,
      strokeColor,
      strokeOpacity: 0.9,
      strokeWeight: strokeWidth,
    });
    lineRef.current = line;
    return () => {
      line.setMap(null);
      lineRef.current = null;
    };
  }, [map, maps, strokeColor, strokeWidth]);

  useEffect(() => {
    lineRef.current?.setPath(
      coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude })),
    );
  }, [coordinates]);

  return null;
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 160,
    overflow: "hidden",
    backgroundColor: colors.muted,
  },
  fallback: {
    flex: 1,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.muted,
  },
  fallbackTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  fallbackBody: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
