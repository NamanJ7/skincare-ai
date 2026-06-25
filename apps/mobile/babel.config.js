// babel-preset-expo automatically configures the react-native-worklets / Reanimated
// plugin when those packages are installed — no extra plugin entry needed.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
