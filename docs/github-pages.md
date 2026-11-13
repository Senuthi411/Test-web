# GitHub Pages deployment

Site: https://senuthi411.github.io/Test-web/

In repository **Settings > Pages > Build and deployment > Source**, select
**GitHub Actions**. Do not publish `main / (root)`: it contains Vite source,
not the compiled site. The deployment workflow publishes only `dist/`.

`.github/workflows/deploy.yml` runs on pushes to `main` and manual dispatch.
It uses Node 24, `npm ci`, lint, and the production build, then uploads and
deploys the Pages artifact. Build-time `VITE_DATA_SOURCE=fixtures` enables the
labelled demo without a backend or private environment file. No secrets are needed.

Vite builds/previews use `/Test-web/`; local development stays at `/`.
The Pages build uses hash routing (for example `/Test-web/#/login` and
`/Test-web/#/review/queue`) so refresh and direct links do not require server
rewrites. Local development keeps browser-history routes. Existing links and
screens continue to use the same application route definitions.

Verify locally after a fixture-mode production build:

```sh
node tests/deployment/pages.smoke.mjs
```

The smoke check serves `dist` under `/Test-web/` without a history fallback and
checks Administrator and Supervisor fixture sign-in, navigation, refresh, assets,
browser errors and absence of backend requests. Set `PAGES_URL` to the live URL
to run the same check after deployment. Screenshots go to ignored `test-results/`.
