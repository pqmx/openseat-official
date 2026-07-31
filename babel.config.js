/**
 * Reanimated 4 splits its worklet machinery into `react-native-worklets`, whose
 * Babel plugin has to compile both this app's worklets and the library's own
 * internal ones. Without it those internal unpackers ship with no `__initData`,
 * and the first `import 'react-native-reanimated'` dies reading `.code` off it.
 * The plugin has to come last.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
