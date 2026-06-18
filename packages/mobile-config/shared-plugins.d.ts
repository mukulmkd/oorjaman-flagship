import type { ExpoConfig } from "expo/config";

type PluginTuple = NonNullable<ExpoConfig["plugins"]>[number];

export declare const expoBuildPropertiesFromSource: PluginTuple;
export declare const splashScreenPlugin: PluginTuple;
export declare const notificationsPlugin: PluginTuple;
