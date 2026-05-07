# Example local session

```bash
crawldeck init
crawldeck profile add local-docs --fixture ./fixtures/sample-site --out ./.crawldeck/out
crawldeck job enqueue local-docs
crawldeck job list
crawldeck job start local-docs-job-001
crawldeck report
```

Expected shape:

```text
crawldeck health
profiles: 1
jobs: 1
queued: 0
running: 0
paused: 0
completed: 0
failed: 1
```
