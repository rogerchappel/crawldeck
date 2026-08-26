# Example local session

Run these commands from a fresh checkout after `npm ci && npm run build` (or
after installing the package). All state is stored under `./.crawldeck/`.

```bash
crawldeck init
crawldeck profile add local-docs --fixture ./fixtures/sample-site --out ./.crawldeck/out
crawldeck job enqueue local-docs
crawldeck job list
crawldeck job start local-docs-001-job-001
crawldeck health
crawldeck report
```

Expected transcript (`crawldeck init` prints the absolute deck path, which
varies by machine):

```text
$ crawldeck init
Initialized crawldeck at ./.crawldeck
$ crawldeck profile add local-docs --fixture ./fixtures/sample-site --out ./.crawldeck/out
Created profile local-docs-001
$ crawldeck job enqueue local-docs
Queued job local-docs-001-job-001
$ crawldeck job list
local-docs-001-job-001	local-docs-001	queued	0/0	queued
$ crawldeck job start local-docs-001-job-001
local-docs-001-job-001 failed 3/3
$ crawldeck health
crawldeck health
profiles: 1
jobs: 1
queued: 0
running: 0
paused: 0
completed: 0
failed: 1
$ crawldeck report
# crawldeck report

- profiles: 1
- jobs: 1
- processed items: 3
- recorded errors: 1

## Recent jobs

- local-docs-001-job-001: failed (3/3)
```

Notes:

- Job ids are derived from the profile id: `crawldeck profile add local-docs`
  creates profile `local-docs-001`, and its first job is
  `local-docs-001-job-001`. Read the exact id from the `Queued job ...` line or
  from `crawldeck job list` instead of guessing it.
- The sample fixture includes one 404 item on purpose, so the started job
  finishes with status `failed` (3/3 processed) and `crawldeck health` reports
  `failed: 1`. That is expected: the run completes and the failure is recorded
  in `crawldeck report`.