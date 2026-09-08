# ResMap mobile rendering regression checklist

Target device class: iPhone Safari, including iOS 16 compatibility.

The production regression represented by the supplied user screenshot was a full-screen ResMap shell whose controls rendered while the spatial canvas remained blank. The rendering bootstrap now treats the map canvas as a critical surface rather than depending on a single floating CDN build/stylesheet.

## Required checks

- Map canvas occupies the full ResMap content viewport beneath the 64px header.
- MapLibre canvas CSS is available even before/without the external stylesheet.
- Orientation and Safari VisualViewport changes trigger `map.resize()`.
- iOS 16 uses the compatibility MapLibre runtime.
- Modern WebGL2 clients use the pinned modern runtime.
- Closing and reopening ResMap can retry after a transient script/CDN failure.
- 2D/3D toggle does not destroy the base map.
- Campus/residence overlays remain driven by the existing live GeoJSON sources after the base map initializes.

This checklist is part of Release 5 Gate 2 and must stay satisfied by future ResMap changes.
