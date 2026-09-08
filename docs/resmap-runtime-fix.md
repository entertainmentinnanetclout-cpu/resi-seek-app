# ResMap runtime fix

The blank iPhone Safari map regression is addressed in `src/lib/resmap/maplibre.ts` by a pinned compatibility-aware MapLibre loader, critical local layout CSS, dual-CDN fallbacks, and repeated viewport resize synchronization.
