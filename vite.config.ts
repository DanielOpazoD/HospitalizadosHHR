import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      // PWA plugin configuration
      VitePWA({
        strategies: 'injectManifest',
        srcDir: '.',
        filename: 'service-worker.ts',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
          name: 'Hanga Roa Hospital Tracker',
          short_name: 'HHR',
          description: 'Sistema de gestión de censo hospitalario del Hospital Hanga Roa',
          theme_color: '#0284c7',
          background_color: '#f8fafc',
          display: 'standalone',
          icons: [
            {
              src: 'images/logos/logo_HHR.png', // Using existing logo as base
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'images/logos/logo_HHR.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: true, // Enable in dev to test PWA install
          type: 'module'
        }
      }),
      // Gzip compression for production builds
      isProduction && viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240, // Only compress files > 10KB
        deleteOriginFile: false,
      }),
      // Brotli compression (better ratio than gzip)
      isProduction && viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false,
      }),
    ].filter(Boolean),
    define: {
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
      'import.meta.env.VITE_E2E_MODE': JSON.stringify(process.env.VITE_E2E_MODE || 'false'),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Keep React together with UI libs that depend on it
            'vendor-react': ['react', 'react-dom', 'lucide-react'],
            // Firebase separate
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            // Charts separate (lazy loaded)
            'vendor-charts': ['recharts'],
            // Excel/Reports (lazy loaded)
            'vendor-excel': ['exceljs', 'file-saver'],
          },
        },
      },
      chunkSizeWarningLimit: 600, // Stricter warning at 600KB
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.debug'] : [],
        },
        mangle: {
          safari10: true,
        },
      },
      // Target modern browsers for smaller output
      target: 'es2020',
      // Enable source maps only in development
      sourcemap: !isProduction,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Optimize dependencies - pre-bundle CommonJS packages for ESM compatibility
    optimizeDeps: {
      include: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore', 'exceljs'],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.ts',
    }
  };
});

