const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// Ensure Metro treats uppercase image extensions as assets (e.g. .PNG)
const config = {
    resetCache: true,
    resolver: {
        assetExts: [
            ...defaultConfig.resolver.assetExts,
            'PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'HEIC', 'HEIF',
        ],
    },
};

module.exports = mergeConfig(defaultConfig, config);
