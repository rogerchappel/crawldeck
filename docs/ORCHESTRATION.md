# Orchestration

crawldeck is designed so agents and humans can coordinate crawl work without hidden side effects.

## State contract

- Queue file: `.crawldeck/queue.json`
- Generated reports: profile output directory, default `.crawldeck/out/<job-id>/`
- No network calls are made by the built-in `fixture` adapter.
- External crawler adapters must be explicit and should document their network behavior.

## Agent-safe loop

```bash
crawldeck profile add docs --fixture ./fixtures/sample-site
crawldeck job enqueue docs
crawldeck job list
crawldeck job start <job-id>
crawldeck health
crawldeck report
```

## Status meanings

- `queued`: ready to run
- `running`: currently being processed
- `paused`: intentionally held
- `completed`: finished with no item errors
- `failed`: finished with adapter or item errors
