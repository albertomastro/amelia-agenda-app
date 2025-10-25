import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      input: './src/main.jsx',
      output: {
        entryFileNames: 'calendar-app.js',
        assetFileNames: 'calendar-app.[ext]',
        manualChunks: undefined
      }
    },
    sourcemap: false
  }
});