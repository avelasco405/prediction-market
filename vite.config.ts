import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // 部署到 GitHub Pages 时设置 base 为仓库名，例如: '/repo-name/'
  // For GitHub Pages deployment, set base to repo name, e.g.: '/repo-name/'
  // 部署到 Cloudflare Pages 时保持 '/'
  base: process.env.GITHUB_PAGES ? '/prediction-market/' : '/',
  build: {
    outDir: 'dist',
    // 生成 SPA 回退
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
