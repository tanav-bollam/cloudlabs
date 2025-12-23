# CloudLabs Personalizer

CloudLabs Personalizer is a Next.js application that lets users design custom packaging with a real-time 2D canvas and a synchronized 3D preview. The experience combines Konva-driven editing tools, Three.js rendering, and a responsive layout so teams can quickly prototype dielines, apply artwork, and export projects.

## Project goals
- Provide an intuitive canvas for placing PDFs, images, shapes, and text on a box layout.
- Keep 2D edits in sync with a 3D preview for spatial validation.
- Support collaboration-friendly workflows with project save/load, zooming, rotation, and fine-grained property controls.

## Getting started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the development server**
   ```bash
   npm run dev
   ```
   The app starts at `http://localhost:3000`.
3. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Application structure
- `app/` – Next.js App Router entry point. Defines global layout, metadata, styles, and routes. The home page redirects to `/personalize`, which hosts the editor experience.
- `components/` – Reusable UI and canvas/preview building blocks such as the toolbar, canvas stage, selection tools, 3D preview, and modal pickers.
- `lib/` – Editor domain logic: document store, dieline/texture utilities, layout configuration, and random ID helpers.
- `types/` – Shared TypeScript types for shapes, text, textures, and document state.
- `public/` – Static assets available at runtime.
- `tailwind.config.ts` and `postcss.config.mjs` – Styling configuration for the Tailwind-driven UI.

## Editor workflow overview
1. **Navigate to `/personalize`** to open the canvas workspace.
2. **Use the left toolbar** to import PDFs, add images, shapes, or text, manage blocks, and perform zoom/rotation actions. The toolbar can expand for wider labels and shows contextual popovers for panel content.
3. **Interact with the canvas** (Konva-powered) to place, select, and transform elements. Zoom controls and selection properties are synced with the document store.
4. **Inspect the right-hand 3D panel** to view a real-time Three.js preview of the dieline with applied artwork, aiding spatial validation.
5. **Adjust properties** via the bottom panel when an element is selected—fine-tune position, rotation, size, and other attributes.
6. **Save or load projects** using the project panel to persist or restore design sessions.

## Key technologies
- **Next.js 14** with the App Router for routing, metadata, and server/client component composition.
- **React 18** for declarative UI and component-driven state management.
- **Tailwind CSS** for consistent styling and layout primitives.
- **Konva / react-konva** for the 2D editing surface and selection tooling.
- **Three.js / @react-three/fiber / @react-three/drei** for the interactive 3D preview.
- **Zustand** for the shared document store that keeps the canvas, toolbar, properties panel, and preview in sync.

## Development tips
- Client-only components (e.g., canvas and 3D preview) use dynamic imports with `ssr: false` to avoid server-side rendering issues.
- The document store in `lib/store.ts` centralizes actions such as zooming, rotating selections, toggling panels, and managing document nodes.
- Styling lives primarily in `app/globals.css` and Tailwind utility classes within components for predictable, responsive layouts.
