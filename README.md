# Septimius Properties

Marketing site for Septimius Properties, built with [Astro](https://astro.build) and
Tailwind CSS. Deployed on Vercel at <https://septimiusproperties.com>.

## Project structure

```text
/
├── public/                  # served verbatim, NOT optimized - SVG and og-image only
├── scripts/
│   └── optimize-images.mjs  # downscales new photos into src/assets/images/
├── src/
│   ├── assets/images/       # photo library, processed at build time
│   ├── components/
│   │   └── SmartImage.astro # responsive AVIF/WebP wrapper - use this for photos
│   ├── layouts/
│   └── pages/               # every .astro file here becomes a route
└── astro.config.mjs
```

## Commands

Run from the project root:

| Command                            | Action                                       |
| :--------------------------------- | :------------------------------------------- |
| `npm install`                      | Install dependencies                         |
| `npm run dev`                      | Dev server at `localhost:4321`               |
| `npm run build`                    | Production build to `./dist/`                |
| `npm run preview`                  | Serve the production build locally           |
| `npm run images:optimize -- <dir>` | Optimize a folder of new photos              |

## Working with images

**Photos belong in `src/assets/images/`, never in `public/`.** Anything in `public/`
is copied to the deploy byte-for-byte: no resizing, no AVIF/WebP, no `width`/`height`,
no lazy loading. The site previously shipped 24-megapixel camera originals this way and
the home page weighed 14.6 MB.

Adding new photos:

1. Drop the originals in a scratch folder, e.g. `photos-incoming/`.
2. Run `npm run images:optimize -- ./photos-incoming`. It caps the longest edge at
   2560px, re-encodes as progressive mozjpeg, converts opaque PNGs to JPEG, and
   kebab-cases the filenames into `src/assets/images/`.
3. Delete the scratch folder and reference the result:

```astro
---
import SmartImage from '../components/SmartImage.astro';
---

<SmartImage
  src="lakehouse-property/lakehouse-30.jpg"
  alt="Lakeside frontage at dusk"
  sizes="(min-width: 1024px) 33vw, 100vw"
  class="w-full h-64 object-cover"
/>
```

`SmartImage` emits a `<picture>` with AVIF, WebP and JPEG sources at several widths,
plus `width`/`height` (which prevents layout shift) and `loading="lazy"`.

- `sizes` should describe how wide the image renders at each breakpoint. Getting it
  wrong means the browser downloads a larger file than it needs.
- Add `priority` to the one above-the-fold image that is the largest thing on screen.
  It switches to eager loading with `fetchpriority="high"`. Using it on more than one
  image per page makes them compete and slows the largest paint down.
- Decorative images (backgrounds behind text) take `alt=""`.

A build error naming an unknown path means the file is not in `src/assets/images/` -
check the name, and remember the optimizer lower-cases it.
