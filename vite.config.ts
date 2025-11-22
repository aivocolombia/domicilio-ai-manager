import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/", // ✅ importante para despliegue correcto
  server: {
    host: true, // ✅ permite exponer el servidor, útil para Vercel o Render
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // Optimización de chunks para mejor carga inicial
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separar dependencias grandes
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-switch',
            '@radix-ui/react-toast',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-accordion'
          ],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query'],
          'charts-vendor': ['recharts'],
          'utils-vendor': ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    // Aumentar límite de advertencia de chunk (los componentes lazy-loaded serán grandes)
    chunkSizeWarningLimit: 600,
  },
}));
