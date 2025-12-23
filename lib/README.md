# Library utilities

The `lib` folder centralizes business logic and helpers that back the canvas and 3D preview.

## State management
- `store.ts` – Zustand store defining document state, selection, zoom, panel visibility, and document manipulation actions.
- `previewStore.ts` – Lightweight store for the 3D preview to track loading status and selected materials.
- `randomId.ts` – Helper for generating unique IDs when creating new nodes.

## Geometry and layout
- `boxLayoutConfig.ts` – Configuration for the packaging dieline dimensions, panels, and fold areas used by both the 2D canvas and 3D preview.
- `dieline.ts` – Helpers for mapping canvas coordinates to dieline faces and constructing shapes that match the box layout.

## Rendering helpers
- `texture.ts` – Utilities for creating and applying textures from canvas snapshots to Three.js materials.
- `text.ts` – Functions for managing text nodes, sizing, and styling within the Konva canvas.
