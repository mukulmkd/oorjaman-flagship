const { withInfoPlist, withXcodeProject } = require("@expo/config-plugins");
const { findFirstNativeTarget } = require("@expo/config-plugins/build/ios/Target");
const {
  getBuildConfigurationsForListId,
} = require("@expo/config-plugins/build/ios/utils/Xcodeproj");

function ensureQuotes(value) {
  if (!value.match(/^['"]/)) {
    return `"${value}"`;
  }
  return value;
}

/**
 * Home-screen label + build-time Info.plist keys for “OorjaMan Partner”.
 * Quotes are required in pbxproj when the name contains spaces.
 */
function withPartnerNativeBranding(config) {
  const displayName = config.name ?? "OorjaMan Partner";
  const quoted = ensureQuotes(displayName);

  config = withInfoPlist(config, (mod) => {
    mod.modResults.CFBundleDisplayName = displayName;
    mod.modResults.CFBundleName = displayName;
    return mod;
  });

  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const [, nativeTarget] = findFirstNativeTarget(project);

    getBuildConfigurationsForListId(
      project,
      nativeTarget.buildConfigurationList,
    ).forEach(([, item]) => {
      const bundleId = item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER;
      if (
        typeof bundleId === "string" &&
        bundleId.includes("oorjaman.technician")
      ) {
        item.buildSettings.INFOPLIST_KEY_CFBundleDisplayName = quoted;
        item.buildSettings.INFOPLIST_KEY_CFBundleName = quoted;
      }
    });

    return mod;
  });

  return config;
}

module.exports = withPartnerNativeBranding;
