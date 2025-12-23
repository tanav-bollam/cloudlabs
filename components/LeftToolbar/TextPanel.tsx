"use client";

import { ChangeEvent, DragEvent, useCallback, useMemo } from "react";

import { createRandomId } from "@/lib/randomId";
import {
  DocumentNode,
  TextFontWeight,
  TextNodeData,
  isTextNode,
  useDocumentStore,
} from "@/lib/store";
import { withUpdatedTextMetrics } from "@/lib/text";

const DEFAULT_TEXT_COLOR = "#111827";
const DEFAULT_TEXT_POSITION = 180;

const FONT_FAMILIES = [
  "Inter",
  "Montserrat",
  "Playfair Display",
  "Space Grotesk",
  "Lora",
];

const FONT_WEIGHTS: { label: string; value: TextFontWeight }[] = [
  { label: "Regular (400)", value: "400" },
  { label: "Semi-bold (600)", value: "600" },
  { label: "Bold (700)", value: "700" },
];

type TextDocumentNode = Extract<DocumentNode, { type: "text" }>;

type TextPreset = {
  id: string;
  label: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: TextFontWeight;
  letterSpacing?: number;
  fill?: string;
  isCurved?: boolean;
  radius?: number;
  angle?: number;
};

const TEXT_PRESETS: TextPreset[] = [
  {
    id: "headline",
    label: "Headline",
    text: "Add a bold headline",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: "700",
  },
  {
    id: "subheading",
    label: "Subheading",
    text: "Subheading text",
    fontFamily: "Montserrat",
    fontSize: 28,
    fontWeight: "600",
  },
  {
    id: "body",
    label: "Body copy",
    text: "Start typing your message",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "400",
  },
  {
    id: "curve",
    label: "Curved accent",
    text: "Curved text",
    fontFamily: "Playfair Display",
    fontSize: 24,
    fontWeight: "700",
    isCurved: true,
    radius: 180,
    angle: 180,
    letterSpacing: 4,
  },
];

export default function TextPanel() {
  const addNode = useDocumentStore((state) => state.addNode);
  const setSelection = useDocumentStore((state) => state.setSelection);
  const nodes = useDocumentStore((state) => state.nodes);
  const selection = useDocumentStore((state) => state.selection);
  const setNodes = useDocumentStore((state) => state.setNodes);

  const selectedTextNode = useMemo(() => {
    const selectedId = selection[0];
    if (!selectedId) {
      return null;
    }

    const node = nodes.find((item) => item.id === selectedId);
    if (!node || !isTextNode(node)) {
      return null;
    }

    return node;
  }, [nodes, selection]);

  const handleAddPreset = useCallback(
    (preset: TextPreset) => {
      const baseData: TextNodeData = {
        text: preset.text,
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        fill: preset.fill ?? DEFAULT_TEXT_COLOR,
        letterSpacing: preset.letterSpacing ?? 0,
        isCurved: preset.isCurved ?? false,
        radius: preset.radius ?? 180,
        angle: preset.angle ?? 0,
        x: DEFAULT_TEXT_POSITION,
        y: DEFAULT_TEXT_POSITION,
        rotation: 0,
        width: 0,
        height: 0,
        opacity: 1,
        lockAspectRatio: false,
      };

      const dataWithMetrics = withUpdatedTextMetrics(baseData, {});

      const node: TextDocumentNode = {
        id: createRandomId(),
        type: "text",
        data: dataWithMetrics,
      };

      addNode(node);
      setSelection([node.id]);
    },
    [addNode, setSelection],
  );

  const handleDragStart = useCallback((preset: TextPreset, event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    const previewText = preset.text || preset.label;
    event.dataTransfer.setData("text/plain", previewText);
  }, []);

  const handlePropertyChange = useCallback(
    (updates: Partial<TextNodeData>) => {
      if (!selectedTextNode) {
        return;
      }

      const updatedNodes = nodes.map((node) => {
        if (!isTextNode(node) || node.id !== selectedTextNode.id) {
          return node;
        }

        return {
          ...node,
          data: withUpdatedTextMetrics(node.data, updates),
        };
      });

      setNodes(updatedNodes);
    },
    [nodes, selectedTextNode, setNodes],
  );

  const handleFontFamilyChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      handlePropertyChange({ fontFamily: event.target.value });
    },
    [handlePropertyChange],
  );

  const handleFontSizeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        handlePropertyChange({ fontSize: Math.max(4, value) });
      }
    },
    [handlePropertyChange],
  );

  const handleFontWeightChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      handlePropertyChange({ fontWeight: event.target.value as TextFontWeight });
    },
    [handlePropertyChange],
  );

  const handleColorChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handlePropertyChange({ fill: event.target.value });
    },
    [handlePropertyChange],
  );

  const handleLetterSpacingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        handlePropertyChange({ letterSpacing: value });
      }
    },
    [handlePropertyChange],
  );

  const handleCurvedToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextIsCurved = event.target.checked;
      if (!selectedTextNode) {
        return;
      }

      handlePropertyChange({
        isCurved: nextIsCurved,
        radius: nextIsCurved ? selectedTextNode.data.radius || 180 : selectedTextNode.data.radius,
        angle: nextIsCurved ? (selectedTextNode.data.angle || 180) : selectedTextNode.data.angle,
      });
    },
    [handlePropertyChange, selectedTextNode],
  );

  const handleRadiusChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        handlePropertyChange({ radius: Math.max(10, value) });
      }
    },
    [handlePropertyChange],
  );

  const handleAngleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isFinite(value)) {
        handlePropertyChange({ angle: value });
      }
    },
    [handlePropertyChange],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-slate-600">
        <h3 className="font-semibold text-slate-800">Text presets</h3>
        <p className="text-xs text-slate-400">
          Click to add a preset or drag onto the canvas. Double click text on the canvas to edit the copy inline.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-medium text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => handleAddPreset(preset)}
            draggable
            onDragStart={(event) => handleDragStart(preset, event)}
          >
            <span className="flex h-16 w-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-900 transition group-hover:border-blue-300 group-hover:text-blue-700">
              {preset.text}
            </span>
            <span className="truncate text-[11px] uppercase tracking-wide text-slate-400">
              {preset.label}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-800">Properties</h3>
        {selectedTextNode ? (
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Font family
              </span>
              <select
                value={selectedTextNode.data.fontFamily}
                onChange={handleFontFamilyChange}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Size
                </span>
                <input
                  type="number"
                  value={selectedTextNode.data.fontSize}
                  min={4}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onChange={handleFontSizeChange}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Weight
                </span>
                <select
                  value={selectedTextNode.data.fontWeight}
                  onChange={handleFontWeightChange}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {FONT_WEIGHTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Color
                </span>
                <input
                  type="color"
                  value={selectedTextNode.data.fill}
                  onChange={handleColorChange}
                  className="h-9 w-9 rounded-md border border-slate-200 bg-white p-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Letter spacing
                </span>
                <input
                  type="number"
                  value={selectedTextNode.data.letterSpacing}
                  step={0.5}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onChange={handleLetterSpacingChange}
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={selectedTextNode.data.isCurved}
                onChange={handleCurvedToggle}
              />
              <span>Curved text</span>
            </label>
            {selectedTextNode.data.isCurved ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Radius
                  </span>
                  <input
                    type="number"
                    value={selectedTextNode.data.radius}
                    min={10}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onChange={handleRadiusChange}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Angle (°)
                  </span>
                  <input
                    type="number"
                    value={selectedTextNode.data.angle}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onChange={handleAngleChange}
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Select a text element on the canvas to adjust its properties.
          </p>
        )}
      </div>
    </div>
  );
}
