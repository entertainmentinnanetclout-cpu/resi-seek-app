# ResMap grey-screen + digital twin accuracy release

- Replaces the WebGL/CDN-dependent public ResMap path with a browser-native slippy map for street tiles, accommodation pins, campus positions, route geometry, panning, wheel zoom and touch/pinch interaction.
- Detects keyless CARTO raster configuration and refuses to use it as a basemap.
- Uses OpenStreetMap Standard with HOT fallback for the immediate no-key public map.
- Keeps Google Maps Photorealistic 3D as the only 3D map mode when a restricted browser key is configured.
- Removes generic procedural building boxes from the digital-twin experience.
- Publishes digital twins only when a residence-specific 3D model exists and has been verified.
