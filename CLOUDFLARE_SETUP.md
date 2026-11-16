# Margin: private sync with Cloudflare

Margin keeps its existing GitHub Pages address and works offline. The optional Worker stores tasks, subtasks and groups in your own D1 database. Display preferences, Outlook credentials and the private sync key do not enter the notebook backup or cloud notebook.

## One-time setup in your existing Cloudflare account
Our Basket's source uses Cloudflare for photo recognition and Firebase for basket data. Create a **new** Worker and database for Margin. Do not edit the Our Basket Worker, its secrets or Firebase settings.

1. Open https://dash.cloudflare.com/ and use the account containing your Our Basket Worker.
2. Under **Storage & databases → D1 SQL database**, create a database named **margin-sync**. No SQL import is needed; the Worker creates its one table on its first authenticated request.
3. Under **Workers & Pages**, create a new Worker named **margin-sync** (the Hello World starter is sufficient). Open **Edit code**, replace the starter with the complete contents of [cloudflare/worker.mjs](cloudflare/worker.mjs), and deploy. This is an ES module: keep the default export.
4. On this new Worker's **Bindings** tab, add a **D1 database** binding. Set the variable name to **DB**, and choose the **margin-sync** database. Deploy/save the binding.
5. Open https://fishdawg90.github.io/margin/ → Settings → **Sync your devices**. Select **Generate a key**. Save this random key in your password manager. Generating a new key does not rotate an existing Cloudflare secret; use this only for initial setup or intentional rotation.
6. Back in the new Worker's **Settings → Variables and Secrets**, add a **Secret** named **SYNC_KEY**, paste that key, and deploy. Do not use the Our Basket photo key or an OpenAI API key.
7. Copy this Worker's HTTPS workers.dev address into Margin's **Worker address** field. Keep the generated key in **Private sync key** and select **Connect & sync**. The address must have no path, query or fragment.
8. In Margin on each other device, enter the same Worker address and key and select **Connect & sync**. Let the status show **Synced** before moving to another device.

You do not need a domain, Firebase, GitHub Pro, a paid Cloudflare subscription, or an API token for this dashboard-based setup. Current free-tier limits apply.

The Worker address is not secret. You can share that address to get help. **Do not paste SYNC_KEY into chat, GitHub code, issues or URLs.** Enter it only in Cloudflare's secret field, your password manager and Margin's private sync field. Whoever has it can read and change this notebook. It is a personal pairing key, not a multi-user account system. It is stored in browser storage on connected devices.

## Check the setup
Open your Worker's address with /health appended. The response should contain service: margin-sync and ready: true. This confirms the binding and key format are configured; **Synced** in Margin confirms an authenticated database read/write. No notebook contents appear on the health page.

Add one temporary task on your phone. Open the app on the laptop and use **Sync now** in Settings (or wait up to 15 seconds while the app is visible). Tick it off on the laptop and check the phone. Test offline by adding another task with the phone disconnected, then reconnecting. Install/open the same existing app address on each device.

## How it behaves
- Opening/focusing the app checks the cloud. Changes sync shortly after saving; an open app checks periodically. A closed app does not sync in the background.
- The first connection combines existing local and cloud tasks by their IDs. Independently created identical-looking tasks have different IDs and can both remain.
- Edits to different tasks merge. Changes to the same task from both devices (including edit-versus-delete) pause sync. Settings names the affected tasks and lets you keep this device's conflicting versions or the cloud's. Unrelated changes remain merged.
- While a task/group editor, subtask entry, drag, clear animation or Undo is active, applying cloud changes waits so it does not interrupt the action.
- Deletions sync. Completed subtasks remain part of their parent task. Empty named groups sync.
- Display preferences stay local. Tasks, advanced details and email reference links in tasks sync.
- **Disconnect** removes this device's stored connection key and stops syncing. It retains its local tasks and leaves cloud data intact. Other connected devices are unaffected.
- Backups remain available. Sync is not a substitute for an occasional export. Do not clear browser storage while offline changes are waiting to upload.

## Recovery and key rotation
For a lost key, generate a new random key, update the Worker's SYNC_KEY secret, and update every device. Existing tasks remain in D1. A device using the old key will report that its key was not accepted.

If the database cannot be reached, tasks stay on the device. Export a backup if the app reports it cannot save locally. For cloud recovery, Cloudflare D1 provides its own recovery tools; retain separate exports of important tasks.

## Technical details
The Worker permits the Margin GitHub Pages origin and requires the key on every notebook request. The key is compared through SHA-256 digests. Database access stays server-side. Requests and responses use no-store; the app's service worker never caches the cross-origin notebook API.

A conditional revision update prevents stale snapshots overwriting newer cloud data. The client retains its last cloud baseline and performs a three-way merge; offline deletions remain deletions, and conflicts require a choice. Per-origin Web Locks serialize same-browser tabs. This is intentionally one personal notebook per Worker/database; use a current Chrome, Edge, Firefox or Safari browser supporting Web Locks.

Maximum sync request size: 2 MB. Maximum tasks: 20,000; groups: 2,000. No account-wide Cloudflare token or database key is shipped in the frontend. Do not enable request-body or Authorization-header logging.

Tests are in tests/sync.test.mjs and tests/sync-client.test.mjs. GitHub Actions runs all data, identity, sync and Worker checks. Real multi-device and offline verification still needs the Worker deployed in your account.
