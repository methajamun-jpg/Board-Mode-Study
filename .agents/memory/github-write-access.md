---
name: GitHub write access
description: Which Replit GitHub connection is needed for publishing repository changes.
---

Use a GitHub connection with explicit repository push permission for commit publishing. A GitHub App connection may be healthy and readable while still returning not-found or invalid-credential responses for write operations.

**Why:** Read access and write access are separate capabilities, and Git transport authentication may not reflect the permissions of the active connection.

**How to apply:** Check the connection's repository permissions before publishing. If Git push fails but the writable connector is available, publish through the authenticated GitHub API and verify the target branch ref afterward.