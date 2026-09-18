/**
 * Native live maps — re-exports react-native-maps unchanged.
 */
export {
  default as MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
export type { Region } from "react-native-maps";

export function isLiveMapsEnabled(): boolean {
  return true;
}
