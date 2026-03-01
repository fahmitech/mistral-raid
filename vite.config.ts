import { defineConfig } from 'vite'

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
})
