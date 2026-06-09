# crawldeck

A local-first crawl job deck for agents and developers who want to queue, pause, inspect, and report on crawl work without surprise network calls.

crawldeck is inspired by the useful control-plane shape of [CrawlBar](https://github.com/vincentkoc/CrawlBar), but it is a fresh TypeScript CLI implementation with different branding, scope, and code. V1 deliberately starts as a fixture-backed CLI rather than a macOS menu bar app, so it is testable, deterministic, and safe for agent workflows.

## Why this exists

Crawlers tend to become invisible background magic. crawldeck makes the boring control surface explicit:

- profiles describe what can be crawled
- jobs live in local JSON queue files
- health shows queue depth and failures
- reports summarize what happened
- adapter seams leave room for real crawlers later

No telemetry. No credentials. No external crawl network calls by default.

## Install

```bash
npm install
npm run build
npm link
```

Or run directly from a checkout:

```bash
node dist/cli.js --help
```

## Quickstart

```bash
npm install
npm run build
crawldeck init
crawldeck profile add sample --fixture ./fixtures/sample-site
crawldeck job enqueue sample
crawldeck job list
crawldeck inspect sample
crawldeck job pause <job-id>
crawldeck job resume <job-id>
crawldeck job start <job-id>
crawldeck health
crawldeck report
```

The sample fixture includes a 404 on purpose, so the started job demonstrates failure reporting.

## Commands

```text
crawldeck init
crawldeck adapters
crawldeck profile add <name> --fixture <path> [--out <dir>]
crawldeck profile list
crawldeck inspect <profile>
crawldeck job enqueue <profile>
crawldeck job list
crawldeck job next
crawldeck job status <job-id>
crawldeck job start <job-id>
crawldeck job pause <job-id>
crawldeck job resume <job-id>
crawldeck job complete <job-id>
crawldeck health
crawldeck report [--json]
```

## Local state

By default crawldeck writes only under:

- `.crawldeck/queue.json`
- `.crawldeck/out/<job-id>/...`

Use `--deck-dir <dir>` to put the queue somewhere else.

## Adapter seam

The built-in adapter is `fixture`. Future real crawler adapters can register through the library seam:

```js
import { adapterSeam } from 'crawldeck';

adapterSeam('my-crawler', () => ({
  name: 'my-crawler',
  async inspect(profile) { return []; },
  async run(profile, job) { return { totalItems: 0, processedItems: 0, errors: [], reportPath: '' }; }
}));
```

Real adapters should be explicit about network access, robots.txt behavior, rate limits, and credential use.

## Verification

```bash
npm test
npm run check
npm run build
npm run smoke
bash scripts/validate.sh
```

## Safety and privacy

- Local-first queue and reports.
- Fixture-backed by default.
- No hidden telemetry or analytics.
- No credential scraping or secret storage.
- No publishing or external crawling unless a future adapter explicitly implements it.
## Release readiness

Run the same checks expected before opening or cutting a release:

```sh
npm run check
npm run test
npm run build
npm run smoke
npm run package:smoke
npm run release:check
```

Use `npm pack --dry-run` to confirm the published package contains the CLI/runtime files plus README, license, security, support, and release notes.

## License
MIT
