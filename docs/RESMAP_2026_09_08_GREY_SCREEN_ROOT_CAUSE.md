# ResMap grey-screen root cause — 2026-09-08

## Root cause
The configured CARTO raster URL was being used without the API key CARTO now requires for direct basemap access. In the old stacked-raster style, the provider's key-required/error output could cover the fallback source and leave users with a grey map canvas.

## Production fix
- Use OpenStreetMap Standard as the immediate no-key primary basemap.
- Retry failed tile images against the HOT OpenStreetMap fallback.
- Render the street map with ResKonnect's browser-native slippy-map engine instead of depending on MapLibre/WebGL/CDN runtime initialization.
- Keep accommodation pins, campus positions, current location, route geometry and filters driven by Supabase coordinates.
- Use Google Maps Photorealistic 3D only when a restricted browser key is explicitly configured.

## Digital twin accuracy rule
A generated box or inferred building mass is not a digital twin. ResKonnect now publishes a residence digital twin only when a model URL exists and the model has been verified. Procedural placeholder twins are unpublished. Until a verified model exists, the immersive page shows the real residence exterior reference and labels the 3D twin as pending.
