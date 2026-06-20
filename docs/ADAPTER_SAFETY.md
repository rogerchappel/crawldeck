# Adapter Safety Policy

CrawlDeck V1 ships with a fixture adapter so jobs can be tested without crawling external sites. Treat every non-fixture adapter as a side-effect boundary.

## Required Adapter Notes

Before enabling an adapter, document:

- Whether it performs network requests.
- Which domains or URL patterns it can access.
- How it handles robots.txt, rate limits, retries, and user agents.
- Whether credentials, cookies, browser profiles, or API keys are read.
- Where output is written and whether data leaves the local machine.

## Agent Approval Gate

Agents may use the fixture adapter without extra approval. Agents must ask for approval before:

- Running a network-capable adapter.
- Crawling an external domain.
- Reading credentials or browser state.
- Uploading reports or crawl outputs.
- Increasing concurrency beyond a documented local default.

## Review Checklist

- Adapter source is local and inspectable.
- README or adapter docs describe side effects.
- A fixture-backed test exists for the adapter contract.
- Smoke commands can run without private credentials.
