import { defineConfig } from "tsup";

/** `npm run build` typechecks first, then bundles this. */
export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["cjs"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  // Dependencies stay external: this is a server, not a shipped library, so
  // bundling node_modules in would only slow the build down.
  skipNodeModulesBundle: true,
});
