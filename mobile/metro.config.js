// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The wire protocol lives in ../packages/contracts and is shared with the backend.
// Resolve it straight from TypeScript source so the app never needs a separate build step.
const contractsDir = path.resolve(__dirname, '../packages/contracts');
config.watchFolders = [...(config.watchFolders ?? []), contractsDir];

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@pulse/contracts') {
    return { type: 'sourceFile', filePath: path.join(contractsDir, 'src/index.ts') };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
