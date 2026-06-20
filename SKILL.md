# CrawlDeck Skill

## When To Use

Use this skill when an agent needs to prepare, inspect, queue, pause, or report on local crawl jobs without launching hidden network activity. It is best for fixture-backed crawl demos, crawler adapter development, and local crawl job handoffs.

## Required Inputs

- A local CrawlDeck checkout or installed `crawldeck` CLI.
- A deck directory, default `.crawldeck`, for queue state and generated reports.
- A profile that points at a fixture directory or an explicitly approved crawler adapter.

## Side-Effect Boundaries

The built-in fixture adapter reads local fixture files and writes local queue/report files. It does not crawl the public web, read credentials, post externally, or publish artifacts. Future adapters must document their network, credential, robots.txt, and rate-limit behavior before use.

## Approval Requirements

Local fixture scans do not need approval. Get explicit human approval before enabling a non-fixture adapter, crawling an external domain, using credentials, or sending reports to another system.

## Workflow

1. Run `crawldeck init`.
2. Add a profile with `crawldeck profile add <name> --fixture <path>`.
3. Enqueue and review with `crawldeck job enqueue <name>` and `crawldeck job list`.
4. Start the job only after confirming the adapter boundary.
5. Review `crawldeck health` and `crawldeck report`.

## Validation

```sh
npm run release:check
```
