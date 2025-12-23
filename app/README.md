# App directory

This folder houses the Next.js App Router setup for CloudLabs Personalizer.

## Key files
- `layout.tsx` – Defines the global HTML structure, metadata, and shared styles. It also injects the Line Awesome icon font used across the toolbar.
- `globals.css` – Tailwind-powered global styles for typography, layout scaffolding, and utility overrides.
- `page.tsx` – Redirects the root route to `/personalize`, ensuring the editor is the primary entry point.

## Personalize route
- **Path**: `/personalize`
- **Main component**: `app/personalize/page.tsx`
- **Layout**: A two-row grid with a top bar and a flexible content area that adapts between two- and three-column layouts depending on viewport size.
- **Child pieces**:
  - `TopBar` – Displays brand context, view actions, and workspace-level controls.
  - `LeftToolbar` – Offers panels for PDFs, images, shapes, text, blocks, project management, and view controls (zoom, rotate, properties).
  - `ClientCanvas` – Client-only wrapper that renders the Konva canvas stage where users place and transform design elements.
  - `RightPanel3D` – Shows a synchronized 3D preview of the dieline with applied artwork.
  - `PropertiesPanel` – Surfaces contextual controls for the currently selected canvas item.

## Rendering strategy
- The route is marked as a client component (`"use client"`) because it orchestrates interactive child components that rely on browser APIs.
- Expensive or browser-only pieces (canvas stage and 3D preview) are dynamically imported with `ssr: false` in their respective wrappers to avoid server-side rendering issues.

## Layout behavior
- Uses Tailwind utility classes to manage responsive grids, spacing, and background colors.
- The layout preserves full-height behavior (`min-h-screen`) so the canvas and preview fill the viewport.
