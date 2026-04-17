import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 4000000 // Increase to 4MB
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Ayomedia CRM',
          short_name: 'Ayomedia',
          description: 'CRM et Système de Gestion de Contenu pour Community Managers',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/196/196119.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/196/196119.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/196/196119.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
