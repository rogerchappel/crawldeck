# Release Notes

## Next

### Summary

- Prepare Crawldeck for the next public release.
- Add agent skill instructions and adapter approval guidance.
- Include skill, docs, and validation scripts in the package dry run.

### Verification

- `npm run release:check`
- `npm pack --dry-run`

### Upgrade Notes

- No breaking changes are planned for this readiness update.

### Maintainer Notes

- Confirm the dry-run package includes README, license, security, support, and runtime assets before publishing.
- Confirm agents use the fixture adapter unless a human approves a network-capable adapter.
