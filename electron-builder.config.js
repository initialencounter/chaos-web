/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  directories: {
    // eslint-disable-next-line no-template-curly-in-string
    output: 'release/v${version}',
  },
  publish: null,
  npmRebuild: false,
  files: [
    'dist/main/**/*',
    'dist/preload/**/*',
    'dist/render/**/*',
  ],
  win: {
    icon: 'logo.png',
  },
  mac: {
    icon: 'logo.png',
  },
  linux: {
    icon: 'logo.png',
  },
}

module.exports = config
