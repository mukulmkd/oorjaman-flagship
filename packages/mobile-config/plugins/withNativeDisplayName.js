const { IOSConfig } = require("expo/config-plugins");

/** Home-screen label from app.config `name` (incl. UAT suffix). */
function withNativeDisplayName(config) {
  return IOSConfig.Name.withName(IOSConfig.Name.withDisplayName(config));
}

module.exports = withNativeDisplayName;
