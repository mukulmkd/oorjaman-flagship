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

/** Never bundle the sibling customer app into technician Metro graphs. */
const customerAppRoot = path.join(monorepoRoot, "apps", "customer-app");
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  new RegExp(`${customerAppRoot.replace(/[/\\]/g, "[/\\\\]")}.*`),
];

module.exports = config;
