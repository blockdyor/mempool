# mempool

A minimal Bitcoin mempool card for a Cloudflare Worker. One self-contained JavaScript runtime file, inline SVG, no framework, build step, runtime dependencies, cookies or trackers.

A sibling to [Price](https://github.com/blockdyor/price): the same blockdyor logo, system font, light/dark palette, 420px layout and 230px card. Original layered block graphics reference [rbitcoin.space](https://rbitcoin.space/); no upstream Rust, frontend code or assets are copied.

**Deployment target:** https://mempool.blockdyor.com. The repository is ready for Cloudflare Workers Builds; publishing it on GitHub does not connect or deploy a Cloudflare Worker.

## Automatic updates from GitHub

Use Cloudflare's native Git integration, as with Price. No GitHub deployment workflow or Cloudflare credentials in this repository are needed.

1. In Cloudflare **Workers & Pages**, create a Worker named **mempool**, or open it if you already created it.
2. Under the Worker's **Settings → Build**, connect **blockdyor/mempool**. If creating directly from GitHub, select this same repository and Worker name.
3. Set:
   - Production branch: `main`
   - Root directory: repository root (default)
   - Build command: `npm test`
   - Deploy command: `npx wrangler deploy` (Cloudflare's default)
4. Under **Settings → Domains & Routes**, add the custom domain **mempool.blockdyor.com**.
5. Check the first build/deployment succeeds, then open the domain and `/api/mempool`.

Subsequent pushes to `main` can deploy automatically. Make lasting changes in GitHub: dashboard code edits can be overwritten by the next Git deployment. GitHub authorization and deployment credentials stay inside Cloudflare; do not add tokens or account IDs to this repository or send them in chat.

`wrangler.toml` targets `mempool`, with `src/index.js` as its only runtime file. Like Price, it sets `keep_vars = true` and `workers_dev = false`, and deliberately omits domain routes and variables. Configure the custom domain in the dashboard; future Git deployments preserve that dashboard-managed routing. The `workers.dev` endpoint is disabled, so use the custom domain after setup. Do not connect this repository to the existing `price` Worker.

No KV, D1, cron, secrets, paid service or frontend compilation is required. Cloudflare's normal usage limits apply. The page retains `noindex,nofollow`; that discourages indexing but is not access control. For private remote testing, configure Cloudflare Access for every route before exposing it.

References: [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [Wrangler dashboard configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth).

### Manual alternative

Paste the entire contents of [`src/index.js`](src/index.js) into the `mempool` Worker's code editor and deploy. Only this file is needed. For automatic updates, still connect the repository as described above.

## Embed

After deploying to the target domain, paste into a Ghost HTML card:

```html
<iframe src="https://mempool.blockdyor.com/?embed=1&theme=auto"
  title="Bitcoin mempool" width="320" height="140" style="border:0" loading="lazy"></iframe>
```

Or use the widget script:

```html
<div data-mempool data-width="320" data-height="140"></div>
<script defer src="https://mempool.blockdyor.com/widget.js"></script>
```

The script follows Ghost's `theme-dark` class and retains a compact logo/backlink. Optional `data-theme="light"`, `"dark"` or `"auto"` pins a theme. Direct iframes follow the operating-system theme unless the URL specifies `theme=light` or `theme=dark`. The standalone theme button cycles auto/dark/light.

`data-width` and `data-height` accept positive integer pixels (optionally `px`) or integer percentages up to `100%`; defaults are 320×140. Compact embeds omit secondary per-block fee/transaction labels to keep graphics and the four fee recommendations readable. Custom sizes such as 480×200 fit too. Very small frames may not fit all information. No Ghost theme changes or installation in the Worker are required.

## Data and caching

All upstream requests are server-side to fixed [mempool.space API](https://mempool.space/docs/api/rest) endpoints: `/api/v1/blocks`, `/api/v1/fees/mempool-blocks`, `/api/v1/fees/recommended` and `/api/mempool`.

The card shows one projected block, two latest mined blocks, four fee recommendations and total waiting virtual size. Block graphics are noninteractive; the standalone footer has only the blockdyor backlink and right-aligned Source link, matching Price. Recommendations are estimates, not guaranteed confirmation deadlines. Public/keyless access remains subject to the provider's [terms](https://mempool.space/terms-of-service); this is not a guarantee about licensing, availability or cost.

The browser checks every 30 seconds while visible; provider publication cadence is separate. Worker Cache API entries are fresh for 30 seconds, with failure fallback up to 10 minutes. The one UTC caption is aggregate retrieval/capture time, **not** provider publication time: these endpoints do not supply a shared publication timestamp. `Cached ·` retains the original capture time. Failed refresh with no usable data displays `Temporarily unavailable`. Cache entries are per-data-center and may be evicted.

Bands visualize sampled fee-range levels from blue to purple; filled height is virtual size relative to 1 million vB, capped at full. They are not individual transaction rectangles or exact percentile histograms.

## Local development

Use Node.js 22 or newer. No `npm install` is needed.

```sh
npm test
npm run dev
```

Open `http://127.0.0.1:8788`. The development server binds loopback only; restart it after editing the Worker. This plain Node server does not emulate Cloudflare Cache API. Tests exercise the Worker and generated client script, including API validation, error states, cache expiry, theme/visibility handling and the Git deployment configuration.

## Privacy and license

The browser requests only the Worker's origin; the provider receives server-side requests. No cookies, local storage, analytics, external fonts or third-party scripts are loaded. Normal hosting/provider logs may still apply. The Worker sets nonce-based CSP, `nosniff` and `no-referrer`; validated numeric/hexadecimal upstream values are used in generated HTML.

[AGPL-3.0-only](LICENSE), matching the reused Price shell. The standalone page links to this source repository. If modifying and serving the app, retain an appropriate source offer for the version served. The blockdyor logo/branding is not a grant of trademark rights.
