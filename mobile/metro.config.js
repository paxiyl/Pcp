const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

// uniwind compiles the Tailwind entry sheet and regenerates the ambient
// className types. Both paths are the ones already in the source: the root
// layout imports ../global.css, and src/uniwind-types.d.ts is its generated
// declaration file.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
