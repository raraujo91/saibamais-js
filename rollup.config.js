import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import globals from 'rollup-plugin-node-globals';
import { terser } from "rollup-plugin-terser";

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    name: 'SaibaMais',
    format: 'iife'
  },
  plugins: [ resolve(), commonjs(), globals(), terser() ]
};