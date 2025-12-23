"use client";

import { MAX_ZOOM, MIN_ZOOM, useDocumentStore } from "@/lib/store";

const secondaryButtonStyles =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300";

const iconButtonStyles =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-lg shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300";

export default function TopBar() {
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);
  const zoomIn = useDocumentStore((state) => state.zoomIn);
  const zoomOut = useDocumentStore((state) => state.zoomOut);
  const rotateLeft = useDocumentStore((state) => state.rotateCanvasLeft);
  const rotateRight = useDocumentStore((state) => state.rotateCanvasRight);
  const canUndo = useDocumentStore((state) => state.past.length > 0);
  const canRedo = useDocumentStore((state) => state.future.length > 0);
  const zoom = useDocumentStore((state) => state.zoom);
  const canZoomIn = zoom < MAX_ZOOM - 1e-6;
  const canZoomOut = zoom > MIN_ZOOM + 1e-6;
  const isPrintPreview = useDocumentStore((state) => state.isPrintPreview);
  const togglePrintPreview = useDocumentStore(
    (state) => state.togglePrintPreview,
  );
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-sm font-semibold uppercase text-white"
        >
          CL
        </span>
        <div className="flex flex-col">
          <span className="text-base font-semibold text-slate-900">CloudLabs</span>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Personalization Studio
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <button
          type="button"
          className={iconButtonStyles}
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <span aria-hidden>↺</span>
        </button>
        <button
          type="button"
          className={iconButtonStyles}
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <span aria-hidden>↻</span>
        </button>
        <div aria-hidden className="mx-1 h-6 w-px bg-slate-200" />
        <button
          type="button"
          className={iconButtonStyles}
          onClick={zoomOut}
          disabled={!canZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <span aria-hidden>−</span>
        </button>
        <button
          type="button"
          className={iconButtonStyles}
          onClick={zoomIn}
          disabled={!canZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <span aria-hidden>+</span>
        </button>
        <button
          type="button"
          className={iconButtonStyles}
          onClick={rotateLeft}
          aria-label="Rotate left"
          title="Rotate left"
        >
          <span aria-hidden>⟲</span>
        </button>
        <button
          type="button"
          className={iconButtonStyles}
          onClick={rotateRight}
          aria-label="Rotate right"
          title="Rotate right"
        >
          <span aria-hidden>⟳</span>
        </button>
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButtonStyles}
              title="Save project"
            >
              Save Project
            </button>
            <button
              type="button"
              className={secondaryButtonStyles}
              title="Load project"
            >
              Load Project
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={togglePrintPreview}
          aria-pressed={isPrintPreview}
          className={
            "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2" +
            (isPrintPreview
              ? " bg-emerald-600 shadow-lg shadow-emerald-500/30 hover:bg-emerald-500"
              : " bg-emerald-500 hover:bg-emerald-400")
          }
        >
          {isPrintPreview ? "Exit preview" : "Ready to print"}
        </button>
      </div>
    </header>
  );
}
