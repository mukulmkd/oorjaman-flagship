import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeAuthStorage } from "@oorjaman/api";

/** Native: AsyncStorage-backed Supabase auth persistence. */
export const authStorage: NativeAuthStorage = AsyncStorage;
