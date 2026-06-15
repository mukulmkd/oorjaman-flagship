const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

const watchFolders = new Set([
  ...(config.watchFolders ?? []),
  monorepoRoot,
]);
config.watchFolders = [...watchFolders];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

const technicianAppRoot = path.join(monorepoRoot, "apps", "technician-app");
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  new RegExp(`${technicianAppRoot.replace(/[/\\]/g, "[/\\\\]")}.*`),
  // Legacy UAT env at app root breaks Metro (require.context loads ./.env* as JS).
  /\.env\.uat\.local$/,
];

module.exports = config;
