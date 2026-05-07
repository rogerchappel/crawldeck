# Adapter guide

The V1 adapter contract is intentionally small:

- `inspect(profile)` returns crawlable items without mutating queue state.
- `run(profile, job)` performs work and writes any report artifacts.
- Adapters return progress counters and error strings to the queue.

## Built-in fixture adapter

The fixture adapter reads `<fixture>/manifest.json`:

```json
{
  "items": [
    { "url": "https://example.local/", "title": "Home", "status": 200 }
  ]
}
```

Statuses `>= 400` are treated as item errors. This lets tests exercise failure handling without making network calls.

## Future real adapters

Real crawlers should be opt-in and document:

- whether they touch the network
- rate limits and robots.txt behavior
- credential requirements
- output format and retention
