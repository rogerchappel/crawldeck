# Release Checklist

Use this checklist before publishing crawldeck.

## Local Verification

- Run `npm install` from a clean checkout.
- Run `npm run release:check` when available.
- Run `npm pack --dry-run` and inspect the file list.
- Run the documented CLI smoke command from the README.

## Package Contents

Confirm the package includes:

- runtime CLI or library files
- README.md
- LICENSE
- SECURITY.md
- SUPPORT.md
- RELEASE_NOTES.md or CHANGELOG.md
- examples, fixtures, or docs required by the README

## Public Readiness

- README quickstart matches the current binary name.
- Release notes call out breaking changes or explicitly state that there are none.
- Security and support docs give users a clear place to report issues.
- CI is green on the release branch.
