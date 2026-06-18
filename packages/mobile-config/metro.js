const { getDefaultConfig } = require("expo/metro-config");

/**
 * Monorepo Metro config for OorjaMan mobile apps.
 * SDK 52+ configures watchFolders/nodeModulesPaths automatically — do not override.
 */
function createMobileMetroConfig(projectRoot) {
  /** @type {import('expo/metro-config').MetroConfig} */
  const config = getDefaultConfig(projectRoot);

  config.resolver.blockList = [
    ...(config.resolver.blockList ?? []),
    /\.env\.uat\.local$/,
  ];

  return config;
}

module.exports = { createMobileMetroConfig };
