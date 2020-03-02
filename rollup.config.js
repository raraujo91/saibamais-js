import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import globals from 'rollup-plugin-node-globals';
// import { uglify } from "rollup-plugin-uglify";

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    name: 'saibamaisjs',
    format: 'iife'
  },
  plugins: [ resolve(), commonjs(), globals() ]
};