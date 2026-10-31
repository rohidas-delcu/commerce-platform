import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/v1': { target: process.env.STOREFRONT_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: false },
      '/health': { target: process.env.STOREFRONT_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: false }
    }
  }
});
