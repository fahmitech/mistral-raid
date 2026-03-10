import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  server: {
    port: 5173
  },
  optimizeDeps: {
    include: ['@ricky0123/vad-web'],
    exclude: ['onnxruntime-web'],
  },
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: '../node_modules/onnxruntime-web/dist/*.{mjs,wasm}',
          dest: 'assets',
        },
      ],
    }),
  ],
})
