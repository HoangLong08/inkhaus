# Scripts

None of these run during `next build`. They need a real Chrome on the machine,
which the Vercel build container does not have — `puppeteer-core` is a
devDependency and must stay out of the build path.

| Script | What it does |
| --- | --- |
| `crawl-etsy.mjs` | Pulls product photography off an Etsy shop into `public/products/` |
| `sync-product-images.mjs` | Turns the files in `public/products/` into `packages/shared/src/product-images.ts` |
| `gen-pwa-assets.mjs` | Renders the PWA icon set (and, with `--screenshots`, the install-dialog shots) |
| `verify-cart.mjs` | Drives a real browser through add-to-cart, pricing, merging, checkout |
| `verify-cart-recovery.mjs` | Same, for the design-parked-while-the-API-is-down path |
| `verify-pwa.mjs` | Service worker, offline page, manifest |

---

## Getting product photography in

The storefront works with **no photographs at all** — every blank falls back to
the SVG in `Garment.tsx`. Photography is additive, and adding it is always the
same two steps:

1. get correctly named files into `public/products/<slug>/`
2. run `npm run images:sync -w @inkhaus/web` and rebuild the shared package

### The filename is the metadata

```
public/products/<slug>/<nn>-<colorkey|any>[@2x].<jpg|png|webp>
```

```
public/products/heavyweight-tee/01-black.jpg      first shot, the black colourway
public/products/heavyweight-tee/01-black@2x.jpg   optional lightbox master
public/products/heavyweight-tee/02-bone.jpg       second shot, the bone colourway
public/products/heavyweight-tee/03-any.jpg        detail shot, shown for every colour
```

`<nn>` orders the gallery. `<colorkey>` must be a key of `COLORS` in
`packages/shared/src/catalog.ts` (`white black bone sand forest navy maroon acid
flame slate butter sky`) **that the product actually stocks**, or the literal
`any`. `sync-product-images.mjs` refuses to generate anything if a name is wrong
— a misnamed file is a silently missing photo, so it fails the run instead.

There is no JSON to edit. The generated catalog is derived entirely from what is
on disk, so dragging a correctly named file into the folder is a complete
workflow on its own.

---

## Route 1 — the crawler (`npm run crawl:etsy -w @inkhaus/web`)

Etsy fronts every page with **DataDome**. A plain HTTP client gets `403`, and so
does headless Chrome — verified, including `curl` with a browser User-Agent.
What DataDome serves instead is a *slide-to-verify* puzzle, and a human can
answer it. So the crawler drives the real Chrome already installed on the
machine, in a visible window, against a **persistent profile** so the answer
survives between runs.

Note that `i.etsystatic.com` — the image CDN — is **not** blocked. Only the HTML
pages are. That matters for route 2.

```bash
cd apps/web

# 1. find the listings. A Chrome window opens; slide the bar when it appears,
#    then press Enter back in the terminal.
npm run crawl:etsy -- --headful --discover

# 2. read each listing's gallery
npm run crawl:etsy -- --headful --fetch

# 3. download. Look at what you got before mapping it.
npm run crawl:etsy -- --download

# 4. print a mapping scaffold, since nothing is placed by guesswork
npm run crawl:etsy -- --apply
```

Step 4 prints a JSON skeleton because **which Etsy listing is which INKHAUS
blank, and which colourway each photo shows, is a judgement about the
photographs**. Paste it into `apps/web/data/etsy-map.json`, fill in the real
slugs and colour keys, and re-run `--apply`. It validates every entry — an
unknown slug or a colourway the product does not stock is an error, not a
warning.

```jsonc
{
  "1512345678": {
    "_title": "Heavyweight Cotton Tee — Unisex",
    "slug": "heavyweight-tee",
    "images": [
      { "from": "0.jpg", "as": "01-black" },
      { "from": "1.jpg", "as": "02-bone" },
      { "from": "3.jpg", "as": "03-any" }
    ]
  }
}
```

Then:

```bash
npm run images:sync -w @inkhaus/web
npm run build:shared
```

Useful flags: `--dry-run` (writes nothing), `--limit N`, `--max-images N`,
`--delay MS` (default 1500 with jitter — the crawler is strictly sequential on
one tab and there is deliberately no concurrency knob), `--force`,
`--max-bytes N`.

## Route 2 — your own browser (no bot challenge at all)

Etsy loads normally in the browser you use every day. Since the image CDN is not
blocked, the only thing that has to come out of that browser is the list of
image URLs.

Open your shop, open DevTools → Console, and run:

```js
copy(JSON.stringify(Object.fromEntries(
  [...document.querySelectorAll('a[href*="/listing/"]')]
    .map(a => a.href.match(/\/listing\/(\d+)/)?.[1]).filter(Boolean)
    .filter((v, i, s) => s.indexOf(v) === i)
    .map(id => [id, { id, title: "", url: `https://www.etsy.com/listing/${id}/`, images: [] }])
), null, 2))
```

That copies a skeleton manifest. Open each listing, and on the listing page run:

```js
copy(JSON.stringify([...new Set(
  [...document.querySelectorAll('img[src*="i.etsystatic.com"]')].map(i => i.src)
)].slice(0, 5).map((url, index) => ({
  index, url: url.replace(/\/il_[^/]*?(\d+x[N\d]+)/, '/il_794xN'),
  url2x: index === 0 ? url.replace(/\/il_[^/]*?(\d+x[N\d]+)/, '/il_1588xN') : null
})), null, 2))
```

Paste those arrays into the `images` field of the matching listing in
`apps/web/data/etsy-manifest.json`, then run `--download` and `--apply` as
above. Both read that file from disk and neither needs to load an Etsy page.

## Route 3 — drop the files in by hand

Save the images however you like, name them by the convention above, drop them
into `public/products/<slug>/`, and run `npm run images:sync -w @inkhaus/web`.
Nothing else is involved.
