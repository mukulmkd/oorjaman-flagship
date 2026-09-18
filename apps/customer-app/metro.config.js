const path = require("path");
const { createMobileMetroConfig } = require("@oorjaman/mobile-config/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = createMobileMetroConfig(__dirname);

/**
 * pdf-lib's ESM build breaks Expo web (`Cannot destructure '__extends' of n.default`).
 * Force CJS pdf-lib + a concrete tslib file so helpers resolve without a fake default export.
 */
const prevResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "tslib") {
    return {
      type: "sourceFile",
      filePath: require.resolve("tslib/tslib.es6.js"),
    };
  }
  if (moduleName === "pdf-lib") {
    return {
      type: "sourceFile",
      filePath: require.resolve("pdf-lib/cjs/index.js"),
    };
  }
  if (typeof prevResolveRequest === "function") {
    return prevResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Keep resolver rooted at the app so require.resolve above hits the workspace install.
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

module.exports = config;
