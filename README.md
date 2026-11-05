# String Bingo

Create a board, share a link, and let guests play without an account.
Hosts sign in through String ID; Google login and MOE verification live there.

Use Node 22.12+ (Node 22 line). The app uses Vite/vanilla JS with a same-origin
Express/Prisma API on Vercel. See [setup, identity migration and verification](backend/README.md)
and [the maintained feature spec](specs/001-host-auth-onboarding/spec.md).

By @KOKHC @physicstjc — first developed on Claude.

## Shared String footer

The footer is vendored from [String-sg/string-footer](https://github.com/String-sg/string-footer). `string-footer.json` records its version and source digest. Update the shared source and use its sync script to regenerate this checkout; add `--check` to detect drift. See the upstream README for adoption and validation instructions. Product-specific controls and integration links remain outside the shared footer.
