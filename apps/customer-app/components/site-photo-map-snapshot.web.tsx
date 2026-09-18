import { useEffect } from "react";

type Props = {
  lat: number;
  lng: number;
  size: number;
  onReady: (fileUri: string) => void;
  onFail: () => void;
};

/**
 * Web: MapView snapshots are native-only. Stamp pipeline falls back to HTTP static maps.
 * Do not import react-native-maps here — it crashes RN Web at module load.
 */
export function SitePhotoMapSnapshot({ onFail }: Props) {
  useEffect(() => {
    onFail();
  }, [onFail]);

  return null;
}
