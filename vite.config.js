import { defineConfig } from 'vite'

export default defineConfig({
    base: '/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: 'index.html',
                new: 'new.html'
            }
        },
        copyPublicDir: true
    },
    publicDir: 'public',
    server: {
        proxy: {
            '/api': {
                target: process.env.BINGO_DEV_API_TARGET || 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            }
        }
    }
}) 