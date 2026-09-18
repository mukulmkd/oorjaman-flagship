const withIosPodfileFixes = require("./plugins/withIosPodfileFixes");
const withNativeDisplayName = require("./plugins/withNativeDisplayName");
const withAndroidWhiteAdaptiveIcon = require("./plugins/withAndroidWhiteAdaptiveIcon");
const withAndroidNotificationBranding = require("./plugins/withAndroidNotificationBranding");
const withAndroidPhoneOnlyScreens = require("./plugins/withAndroidPhoneOnlyScreens");

module.exports = {
  withIosPodfileFixes,
  withNativeDisplayName,
  withAndroidWhiteAdaptiveIcon,
  withAndroidNotificationBranding,
  withAndroidPhoneOnlyScreens,
};
