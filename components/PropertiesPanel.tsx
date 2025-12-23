"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DocumentNode,
  ImageAsset,
  PdfAsset,
  isImageNode,
  isPdfNode,
  isShapeNode,
  isTextNode,
  useDocumentStore,
} from "@/lib/store";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

const ROTATION_MIN = 0;
const ROTATION_MAX = 360;

export default function PropertiesPanel() {
  const isOpen = useDocumentStore((state) => state.isPropertiesPanelOpen);
  const selection = useDocumentStore((state) => state.selection);
  const nodes = useDocumentStore((state) => state.nodes);
  const images = useDocumentStore((state) => state.assets.images);
  const pdfs = useDocumentStore((state) => state.assets.pdfs);
  const setPropertiesPanelOpen = useDocumentStore(
    (state) => state.setPropertiesPanelOpen,
  );
  const updateNode = useDocumentStore((state) => state.updateNode);
  const deleteSelection = useDocumentStore((state) => state.deleteSelection);
  const bringSelectionToFront = useDocumentStore(
    (state) => state.bringSelectionToFront,
  );
  const sendSelectionBackward = useDocumentStore(
    (state) => state.sendSelectionBackward,
  );

  const selectedId = selection[selection.length - 1] ?? null;
  const selectedNode = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return nodes.find((node) => node.id === selectedId) ?? null;
  }, [nodes, selectedId]);

  useEffect(() => {
    if (!selection.length && isOpen) {
      setPropertiesPanelOpen(false);
    }
  }, [isOpen, selection.length, setPropertiesPanelOpen]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        lastTriggerRef.current = activeElement;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      const trigger = lastTriggerRef.current ?? (document.querySelector(
        "[data-properties-trigger=\"true\"]",
      ) as HTMLElement | null);

      lastTriggerRef.current = null;

      if (trigger) {
        trigger.focus();
      }
      return;
    }

    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPropertiesPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setPropertiesPanelOpen]);

  const [rotationInput, setRotationInput] = useState<string | null>(null);

  useEffect(() => {
    setRotationInput(null);
  }, [selectedId, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setPropertiesPanelOpen(false);
  };

  const handleDelete = () => {
    deleteSelection();
    setPropertiesPanelOpen(false);
  };

  const nodeType = selectedNode?.type ?? null;
  const baseOpacity = selectedNode
    ? getNodeBaseOpacity(selectedNode)
    : 1;
  const rotation = selectedNode
    ? normalizeRotation(getNodeRotation(selectedNode))
    : 0;
  const lockAspectRatio = selectedNode
    ? getNodeLockAspect(selectedNode)
    : false;

  const preview = selectedNode
    ? renderPreview(selectedNode, images, pdfs)
    : null;

  const supportsFill = selectedNode ? isShapeNode(selectedNode) : false;
  const supportsStroke = supportsFill;
  const supportsLockAspect = selectedNode
    ? supportsAspectLock(selectedNode)
    : false;

  const handleOpacityChange = (value: number, commit: boolean) => {
    if (!selectedNode) {
      return;
    }
    const nextValue = clamp(value, 0, 1);
    updateNode(
      selectedNode.id,
      { opacity: nextValue },
      { commit: commit ? undefined : false },
    );
  };

  const handleRotationCommit = (value: number, commit: boolean) => {
    if (!selectedNode) {
      return;
    }
    const normalized = normalizeRotation(value);
    updateNode(
      selectedNode.id,
      { rotation: normalized },
      { commit: commit ? undefined : false },
    );
  };

  const handleLockAspectChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode) {
      return;
    }
    updateNode(
      selectedNode.id,
      { lockAspectRatio: event.target.checked },
      { commit: true },
    );
  };

  const handleFillChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode || !isShapeNode(selectedNode)) {
      return;
    }
    updateNode(selectedNode.id, { fill: event.target.value }, { commit: true });
  };

  const handleStrokeChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode || !isShapeNode(selectedNode)) {
      return;
    }
    updateNode(selectedNode.id, { stroke: event.target.value }, { commit: true });
  };

  const handleStrokeWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode || !isShapeNode(selectedNode)) {
      return;
    }
    const value = clamp(Number(event.target.value), 0, 40);
    if (!Number.isFinite(value)) {
      return;
    }
    updateNode(selectedNode.id, { strokeWidth: value }, { commit: true });
  };

  const rotationValue = rotationInput ?? String(Math.round(rotation));

  const handleRotationInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRotationInput(event.target.value);
  };

  const commitRotationInput = () => {
    if (!selectedNode) {
      return;
    }
    const value = Number(rotationInput);
    if (!Number.isFinite(value)) {
      setRotationInput(String(Math.round(rotation)));
      return;
    }
    handleRotationCommit(value, true);
    setRotationInput(null);
  };

  const handleRotationInputBlur = (event: FormEvent<HTMLInputElement>) => {
    event.preventDefault();
    commitRotationInput();
  };

  const handleRotationInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRotationInput();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setRotationInput(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/20"
        role="presentation"
        onClick={handleClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="properties-panel-title"
        tabIndex={-1}
        ref={panelRef}
        className="fixed inset-y-0 left-0 z-50 w-[340px] max-w-full overflow-y-auto border-r border-slate-200 bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="properties-panel-title"
              className="text-lg font-semibold text-slate-900"
            >
              Properties
            </h2>
            <p className="text-sm text-slate-500">
              {selectedNode ? "Adjust the selected object." : "Select an object to edit its properties."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            aria-label="Close properties"
          >
            ×
          </button>
        </div>
        <div className="space-y-6 px-5 py-6 text-sm text-slate-700">
          {selectedNode ? (
            <>
              <section className="space-y-4">
                <header className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selection
                  </h3>
                  <p className="text-sm font-medium text-slate-900">
                    {getNodeLabel(selectedNode)}
                  </p>
                </header>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {preview}
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <label className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Opacity
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        {(baseOpacity * 100).toFixed(0)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={baseOpacity}
                      onChange={(event) =>
                        handleOpacityChange(Number(event.target.value), false)
                      }
                      onPointerUp={(event) =>
                        handleOpacityChange(Number(event.currentTarget.value), true)
                      }
                      onKeyUp={(event) => {
                        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                          handleOpacityChange(
                            Number((event.currentTarget as HTMLInputElement).value),
                            true,
                          );
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
                {supportsFill ? (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Fill color
                      <input
                        type="color"
                        value={(selectedNode as Extract<DocumentNode, { type: "shape" }>).data.fill}
                        onChange={handleFillChange}
                        className="h-9 w-full cursor-pointer rounded border border-slate-200"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Stroke color
                      <input
                        type="color"
                        value={(selectedNode as Extract<DocumentNode, { type: "shape" }>).data.stroke ?? "#000000"}
                        onChange={handleStrokeChange}
                        className="h-9 w-full cursor-pointer rounded border border-slate-200"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Stroke width
                      <input
                        type="number"
                        min={0}
                        max={40}
                        step={1}
                        value={(selectedNode as Extract<DocumentNode, { type: "shape" }>).data.strokeWidth ?? 0}
                        onChange={handleStrokeWidthChange}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                ) : null}
                {supportsLockAspect ? (
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <input
                      type="checkbox"
                      checked={lockAspectRatio}
                      onChange={handleLockAspectChange}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Lock aspect ratio
                  </label>
                ) : null}
              </section>

              <section className="space-y-4">
                <header className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Transform
                  </h3>
                  <p className="text-sm text-slate-600">
                    Adjust rotation and stacking order.
                  </p>
                </header>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rotate
                    <span className="text-xs font-medium text-slate-600">
                      {Math.round(rotation)}°
                    </span>
                  </label>
                  <input
                    type="range"
                    min={ROTATION_MIN}
                    max={ROTATION_MAX}
                    step={1}
                    value={rotation}
                    onChange={(event) =>
                      handleRotationCommit(Number(event.target.value), false)
                    }
                    onPointerUp={(event) =>
                      handleRotationCommit(Number(event.currentTarget.value), true)
                    }
                    onKeyUp={(event) => {
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight"
                      ) {
                        handleRotationCommit(
                          Number((event.currentTarget as HTMLInputElement).value),
                          true,
                        );
                      }
                    }}
                    className="w-full"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={-360}
                      max={720}
                      step={1}
                      value={rotationValue}
                      onChange={handleRotationInputChange}
                      onBlur={handleRotationInputBlur}
                      onKeyDown={handleRotationInputKeyDown}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                      aria-label="Rotate degrees"
                    />
                    <span className="text-xs text-slate-500">degrees</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    onClick={bringSelectionToFront}
                    title="Bring to front"
                  >
                    Bring to front
                  </button>
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    onClick={sendSelectionBackward}
                    title="Send backward"
                  >
                    Send backward
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex w-full items-center justify-center rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                >
                  Delete selection
                </button>
              </section>
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Select an object to edit its properties.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function getNodeBaseOpacity(node: DocumentNode) {
  if (isImageNode(node)) {
    return clamp(node.data.opacity ?? 1, 0, 1);
  }
  if (isPdfNode(node)) {
    return clamp(node.data.opacity ?? 1, 0, 1);
  }
  if (isShapeNode(node)) {
    return clamp(node.data.opacity ?? 1, 0, 1);
  }
  if (isTextNode(node)) {
    return clamp(node.data.opacity ?? 1, 0, 1);
  }
  return 1;
}

function getNodeRotation(node: DocumentNode) {
  if (isImageNode(node)) {
    return node.data.rotation ?? 0;
  }
  if (isPdfNode(node)) {
    return node.data.rotation;
  }
  if (isShapeNode(node)) {
    return node.data.rotation;
  }
  if (isTextNode(node)) {
    return node.data.rotation;
  }
  return 0;
}

function getNodeLockAspect(node: DocumentNode) {
  if (isImageNode(node)) {
    return !!node.data.lockAspectRatio;
  }
  if (isPdfNode(node)) {
    return !!node.data.lockAspectRatio;
  }
  if (isShapeNode(node)) {
    return !!node.data.lockAspectRatio;
  }
  if (isTextNode(node)) {
    return !!node.data.lockAspectRatio;
  }
  return false;
}

function supportsAspectLock(node: DocumentNode) {
  return isImageNode(node) || isPdfNode(node) || isShapeNode(node);
}

function getNodeLabel(node: DocumentNode) {
  if (isImageNode(node)) {
    return "Image";
  }
  if (isPdfNode(node)) {
    return `PDF page ${node.data.pageNumber}`;
  }
  if (isShapeNode(node)) {
    return "Shape";
  }
  if (isTextNode(node)) {
    return "Text";
  }
  return "Object";
}

function renderPreview(
  node: DocumentNode,
  images: ImageAsset[],
  pdfs: PdfAsset[],
) {
  if (isImageNode(node)) {
    const asset = images.find((item) => item.id === node.data.assetId);
    if (!asset) {
      return (
        <span className="text-xs text-slate-400">Image not found</span>
      );
    }
    return (
      <img
        src={asset.url}
        alt={asset.name}
        className="h-full w-full object-contain"
      />
    );
  }

  if (isPdfNode(node)) {
    return (
      <img
        src={node.data.imageUrl}
        alt={`PDF page ${node.data.pageNumber}`}
        className="h-full w-full object-contain"
      />
    );
  }

  if (isShapeNode(node)) {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path
          d={node.data.path}
          fill={node.data.fill}
          fillRule={node.data.fillRule ?? "nonzero"}
          stroke={node.data.stroke ?? "transparent"}
          strokeWidth={node.data.strokeWidth ?? 0}
        />
      </svg>
    );
  }

  if (isTextNode(node)) {
    return (
      <span
        className="px-1 text-xs font-medium"
        style={{ color: node.data.fill }}
      >
        {node.data.text}
      </span>
    );
  }

  return <span className="text-xs text-slate-400">Unsupported</span>;
}

function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
