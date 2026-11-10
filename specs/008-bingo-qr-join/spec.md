# Scan to join live Bingo

A teacher can project a QR code beside the six-digit PIN in a live lobby. A student scans it with their phone camera, opens the student join form with the PIN filled in, and chooses a nickname. The typed PIN route works on the same screen.

- **FR-001** The owner’s lobby displays a readable QR code in Waiting and Playing. End hides it and closes the PIN.
- **FR-002** The QR opens the same-origin `/join` route. Pass the six-digit PIN in the URL fragment. The join form uses the same server validation and requires a nickname before creating a player entry.
- **FR-003** Scanning the same session link in the same browser resumes the existing player entry. A different scanned PIN opens the join form for that PIN. Invalid fragments leave the PIN field blank.

## Acceptance

- On one student phone, open the projected QR destination. Verify the PIN is filled in and the nickname is blank. Join and reopen the same destination. The roster still shows one student.
- On a second phone, enter the PIN manually. Both students wait until Start and open the same board. End hides the QR and closes the student session.
- Run the browser check with `node tests/live-qr.mjs` against the isolated live Bingo fixture. [Preview setup](../007-live-bingo/quickstart.md)
