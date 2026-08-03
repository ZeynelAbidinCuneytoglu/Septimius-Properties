// Downscales and re-encodes camera-resolution photos into src/assets/images/,
// where Astro's build pipeline turns them into responsive AVIF/WebP sets.
//
// Run this on any new batch of photos before committing them. Straight-from-
// the-camera files here are 24-26 megapixels (6240x4160); nothing on the site
// renders wider than a full-bleed hero, so MAX_EDGE is all a 2x display can
// use, and shipping the originals cost ~80x more bytes than necessary.
//
//   npm run images:optimize -- ./incoming    # optimize a drop folder
//   npm run images:optimize -- ./incoming --dry
//
// Output mirrors the input tree, kebab-cased, with opaque PNGs turned into
// JPEG. Files are never written back larger than they arrived.
//
import sharp from 'sharp';
import { readdir, stat, mkdir, copyFile, writeFile } from 'fs/promises';
import { join, extname, relative, dirname, sep, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const SRC_DIR = inputArg ? resolve(inputArg) : join(ROOT, 'photos-incoming');
const OUT_DIR = join(ROOT, 'src', 'assets', 'images');

const MAX_EDGE = 2560; // longest side, in px
const JPEG_QUALITY = 82;
const DRY = process.argv.includes('--dry');

const mb = (b) => (b / 1048576).toFixed(2);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

// Spaces in asset filenames force URL-encoding and break the odd hand-written
// reference, so the optimized tree is kebab-cased throughout.
const slug = (s) => s.toLowerCase().replace(/[_\s]+/g, '-').replace(/-+/g, '-');
const slugPath = (rel) => rel.split(sep).map(slug).join('/');

async function main() {
  let files;
  try {
    files = (await walk(SRC_DIR)).filter(f => /\.(jpe?g|png|avif|webp)$/i.test(f));
  } catch {
    console.error(
      `\nNo such folder: ${SRC_DIR}\n\n` +
      `Pass the folder holding the new photos:\n` +
      `  npm run images:optimize -- ./path/to/photos\n`
    );
    process.exit(1);
  }
  if (files.length === 0) {
    console.log(`\nNo images found in ${SRC_DIR}\n`);
    return;
  }
  console.log(`\nOptimizing ${files.length} images from ${SRC_DIR}`);
  console.log(`  -> ${OUT_DIR}  (max edge ${MAX_EDGE}px, jpeg q${JPEG_QUALITY})${DRY ? '  [DRY RUN]' : ''}\n`);

  let before = 0, after = 0;

  for (const file of files.sort()) {
    const rel = relative(SRC_DIR, file);
    const sizeBefore = (await stat(file)).size;
    before += sizeBefore;

    const image = sharp(file, { limitInputPixels: false });
    const meta = await image.metadata();
    const ext = extname(rel).toLowerCase();

    // Photographs saved as PNG cost 5-10x what the same pixels cost as JPEG.
    // An alpha *channel* is not the same as actual transparency - these files
    // all carry a fully-opaque one - so ask sharp what the pixels really are.
    let opaque = true;
    if (meta.hasAlpha) {
      try { opaque = (await sharp(file, { limitInputPixels: false }).stats()).isOpaque; }
      catch { opaque = false; }
    }
    const toJpeg = ext === '.png' ? opaque : ext !== '.avif' && ext !== '.webp';

    let outRel = slugPath(rel);
    if (toJpeg) outRel = outRel.replace(/\.(png|jpe?g)$/i, '.jpg');

    const outPath = join(OUT_DIR, outRel.split('/').join(sep));
    const needsResize = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE;

    if (!DRY) await mkdir(dirname(outPath), { recursive: true });

    let sizeAfter;
    if (ext === '.avif' || ext === '.webp') {
      // Already in a modern format and small; pass through untouched.
      if (!DRY) await copyFile(file, outPath);
      sizeAfter = sizeBefore;
    } else {
      let pipeline = image;
      if (needsResize) pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
      pipeline = pipeline.rotate(); // honour EXIF orientation before stripping it
      pipeline = toJpeg
        ? pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
        : pipeline.png({ compressionLevel: 9, effort: 10, palette: true });
      const buf = await pipeline.toBuffer();

      // Some sources are already tuned tighter than a blind re-encode. When we
      // did not resize, the original is strictly better - same pixels, fewer
      // bytes - so keep it rather than shipping a file back bigger.
      const keepOriginal = buf.length >= sizeBefore && !needsResize && outRel === slugPath(rel);
      if (keepOriginal) {
        if (!DRY) await copyFile(file, outPath);
        sizeAfter = sizeBefore;
      } else {
        if (!DRY) await writeFile(outPath, buf);
        sizeAfter = buf.length;
      }
    }

    after += sizeAfter;

    const pct = ((1 - sizeAfter / sizeBefore) * 100).toFixed(0);
    console.log(
      `  ${mb(sizeBefore).padStart(7)} MB -> ${mb(sizeAfter).padStart(7)} MB  ${String(pct).padStart(3)}%  ` +
      `${meta.width}x${meta.height}${needsResize ? ` -> max ${MAX_EDGE}` : ''}  ${outRel}`
    );
  }

  console.log(`\n  TOTAL  ${mb(before)} MB -> ${mb(after)} MB   (${((1 - after / before) * 100).toFixed(1)}% smaller)\n`);
  console.log(`  Reference them from pages as <SmartImage src="<path under src/assets/images>" ... />\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
