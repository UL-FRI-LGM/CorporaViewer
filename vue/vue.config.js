const { defineConfig } = require('@vue/cli-service')
const path = require('path')

module.exports = defineConfig({
  transpileDependencies: true,
  chainWebpack: config => {
    config.resolve.alias.set('@', path.resolve(__dirname, 'src'))
    config.resolve.alias.set('assets', path.resolve(__dirname, 'src/assets'))
    config.resolve.alias.set('components', path.resolve(__dirname, 'src/components'))
    config.resolve.alias.set('bootstrap-vue$', 'bootstrap-vue/src/index.js')
  },
})
