module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Reanimated 4 moved its worklet transform out into react-native-worklets,
      // so this is the plugin to use, not react-native-reanimated/plugin. It
      // has to stay last in the list.
      "react-native-worklets/plugin",
    ],
  };
};
