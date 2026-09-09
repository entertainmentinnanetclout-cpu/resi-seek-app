# ResKonnect 360 Studio V2 — Release Gates 1 & 2

Release Gate 1 covers phases 0–3: isolated architecture, storage/RLS, God Mode workspace, guided mobile capture and offline recovery.

Release Gate 2 covers phases 4–6: 4K panorama delivery, scene quality engine, graph/hotspot Tour Builder, immutable versioned publishing and the public multi-scene viewer.

Runtime architecture:

- Frontend editing operations use the RLS/RPC direct runtime in `src/lib/virtualTours/api.ts`.
- The retired `virtual-tour-api` Edge Function is intentionally not part of the release.
- `virtual-tour-processor` remains an internal/service-role processing boundary for server-side QA and future professional stitching workers.
- Raw capture and master assets remain private; public delivery and thumbnails are publication assets only.
- Premium/Gold residence access is entitlement-based. Final publication is God Mode only.
- Existing legacy 360 tours and ResMap remain supported; V2 is additive.

Production closure requires green TypeScript, production build, link/SEO QA, dependency security, AdminOS release gate, Supabase advisor review, merge to `main`, and a READY `reskonnect-hub` deployment matching the exact merge SHA.
