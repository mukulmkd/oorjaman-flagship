import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { File } from "expo-file-system";
import type { SitePhotoCaptureGeo } from "@oorjaman/api";
import { colors } from "@oorjaman/config";
import { runAfterUiSettled, waitAfterUiSettled } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { pickSitePhotoWithGeo, type SitePhotoPickResult } from "../lib/site-photo-capture";
import type { SitePhotoSource } from "../lib/site-photo-source-prompt";
import {
  formatSitePhotoStampTime,
  reverseGeocodeSitePhoto,
  type SitePhotoGeocode,
} from "../lib/site-photo-geocode";
import { downloadStaticMapFallback } from "../lib/site-photo-static-map";
import { SitePhotoMapSnapshot } from "./site-photo-map-snapshot";

const STAMP_WIDTH = 720;
const MAP_BOX = 140;
const MIN_STAMP_BYTES = 5_000;
/** Android MapView snapshots often hang or stay blank — use HTTP tiles (Static API / OSM) instead. */
const preferHttpMapFallback = Platform.OS === "android";
/** Fail the stamp if geocode / map / capture does not finish (avoids infinite "Preparing your photo…"). */
const STAMP_JOB_TIMEOUT_MS = 45_000;
const PHOTO_ASSET_READY_MS = 8_000;
const MAP_ASSET_READY_MS = 4_000;
const CAPTURE_TIMEOUT_MS = 18_000;
const DEFAULT_STAMP_PHOTO_HEIGHT = 960;

function rejectStampJob(job: StampJob, message: string, reset: () => void) {
  job.reject(new Error(message));
  reset();
}

function clearStampState(
  setJob: (v: StampJob | null) => void,
  setMeta: (v: StampMeta | null) => void,
  setMapUri: (v: string | null) => void,
  setAssetsReady: (v: { photo: boolean; map: boolean }) => void,
) {
  setJob(null);
  setMeta(null);
  setMapUri(null);
  setAssetsReady({ photo: false, map: false });
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Image size timeout")), 8_000);
    Image.getSize(
      uri,
      (width, height) => {
        clearTimeout(timer);
        resolve({ width, height });
      },
      (err) => {
        clearTimeout(timer);
        reject(err ?? new Error("Could not read image size."));
      },
    );
  });
}

type StampInput = {
  photoUri: string;
  geo: SitePhotoCaptureGeo;
  siteLabel?: string;
  photoWidth?: number;
  photoHeight?: number;
};

type StampJob = StampInput & {
  resolve: (uri: string) => void;
  reject: (error: Error) => void;
};

type StampMeta = {
  geocode: SitePhotoGeocode;
  timestamp: string;
  siteLabel?: string;
  photoHeight: number;
};

type SitePhotoStampContextValue = {
  pickAndStampSitePhoto: (
    source: SitePhotoSource,
    siteLabel?: string,
  ) => Promise<SitePhotoPickResult | null>;
};

const SitePhotoStampContext = createContext<SitePhotoStampContextValue | null>(null);

function SitePhotoStampFrame({
  photoUri,
  meta,
  geo,
  onPhotoReady,
  onMapReady,
}: {
  photoUri: string;
  meta: StampMeta & { mapUri: string | null };
  geo: SitePhotoCaptureGeo;
  onPhotoReady: () => void;
  onMapReady: () => void;
}) {
  const [detailsHeight, setDetailsHeight] = useState(MAP_BOX);
  const mapHeight = Math.max(MAP_BOX, Math.ceil(detailsHeight));

  const onDetailsLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setDetailsHeight(h);
  }, []);

  return (
    <View style={styles.frame} collapsable={false}>
      <Image
        source={{ uri: photoUri }}
        style={{ width: STAMP_WIDTH, height: meta.photoHeight }}
        resizeMode="cover"
        onLoad={onPhotoReady}
        onError={onPhotoReady}
      />
      <View style={styles.footer} collapsable={false}>
        <View style={[styles.mapWrap, { height: mapHeight }]} collapsable={false}>
          {meta.mapUri ? (
            <Image
              source={{ uri: meta.mapUri }}
              style={[styles.mapImage, { height: mapHeight }]}
              resizeMode="cover"
              onLoad={onMapReady}
              onError={onMapReady}
            />
          ) : (
            <View style={[styles.mapPlaceholder, { height: mapHeight }]} />
          )}
        </View>
        <View style={styles.metaCol} collapsable={false} onLayout={onDetailsLayout}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>OorjaMan</Text>
            <Text style={styles.brandSub}>Site photo</Text>
          </View>
          {meta.siteLabel ? <Text style={styles.siteLabel}>{meta.siteLabel}</Text> : null}
          <Text style={styles.cityLine}>{meta.geocode.cityRegion}</Text>
          <Text style={styles.countryLine}>{meta.geocode.line1}</Text>
          <Text style={styles.addressLine} numberOfLines={3}>
            {meta.geocode.fullAddress}
          </Text>
          <Text style={styles.coords}>
            Lat {geo.lat.toFixed(6)}, Long {geo.lng.toFixed(6)}
          </Text>
          <Text style={styles.timeLine}>{meta.timestamp}</Text>
        </View>
      </View>
    </View>
  );
}

export function SitePhotoStampProvider({ children }: { children: ReactNode }) {
  const captureRefView = useRef<View>(null);
  const [job, setJob] = useState<StampJob | null>(null);
  const [meta, setMeta] = useState<StampMeta | null>(null);
  const [mapUri, setMapUri] = useState<string | null>(null);
  const [assetsReady, setAssetsReady] = useState({ photo: false, map: false });
  const capturingRef = useRef(false);

  const stampSitePhoto = useCallback((input: StampInput) => {
    return new Promise<string>((resolve, reject) => {
      capturingRef.current = false;
      setAssetsReady({ photo: false, map: false });
      setMeta(null);
      setMapUri(null);
      setJob({ ...input, resolve, reject });
    });
  }, []);

  const onMapSnapshotReady = useCallback((uri: string) => {
    setMapUri(uri);
    void Image.prefetch(uri);
  }, []);

  const onMapSnapshotFail = useCallback(() => {
    if (!job) {
      setAssetsReady((s) => ({ ...s, map: true }));
      return;
    }
    void (async () => {
      const fallback = await downloadStaticMapFallback(job.geo.lat, job.geo.lng, MAP_BOX);
      if (fallback) {
        setMapUri(fallback);
        void Image.prefetch(fallback);
      } else {
        setAssetsReady((s) => ({ ...s, map: true }));
      }
    })();
  }, [job]);

  const pickAndStampSitePhoto = useCallback(
    async (source: SitePhotoSource, siteLabel?: string): Promise<SitePhotoPickResult | null> => {
      const pick = await pickSitePhotoWithGeo(source);
      if (!pick) return null;

      // Android release: skip view-shot stamp (native module often missing). Overlays show map + details in-app.
      if (Platform.OS === "android") {
        return pick;
      }

      await waitAfterUiSettled(250);

      try {
        await Image.prefetch(pick.uri);
      } catch {
        // Non-fatal; stamping may still succeed.
      }

      const stampInput: StampInput = {
        photoUri: pick.uri,
        geo: pick.geo,
        siteLabel: siteLabel?.trim() || undefined,
        photoWidth: pick.width > 0 ? pick.width : undefined,
        photoHeight: pick.height > 0 ? pick.height : undefined,
      };

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const stampedUri = await stampSitePhoto(stampInput);
          return { ...pick, uri: stampedUri };
        } catch (e: unknown) {
          lastError = e instanceof Error ? e : new Error("Could not save stamped photo.");
          if (attempt === 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, 450));
          }
        }
      }

      const message = lastError?.message ?? "Could not add site details to the photo.";
      throw new Error(
        /blank|stamp|not ready/i.test(message)
          ? "Could not add the site map and details to this photo. Try again or pick a smaller image."
          : message,
      );
    },
    [stampSitePhoto],
  );

  const jobKey = job ? `${job.photoUri}:${job.geo.lat}:${job.geo.lng}` : null;

  useEffect(() => {
    if (!job || mapUri || !preferHttpMapFallback) return;
    let cancelled = false;
    const failTimer = setTimeout(() => {
      if (!cancelled) setAssetsReady((s) => ({ ...s, map: true }));
    }, MAP_ASSET_READY_MS + 4_000);
    void (async () => {
      const fallback = await downloadStaticMapFallback(job.geo.lat, job.geo.lng, MAP_BOX);
      if (!cancelled && fallback) {
        setMapUri(fallback);
      } else if (!cancelled) {
        setAssetsReady((s) => ({ ...s, map: true }));
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(failTimer);
    };
  }, [jobKey, mapUri]);

  useEffect(() => {
    if (!job?.photoUri || !meta) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setAssetsReady((s) => ({ ...s, photo: true }));
    }, PHOTO_ASSET_READY_MS);
    void Image.prefetch(job.photoUri)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAssetsReady((s) => ({ ...s, photo: true }));
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job?.photoUri, meta]);

  useEffect(() => {
    if (!mapUri) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setAssetsReady((s) => ({ ...s, map: true }));
    }, MAP_ASSET_READY_MS);
    void Image.prefetch(mapUri)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAssetsReady((s) => ({ ...s, map: true }));
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapUri]);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const reset = () => {
      if (!cancelled) clearStampState(setJob, setMeta, setMapUri, setAssetsReady);
      capturingRef.current = false;
    };
    const timer = setTimeout(() => {
      if (cancelled) return;
      rejectStampJob(
        job,
        "Preparing the photo took too long. Check mobile data or Wi‑Fi, then try again.",
        reset,
      );
    }, STAMP_JOB_TIMEOUT_MS);
    void (async () => {
      try {
        if (Platform.OS !== "web") {
          await Image.prefetch(job.photoUri);
        }
        const geocode = await reverseGeocodeSitePhoto(job.geo.lat, job.geo.lng);
        let photoHeight = DEFAULT_STAMP_PHOTO_HEIGHT;
        try {
          const size =
            job.photoWidth && job.photoHeight && job.photoWidth > 0 && job.photoHeight > 0
              ? { width: job.photoWidth, height: job.photoHeight }
              : await getImageSize(job.photoUri);
          photoHeight = Math.max(360, Math.round((size.height / size.width) * STAMP_WIDTH));
        } catch {
          // Proceed with a sensible default if the picker did not return dimensions.
        }
        if (cancelled) return;
        setMeta({
          geocode,
          timestamp: formatSitePhotoStampTime(),
          siteLabel: job.siteLabel,
          photoHeight,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          job.reject(e instanceof Error ? e : new Error("Could not prepare photo stamp."));
          setJob(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobKey]);

  useEffect(() => {
    if (!meta || !preferHttpMapFallback) return;
    const timer = setTimeout(() => {
      setAssetsReady((s) => ({ photo: true, map: true }));
    }, 2_500);
    return () => clearTimeout(timer);
  }, [meta]);

  const readyToCapture = Boolean(job && meta && assetsReady.photo && assetsReady.map);

  useEffect(() => {
    if (!readyToCapture || !job || capturingRef.current) return;
    capturingRef.current = true;
    let cancelled = false;
    const runCapture = () => {
      void (async () => {
        try {
          if (!captureRefView.current) throw new Error("Stamp view not ready.");
          const { captureRef } = require("react-native-view-shot") as typeof import("react-native-view-shot");
          const uri = await Promise.race([
            captureRef(captureRefView, {
              format: "jpg",
              quality: 0.9,
              result: "tmpfile",
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Capture timeout")), CAPTURE_TIMEOUT_MS),
            ),
          ]);
          const stamped = new File(uri);
          const size = stamped.size ?? 0;
          if (!stamped.exists || size < MIN_STAMP_BYTES) {
            throw new Error("Stamped photo was blank.");
          }
          if (!cancelled) job.resolve(uri);
        } catch (e: unknown) {
          if (!cancelled) {
            job.reject(e instanceof Error ? e : new Error("Could not save stamped photo."));
          }
        } finally {
          if (!cancelled) {
            setJob(null);
            setMeta(null);
            setMapUri(null);
            setAssetsReady({ photo: false, map: false });
          }
          capturingRef.current = false;
        }
      })();
    };
    let idleTask: ReturnType<typeof runAfterUiSettled> | undefined;
    const timer = setTimeout(() => {
      idleTask = runAfterUiSettled(runCapture);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      idleTask?.cancel();
    };
  }, [readyToCapture, job, meta, assetsReady]);

  return (
    <SitePhotoStampContext.Provider value={{ pickAndStampSitePhoto }}>
      {children}
      <Modal visible={Boolean(job)} transparent animationType="none" statusBarTranslucent>
        <View style={styles.modalRoot}>
          {job && meta ? (
            <>
              {!mapUri && !preferHttpMapFallback ? (
                <View style={styles.mapSnapshotLayer} pointerEvents="none">
                  <SitePhotoMapSnapshot
                    lat={job.geo.lat}
                    lng={job.geo.lng}
                    size={MAP_BOX}
                    onReady={onMapSnapshotReady}
                    onFail={onMapSnapshotFail}
                  />
                </View>
              ) : null}
              <View style={styles.captureLayer} pointerEvents="none" collapsable={false}>
                <View ref={captureRefView} collapsable={false}>
                  <SitePhotoStampFrame
                    photoUri={job.photoUri}
                    meta={{ ...meta, mapUri }}
                    geo={job.geo}
                    onPhotoReady={() => setAssetsReady((s) => ({ ...s, photo: true }))}
                    onMapReady={() => setAssetsReady((s) => ({ ...s, map: true }))}
                  />
                </View>
              </View>
            </>
          ) : null}
          <View style={styles.busyBackdrop} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primaryForeground} />
            <Text style={styles.busyText}>Preparing your photo…</Text>
          </View>
        </View>
      </Modal>
    </SitePhotoStampContext.Provider>
  );
}

export function useSitePhotoStamp(): SitePhotoStampContextValue {
  const ctx = useContext(SitePhotoStampContext);
  if (!ctx) {
    throw new Error("useSitePhotoStamp must be used within SitePhotoStampProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  mapSnapshotLayer: {
    position: "absolute",
    top: -400,
    left: 0,
    opacity: 0.02,
    zIndex: 0,
  },
  captureLayer: {
    position: "absolute",
    top: 0,
    left: -10_000,
    width: STAMP_WIDTH,
    zIndex: 1,
  },
  mapPlaceholder: {
    width: MAP_BOX,
    height: MAP_BOX,
    backgroundColor: "#3d5a80",
  },
  frame: {
    width: STAMP_WIDTH,
    backgroundColor: "#111",
  },
  footer: {
    width: STAMP_WIDTH,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,0,0,0.88)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  mapWrap: {
    width: MAP_BOX,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#333",
    flexShrink: 0,
  },
  mapImage: {
    width: MAP_BOX,
  },
  metaCol: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 2,
  },
  brand: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: "#fff",
  },
  brandSub: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  siteLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: "#7dcea0",
  },
  cityLine: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: "#fff",
  },
  countryLine: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
  addressLine: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 15,
    marginTop: 2,
  },
  coords: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  timeLine: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  busyBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 2,
  },
  busyText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.primaryForeground,
  },
});
