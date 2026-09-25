import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8232,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3232',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3232',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
