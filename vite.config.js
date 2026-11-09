import { defineConfig } from 'vite'

function servePlayBoard(server) {
    server.middlewares.use((req, _res, next) => {
        const { pathname, search } = new URL(req.url, 'http://localhost')
        if (pathname === '/join' || pathname.startsWith('/host/live/') ||
            pathname === '/play' || pathname.startsWith('/play/') ||
            /^\/[^/]+(?:@|%40)[^/]+\/[^/]+\/?$/i.test(pathname)) {
            req.url = '/play.html' + search
        }
        next()
    })
}

export default defineConfig({
    base: '/',
    plugins: [{
        name: 'bingo-play-board',
        configureServer: servePlayBoard,
        configurePreviewServer: servePlayBoard,
    }],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: 'index.html',
                play: 'play.html',
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
