# Bingo landing page

**FR-001** Visitors at `/` see what Bingo is, an example board, and links to play or host. Loading this page does not start a game or check an account.

**FR-002** The default board opens at `/play`. Existing shared boards keep their `/play/:id` links and remain playable without signing in. The host editor stays at `/new.html`.

**FR-003** When String ID returns a host to `/` in the same tab, Bingo resumes their pending create or dashboard action. Old `/?host=1` bookmarks open the dashboard route.

**FR-004** The landing page uses String typography, a light board preview against a dark hero, and the current compact footer. On small screens the preview stacks below the actions without horizontal scrolling.
