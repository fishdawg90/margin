# Margin

A minimal, installable task list with two main spaces: **Work** and **Home**. Write one task per line, prioritise from **1 to 3** (3 is highest), and cross things off.

## Publish on GitHub Pages

Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/(root)**, then click **Save**. GitHub will show the live website URL after publishing.

## Use it

- Choose the large **Work** or **Home** button. Each has its own groups.
- Type a task and press Enter. Paste several lines to add a batch.
- **Drag by the grip** into a group, or onto Work / Home to move between lists. Tasks stay in alphabetical A–Z order within each group. Touch handles support direct dragging and edge scrolling. Clicking or keyboard-activating the grip opens the editor's list and group controls as an accessible alternative.
- Tasks automatically stay alphabetically sorted, including after adding, editing, moving and undoing. Subtasks keep their own step order.
- **Clear finished** removes completed parent tasks from the selected Work or Home list, across its groups (including tasks hidden by search). A short eraser wipe closes the gaps. Undo restores the removed tasks for 12 seconds. Unfinished tasks, their completed substeps, other lists and groups are kept. Reduced-motion preferences skip the animation.
- Tap a priority number to cycle 1 → 2 → 3. Three is highest.
- Tap a circle to cross a task off. Undo is available for ten seconds.
- Tap a task's words to edit it. List, group and subtasks are always available.
- Tap the small **+ beside a task** to add a subtask. Enter adds it and keeps the input ready for another.
- In Settings, choose **Inline bubbles** (default) or **Small list**. Subtask bubbles sit beside the main task where space permits and wrap on narrow screens. Each can be crossed off independently.
- Turn on Advanced details in Settings for dates, tags, effort, notes, waiting status, repetition and email links.
- Advanced shorthand: `Send drawings !3 #work ~30 @2026-12-04`.
- N starts a task, / searches, Escape closes a dialog.

## Existing tasks

The same browser storage key is retained. Version 1 data migrates locally: old Work groups become the Work list, old Home/Personal groups become Home, and other named groups stay together under Work. Task IDs, completion, priorities, notes, dates, tags, repeat settings and email references are preserved. The original v1 JSON is also retained locally as a pre-upgrade recovery copy. Imports accept both v1 and v2 backups and merge new task IDs without replacing current tasks. No tasks are uploaded.

## Install and back up

On Android Chrome: **⋮ → Add to Home screen → Install**.
On iPhone Safari: **Share → Add to Home Screen**.
On desktop Chrome or Edge, use the address-bar install control.

The app has no runtime dependencies or external font requests. The small, bundled handwriting font is a Latin subset of Kalam, licensed under SIL OFL (see FONT-LICENSE.txt). It caches its app shell for offline use after a first visit. Tasks stay in localStorage on this device and browser origin; there is no automatic cross-device sync. Settings provides JSON export and import. Export before clearing browser data or moving devices. Import merges new task IDs without overwriting existing tasks.

## Outlook

Paste an Outlook email URL into a task's reference-link field to open the original email from the task.

An optional, on-demand flagged-email import is implemented under **Settings → Advanced details**, then **Outlook emails → Connect flagged work emails**. It requires your organisation's IT team to register a Microsoft Entra **single-page application**, configure the exact redirect URI shown in the app, and grant delegated **Mail.ReadBasic** permission subject to work policy. Enter the public client and tenant IDs; never use a client secret.

Sign-in uses authorization code + PKCE with a checked state value. The access token stays in memory. Imports read message IDs, subjects, email links and flags from the primary mailbox, paginate up to 2,000 messages, and skip already imported email IDs. Imports only run when requested. Completing a local task does **not** modify Outlook flags. No live work tenant was used to test this integration. Microsoft To Do's existing flagged-email list is also linked.

Official Microsoft references:
- https://support.microsoft.com/en-au/todo/using-microsoft-to-do-with-flagged-email-from-outlook
- https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow

## Development

Serve this directory over localhost or HTTPS, for example `python -m http.server 8000`.
No build is needed. Run `node --test tests/data.test.mjs` for data migration, movement, recurrence and backup checks. Bump the cache name and versioned asset URLs when changing cached assets. The service worker is disabled on localhost for development; HTTPS deployments cache the application shell.

The app was browser-tested at desktop size and in a 390 × 844 phone frame for task creation, priorities, completion, advanced editing, groups, persistence and recurring weekly tasks. JavaScript syntax was checked with Node. Live Outlook access and final-host offline installation need verification on the user's device.

Design inspiration: TeuxDeux's paper-like restraint and Todoist's sections and structured details, with 3 as the maximum priority as requested.


