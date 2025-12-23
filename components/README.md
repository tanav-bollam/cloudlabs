# Components directory

This folder contains reusable UI elements and client-only modules that power the personalization experience.

## Core canvas components
- `CanvasStage.tsx` / `CanvasStageClient.tsx` – The Konva-powered stage that renders pages, shapes, text, and images. The `Client` wrapper lazy-loads the stage on the client to avoid SSR issues.
- `SelectionToolbar.tsx` – Inline controls that appear when items are selected, offering quick actions like alignment and layering.
- `PdfPagePickerModal.tsx` – Modal for selecting specific pages from uploaded PDFs to place on the canvas.

## Surrounding panels
- `LeftToolbar/` – Sidebar with contextual panels:
  - `PdfPanel`, `ImagePanel`, `ShapesPanel`, `TextPanel` for importing assets and primitives.
  - `BlocksPanel` (via `PanelKey "blocks"`) for grouping and managing reusable blocks.
  - Project and “More” panels for persistence and auxiliary tools.
  - Toolbar actions for zooming, rotating selections, and opening the properties panel.
- `PropertiesPanel.tsx` – Displays contextual controls for the active selection (position, rotation, sizing, styling).
- `RightPanel3D.tsx` / `RightPanel3DClient.tsx` – Three.js preview panel showing the dieline with applied textures. Uses dynamic import to keep rendering client-only.
- `TopBar.tsx` – Workspace header with brand context and session-level actions.

## Interaction notes
- Many components subscribe to the shared document store in `lib/store.ts` to keep selection, zoom, and panel state synchronized across the UI.
- Styling relies on Tailwind utility classes for layout, spacing, and focus states, keeping components predictable and responsive.
