# String Bingo

Create a board, share a link, and let guests play without an account.
Hosts sign in through String ID; Google login and MOE verification live there.

The landing page is at `/`, the default board at `/play`, and the editor at
`/new.html`. Shared games keep their `/play/:id` links.

Use Node 22.12+ (Node 22 line). The app uses Vite/vanilla JS with a same-origin
Express/Prisma API on Vercel. See [setup, identity migration and verification](backend/README.md)
and [the maintained feature spec](specs/001-host-auth-onboarding/spec.md).

By @KOKHC @physicstjc — first developed on Claude.
