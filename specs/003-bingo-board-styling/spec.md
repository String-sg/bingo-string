# Bingo board readability and String styling

**Incident:** On the live board, white challenge labels blend into pale tiles. The completed centre uses dark text on a dark tile. The wide white header and low-contrast credits also compete with the board.

## Player and host journeys

- **FR-001** Default and shared boards keep numbers and prompts readable on unplayed, completed, centre and winning tiles, including when a player adds a photo. Text contrast must meet 4.5:1. Completion remains distinguishable without relying on colour alone.
- **FR-002** At 320px and above, the board fits the viewport and long prompts wrap. The board and header share the same edges. Keyboard focus stays visible. Play, photo upload, reset, downloads and mobile recenter retain their existing behavior.
- **FR-003** The board and host editor use String's typography and display one compact shared footer. Keep String Team's linked credit and Seng Kwang's inspiration credit, with game actions separate from footer links.
- **FR-004** The existing browser check covers the reported regression, including the unauthenticated board and editor. Review the built output at phone, tablet and desktop widths before release.

The styling repair is independent of the host authentication migration.
