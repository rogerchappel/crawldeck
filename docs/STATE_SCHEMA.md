# State schema

crawldeck stores one local JSON document by default at `.crawldeck/queue.json`.

```json
{
  "version": 1,
  "profiles": [],
  "jobs": []
}
```

## Profile fields

- `id`: stable local identifier generated from the profile name.
- `name`: human-readable name.
- `adapter`: adapter key, `fixture` in V1.
- `fixturePath`: absolute path to a fixture directory with `manifest.json`.
- `outputDir`: absolute directory for job reports.

## Job fields

- `id`: local queue identifier.
- `profileId`: profile that owns the job.
- `status`: `queued`, `running`, `paused`, `completed`, or `failed`.
- `totalItems` / `processedItems`: adapter progress counters.
- `errors`: adapter or item-level error strings.
- `lastEvent`: short human-readable status note.
