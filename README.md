# Margin

A quiet, installable to-do notebook. Write one task per line, prioritise from **1 to 3** (3 is highest), and cross things off.

## Publish on GitHub Pages

Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/(root)**, then click **Save**. GitHub will show the live website URL after publishing.

## Use it

- Type a line and press Enter. Paste multiple lines to add several tasks.
- Tap a priority number to cycle 1 → 2 → 3.
- Tap the circle to cross off a task. Swipe right on a touch screen, or use the keyboard controls. Undo is available.
- Tap the task text to edit it.
- Switch to Advanced for groups, tags, due dates, effort, notes, waiting status, repeating tasks and reference links.
- Advanced shorthand: `Send drawings !3 #work ~30 @2026-12-04`.
- N starts a new line, / searches, Escape closes an open dialog.

## Install and back up

On Android Chrome: **⋮ → Add to Home screen → Install**.
On iPhone Safari: **Share → Add to Home Screen**.
On desktop Chrome or Edge, use the address-bar install control.

The app has no dependencies or external fonts. Its static files total about 55 KB before compression. It caches its app shell for offline use after a first visit. Tasks stay in localStorage on this device and browser origin; there is no automatic cross-device sync. Settings provides JSON export and import. Export before clearing browser data or moving devices. Import merges new task IDs without overwriting existing tasks.

## Outlook

Paste an Outlook email URL into a task's reference-link field to open the original email from the task.

An optional, on-demand flagged-email import is implemented under **Advanced → Outlook emails → Connect flagged work emails**. It requires your organisation's IT team to register a Microsoft Entra **single-page application**, configure the exact redirect URI shown in the app, and grant delegated **Mail.ReadBasic** permission subject to work policy. Enter the public client and tenant IDs; never use a client secret.

Sign-in uses authorization code + PKCE with a checked state value. The access token stays in memory. Imports read message IDs, subjects, email links and flags from the primary mailbox, paginate up to 2,000 messages, and skip already imported email IDs. Imports only run when requested. Completing a local task does **not** modify Outlook flags. No live work tenant was used to test this integration. Microsoft To Do's existing flagged-email list is also linked.

Official Microsoft references:
- https://support.microsoft.com/en-au/todo/using-microsoft-to-do-with-flagged-email-from-outlook
- https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow

## Development

Serve this directory over localhost or HTTPS, for example `python -m http.server 8000`.
No build is needed. Bump the cache name in `sw.js` when changing cached assets.

The app was browser-tested at desktop size and in a 390 × 844 phone frame for task creation, priorities, completion, advanced editing, groups, persistence and recurring weekly tasks. JavaScript syntax was checked with Node. Live Outlook access and final-host offline installation need verification on the user's device.

Design inspiration: TeuxDeux's paper-like restraint and Todoist's sections and structured details, with 3 as the maximum priority as requested.
