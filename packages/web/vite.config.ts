import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    // Monaco 编辑器插件
    (monacoEditorPlugin as unknown as { default: typeof monacoEditorPlugin }).default({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'css', 'html'],
      customWorkers: [],
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/invoke': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/_/lsp': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  // Monaco Editor 本地打包配置
  optimizeDeps: {
    include: [
      'monaco-editor',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
  // Worker 文件处理
  worker: {
    format: 'es',
  },
})
