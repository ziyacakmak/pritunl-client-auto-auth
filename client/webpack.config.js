const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'electron-renderer',
  devtool: 'source-map',
  entry: {
    app: {
      import: './app/App.js',
    },
  },
  optimization: {
    minimize: false,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'static'),
    publicPath: './static/',
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({}),
      __APP_VERSION__: JSON.stringify(require('./package.json').version),
      __RELEASE_TAG__: JSON.stringify(process.env.RELEASE_TAG || ''),
    }),
  ],
};
