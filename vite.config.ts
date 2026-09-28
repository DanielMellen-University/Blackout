import { defineConfig } from 'vite'

/** Keep rendering dependencies and the audio runtime cacheable instead of rebuilding them into the app entry. */
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/three/addons/') || id.includes('node_modules/three/examples/')) {
            return 'three-addons'
          }
          if (id.includes('node_modules/three/')) return 'three'
          if (
            id.includes('/src/systems/ChallengeRun.') ||
            id.includes('/src/systems/SortieContract.') ||
            id.includes('/src/systems/CourseLibrary.') ||
            id.includes('/src/systems/CareerProgression.')
          ) return 'game-content'
          if (id.includes('/src/audio/')) return 'flight-audio'
          return undefined
        },
      },
    },
  },
})
