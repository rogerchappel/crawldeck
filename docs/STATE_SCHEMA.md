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

## Job status transitions

The CLI and library enforce the same transition policy:

| Current status | Allowed next statuses |
| --- | --- |
| `queued` | `running`, `paused`, `completed` |
| `running` | `paused`, `completed`, `failed` |
| `paused` | `queued`, `running`, `completed` |
| `completed` | none (terminal) |
| `failed` | none (terminal) |

Commands apply those transitions as follows:

- `job start`: `queued` or `paused` to `running`; the adapter then finishes the
  running job as `completed` or `failed`.
- `job pause`: `queued` or `running` to `paused`.
- `job resume`: `paused` to `queued`.
- `job complete`: `queued`, `running`, or `paused` to `completed`.

Invalid transitions return a nonzero CLI exit and do not modify `queue.json`.
Entering `running` records `startedAt` once. Entering `completed` or `failed`
records `completedAt`. Every allowed transition refreshes `updatedAt` and
`lastEvent`; rejected transitions preserve all fields.
