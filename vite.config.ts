import { defineConfig } from 'vite'

/** Keep the rendering dependency cacheable instead of rebuilding it into the app entry. */
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('/node_modules/three/addons/') || id.includes('/node_modules/three/examples/')) {
            return 'three-addons'
          }
          if (id.includes('/node_modules/three/')) return 'three'
          return undefined
        },
      },
    },
  },
})
