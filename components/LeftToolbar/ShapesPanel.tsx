"use client";

import { DragEvent, useCallback } from "react";

import { createRandomId } from "@/lib/randomId";
import { DocumentNode, useDocumentStore } from "@/lib/store";

export const SHAPE_DRAG_DATA_TYPE = "application/x-cloudlabs-shape";

const SHAPE_BASE_SIZE = 100;
const DEFAULT_SHAPE_POSITION = 120;

type ShapeNode = Extract<DocumentNode, { type: "shape" }>;

type ShapeDefinition = {
  id: string;
  label: string;
  path: string;
  fillRule?: CanvasFillRule;
};

const SHAPES: ShapeDefinition[] = [
  {
    id: "circle",
    label: "Circle",
    path: "M50 10a40 40 0 1 1 0 80a40 40 0 1 1 0-80Z",
  },
  {
    id: "square",
    label: "Square",
    path: "M16 16h68v68H16Z",
  },
  {
    id: "triangle",
    label: "Triangle",
    path: "M50 14L88 86H12Z",
  },
  {
    id: "heart",
    label: "Heart",
    path: "M50 84L22 56C12 46 12 30 22 20s28-12 34 6c6-18 26-18 34-6s10 26 0 36Z",
  },
  {
    id: "star",
    label: "Star",
    path: "M50 10l11.9 24.1 26.6 3.9-19.2 18.7 4.5 26.3L50 72.6 26.2 83l4.5-26.3-19.2-18.7 26.6-3.9Z",
  },
  {
    id: "cross",
    label: "Cross",
    path: "M42 14h16v28h28v16H58v28H42V58H14V42h28Z",
  },
  {
    id: "instagram",
    label: "Instagram",
    path: "M70 14H30a16 16 0 0 0-16 16v40a16 16 0 0 0 16 16h40a16 16 0 0 0 16-16V30A16 16 0 0 0 70 14ZM76 26a6 6 0 1 1-6 6 6 6 0 0 1 6-6ZM50 32a18 18 0 1 1-18 18 18 18 0 0 1 18-18Zm0 28a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z",
    fillRule: "evenodd",
  },
  {
    id: "tiktok",
    label: "TikTok",
    path: "M56 20h12v16h12v16H68v28H56ZM36 72a14 14 0 1 1 28 0a14 14 0 1 1-28 0Z",
  },
  {
    id: "facebook",
    label: "Facebook",
    path: "M58 16h16v18H66c-4 0-6 2-6 6v8h14l-2 16H60v26H44V64h-10V48h10V34c0-12 7-18 14-18Z",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    path: "M50 14c-18 0-32 14-32 32 0 12 7 22 17 28l-5 20 13-13c2 .4 4 .6 7 .6 18 0 32-14 32-32S68 14 50 14Zm0 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18Z",
    fillRule: "evenodd",
  },
];

export default function ShapesPanel() {
  const addNode = useDocumentStore((state) => state.addNode);
  const setSelection = useDocumentStore((state) => state.setSelection);

  const handleAddShape = useCallback(
    (shape: ShapeDefinition) => {
      const node: ShapeNode = {
        id: createRandomId(),
        type: "shape",
        data: {
          path: shape.path,
          fill: "#000000",
          fillRule: shape.fillRule,
          x: DEFAULT_SHAPE_POSITION - SHAPE_BASE_SIZE / 2,
          y: DEFAULT_SHAPE_POSITION - SHAPE_BASE_SIZE / 2,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
      };

      addNode(node);
      setSelection([node.id]);
    },
    [addNode, setSelection],
  );

  const handleDragStart = useCallback((shape: ShapeDefinition, event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    const payload = {
      path: shape.path,
      fill: "#000000",
      fillRule: shape.fillRule,
    };
    event.dataTransfer.setData(SHAPE_DRAG_DATA_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", shape.label);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-600">
        <h3 className="font-semibold text-slate-800">Shapes &amp; Icons</h3>
        <p className="text-xs text-slate-400">
          Click to add or drag onto the canvas. Shapes default to a black fill.
        </p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {SHAPES.map((shape) => (
          <button
            key={shape.id}
            type="button"
            className="group flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => handleAddShape(shape)}
            draggable
            onDragStart={(event) => handleDragStart(shape, event)}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-900 transition group-hover:border-blue-300 group-hover:text-blue-700">
              <svg viewBox="0 0 100 100" className="h-12 w-12 fill-current" aria-hidden="true">
                <path d={shape.path} fillRule={shape.fillRule ?? "nonzero"} />
              </svg>
            </span>
            <span className="truncate">{shape.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
