const commonjs = require("@rollup/plugin-commonjs");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

module.exports = {
  input: "src/index.js",
  output: {
    exports: "auto",
    file: "dist/index.js",
    format: "cjs",
    sourcemap: true,
  },
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true })],
};
