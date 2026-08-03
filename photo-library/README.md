# Photo library

Optimized photos that no site page currently references.

They live here rather than in `src/assets/images/` because that folder is glob-imported
by `SmartImage`, so everything in it is emitted into `dist/` on every build — whether a
page uses it or not. Keeping the unused ~14 MB here keeps it out of the deploy while
leaving the images one `git mv` away.

These have already been through `scripts/optimize-images.mjs` (longest edge capped at
2560px, progressive mozjpeg), so no reprocessing is needed.

## Using one

```sh
git mv photo-library/lakehouse-property/lakehouse-35.jpg src/assets/images/lakehouse-property/
```

Then reference it: `<SmartImage src="lakehouse-property/lakehouse-35.jpg" alt="..." />`

## Note

`wicklow-house/wicklowhouse-1.jpg`, `-2` and `-3` are byte-identical duplicates of
`wicklow-01/02/03.jpg` in `src/assets/images/`. They can be deleted outright.

The full-resolution camera originals for everything here remain in git history at
commit `c92bb6f` under `public/Images/`.
