// Root workspace config so `vitest` at the repo root picks up both packages.
// Add `apps/web` (Playwright/RTL) here once a frontend test plan is in place.
export default ["packages/backend", "packages/ai"];
