import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  const apiTarget = env.STOREFRONT_API_TARGET || 'http://127.0.0.1:3000';
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy: {
        '/v1': { target: apiTarget, changeOrigin: false },
        '/health': { target: apiTarget, changeOrigin: false },
      },
    },
  };
});
