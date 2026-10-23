# RainReady — Hackathon Submission

**Live demo:** https://rainready-kc-junction.steady-hub-2026.workers.dev

**Public source:** https://github.com/xiaochen050825/RainReady

This submission contains the latest tested team code, including isolated personal demos, consistent planning examples and linked inspection reports. It is a clean source snapshot of team release `d35564788cf307bc585455faa4b9c1647d3bc106`; production account identifiers and private repository history are excluded. Scoring and scheduling algorithms are unchanged.

## Quick tour for judges

1. Open the live demo; no login is needed.
2. On the homepage, change the crew count and choose **Try this plan**.
3. In **Storm plan**, inspect priorities, adjust capacity, review the schedule and preview routes.
4. In **Inspections**, view the linked asset, add notes or create an inspection.
5. In **Evidence**, run comparisons and export results.
6. Use **Reset Demo** to return your browser to the starting example. Your changes do not affect other visitors.

The published release passed 41 unit tests, 7 deployed API tests and 8 browser workflow checks. The local instructions below run against a separate local database.

Anyone can open and use this site without signing in. Cloudflare D1 serves one curated, read-only example. Each visitor edits a separate copy stored in their browser. Plans, photos, notes, approvals, backup restore and reset never overwrite another visitor's demo. Tabs in the same browser share that browser's copy, with conflict protection.

The homepage and fresh workspace use the same Taman Rintis scenario: 28 assets, 2 crews, 64 mm rainfall and a 120-minute deadline. "Try this plan" carries the selected crew count into the workspace after confirmation. Inspection reports use INS- IDs; physical assets use RR- IDs. The four sample reports link to RR-001, RR-007, RR-013 and RR-019 at their actual sample coordinates.

## Working features

- Complete 45-second narrated film, captions, playback controls and responsive landing page.
- Interactive network map, configurable rainfall, teams, working hours and deadline.
- Network-aware scheduling, timed crew preview, task details, explicit approval and approval invalidation after changes.
- Optional real road-network travel-time lookup feeds the planner. Road geometry, estimated arrivals and navigation links are available. Known road-route overtime blocks approval.
- Validated network import with preview before applying; network, plan and comparison downloads.
- Inspections from an existing facility or a searched location; before/after photo upload, model estimates, duplicate-photo rejection, notes, facility links and human review.
- Repeatable sample comparisons, negative outcomes retained, downloadable results.
- Browser-local saving, visible failures, same-browser tab conflict protection, personal backup restore and reset with confirmation. Public writes to the cloud baseline are rejected by the server.

## Honest limits

The initial network and comparison cases are illustrative. Crew movement is a timed preview, not live GPS. Approval does not dispatch crews. Road estimates exclude live traffic and depend on OSRM/FOSSGIS availability; check actual access. Photo checks assist human review and do not measure hydraulic capacity or predict floods.

Road-time lookup supports 49 facilities plus one base; distance-based planning supports validated networks up to 500 facilities. Photos are resized to 960 pixels. Backup imports are capped at 8 MB. Browser storage quotas vary; failed saves are shown and the current draft can still be downloaded. Clearing browser data removes the personal copy. Download a backup to move it to another browser. Keep original photos separately.

## Run locally

Use Node.js 24, the version used to verify this submission. No Cloudflare login or production credentials are required for the local preview. The checked-in database ID is a placeholder for local use.

```sh
git clone https://github.com/xiaochen050825/RainReady.git
cd RainReady
npm ci
npm run build:cloudflare
node node_modules/wrangler/bin/wrangler.js d1 migrations apply rainready-hackathon --local --config wrangler.cloudflare.json --persist-to .wrangler/state
node scripts/seed-demo-baseline.mjs demo-baseline.sql
node node_modules/wrangler/bin/wrangler.js d1 execute rainready-hackathon --local --config wrangler.cloudflare.json --persist-to .wrangler/state --file demo-baseline.sql
npm start -- --port 5174
```

Open **http://127.0.0.1:5174**. Leave that terminal running. Run the tests below in a second terminal from the same folder.

D1 stores the curated baseline and route caches. Personal changes stay in browser storage. The standalone deployment does not need ChatGPT, OpenAI services or R2.

```sh
npm test
npm run typecheck
npm run test:integration
```

Set `RAINREADY_TEST_ORIGIN` to test a running Worker elsewhere. The integration tests verify that public writes are rejected and do not modify the baseline. For browser tests, install Playwright, then run `node scripts/test-demo-browser.cjs`; alternatively set `RAINREADY_PLAYWRIGHT` to an existing Playwright module. The browser checks cover two independent visitors, homepage handoff, report links, persistence, export, restore, reset and mobile layout.

## Source and media

The original scoring and planning approach is retained, with optional road-network travel times. Without road times, the original distance model is unchanged. Film attribution and source notes: MEDIA-CREDITS.md.

## Deploy to your own Cloudflare account

Local preview works with the placeholder database ID. To deploy your own copy:

1. Run `npx wrangler login`.
2. Run `npx wrangler d1 create rainready-hackathon`.
3. Replace `d1_databases[0].database_id` in `wrangler.cloudflare.json` with the returned database ID. Choose a unique Worker `name` for your deployment. If you use a different database name, update the config and commands accordingly.
4. Run:

```sh
npm run build:cloudflare
node node_modules/wrangler/bin/wrangler.js d1 migrations apply rainready-hackathon --remote --config wrangler.cloudflare.json
node scripts/seed-demo-baseline.mjs demo-baseline.sql
node node_modules/wrangler/bin/wrangler.js d1 execute rainready-hackathon --remote --config wrangler.cloudflare.json --file demo-baseline.sql
npm run deploy:cloudflare
```

Cloudflare prints the deployed URL. This repository does not include access to the team's production database or deployment account. The baseline seed is idempotent; public visitors can only read it. Personal edits are stored in their browser.
