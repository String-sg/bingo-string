# Implementation plan

Use the existing Vite static entry points and Vercel rewrites. Move the board document to `play.html`, give the homepage its own document and stylesheet, and serve the board at both `/play` and existing shared paths. Resolve String ID's fixed return to the homepage from the existing tab-local host intent. Reuse the vendored footer and its current contributor credit.
