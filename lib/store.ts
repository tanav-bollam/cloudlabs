import { create } from "zustand";

export type PanelKey =
  | "pdf"
  | "addImage"
  | "shapes"
  | "addText"
  | "blocks"
  | "project"
  | "more"
  | "zoomReset";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

export type ImageAsset = {
  id: string;
  name: string;
  url: string;
};

export type PdfAsset = {
  id: string;
  name: string;
  url: string;
};

export type ImageNodeData = {
  assetId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  lockAspectRatio?: boolean;
};

export type PdfNodeData = {
  assetId: string;
  pageNumber: number;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity?: number;
  lockAspectRatio?: boolean;
};

export type ShapeNodeData = {
  path: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  fill: string;
  fillRule?: CanvasFillRule;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  lockAspectRatio?: boolean;
};

export type TextFontWeight = "400" | "600" | "700";

export type TextNodeData = {
  text: string;
  x: number;
  y: number;
  rotation: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: TextFontWeight;
  fill: string;
  letterSpacing: number;
  isCurved: boolean;
  radius: number;
  angle: number;
  width: number;
  height: number;
  opacity?: number;
  lockAspectRatio?: boolean;
};

export type DocumentNode =
  | {
      id: string;
      type: "image";
      data: ImageNodeData;
    }
  | {
      id: string;
      type: "pdf";
      data: PdfNodeData;
    }
  | {
      id: string;
      type: "shape";
      data: ShapeNodeData;
    }
  | {
      id: string;
      type: "text";
      data: TextNodeData;
    }
  | {
      id: string;
      type: string;
      data?: Record<string, unknown>;
    };

export const isImageNode = (node: DocumentNode): node is Extract<DocumentNode, { type: "image" }> =>
  node.type === "image";

export const isPdfNode = (node: DocumentNode): node is Extract<DocumentNode, { type: "pdf" }> =>
  node.type === "pdf";

export const isShapeNode = (node: DocumentNode): node is Extract<DocumentNode, { type: "shape" }> =>
  node.type === "shape";

export const isTextNode = (node: DocumentNode): node is Extract<DocumentNode, { type: "text" }> =>
  node.type === "text";

export type PendingPlacement =
  | { type: "image"; assetId: string }
  | {
      type: "pdf";
      assetId: string;
      pageNumber: number;
      imageUrl: string;
      width: number;
      height: number;
    };

export interface DocumentState {
  openPanel: PanelKey | null;
  zoom: number;
  rotation: number;
  nodes: DocumentNode[];
  selection: string[];
  isPropertiesPanelOpen: boolean;
  showBoundingBox: boolean;
  showTransparencyGrid: boolean;
  isPrintPreview: boolean;
  assets: {
    images: ImageAsset[];
    pdfs: PdfAsset[];
  };
  past: DocumentNode[][];
  future: DocumentNode[][];
  pendingPlacement: PendingPlacement | null;
  setOpenPanel: (panel: PanelKey | null) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  rotateCanvasLeft: () => void;
  rotateCanvasRight: () => void;
  rotateSelectionClockwise: () => void;
  setRotation: (rotation: number) => void;
  setNodes: (nodes: DocumentNode[]) => void;
  setSelection: (selection: string[]) => void;
  addNode: (node: DocumentNode) => void;
  addImageAssets: (images: ImageAsset[]) => void;
  addPdfAssets: (pdfs: PdfAsset[]) => void;
  deleteSelection: () => void;
  toggleBoundingBox: () => void;
  toggleTransparencyGrid: () => void;
  undo: () => void;
  redo: () => void;
  setPrintPreview: (value: boolean) => void;
  togglePrintPreview: () => void;
  queueAssetPlacement: (placement: PendingPlacement) => void;
  consumePendingPlacement: () => void;
  setPropertiesPanelOpen: (isOpen: boolean) => void;
  updateNode: (
    nodeId: string,
    updates: Partial<DocumentNode["data"]> | ((data: DocumentNode["data"]) => DocumentNode["data"]),
    options?: { commit?: boolean },
  ) => void;
  bringSelectionToFront: () => void;
  sendSelectionBackward: () => void;
}

const cloneNode = (node: DocumentNode): DocumentNode => ({
  ...node,
  data:
    node.data && typeof node.data === "object"
      ? { ...node.data }
      : node.data,
});

const cloneNodes = (nodes: DocumentNode[]) => nodes.map(cloneNode);

const normalizeZoom = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
};

const hasShallowChanges = (prev: unknown, next: unknown) => {
  if (prev === next) {
    return false;
  }

  if (
    !prev ||
    typeof prev !== "object" ||
    !next ||
    typeof next !== "object"
  ) {
    return true;
  }

  const prevRecord = prev as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  const keys = new Set([
    ...Object.keys(prevRecord),
    ...Object.keys(nextRecord),
  ]);

  for (const key of keys) {
    if (prevRecord[key] !== nextRecord[key]) {
      return true;
    }
  }

  return false;
};

export const useDocumentStore = create<DocumentState>((set) => ({
  openPanel: null,
  zoom: 1,
  rotation: 0,
  nodes: [],
  selection: [],
  isPropertiesPanelOpen: false,
  showBoundingBox: true,
  showTransparencyGrid: false,
  isPrintPreview: false,
  assets: {
    images: [],
    pdfs: [],
  },
  past: [],
  future: [],
  pendingPlacement: null,
  setOpenPanel: (panel) => set({ openPanel: panel }),
  setZoom: (zoom) =>
    set((state) => {
      const nextZoom = normalizeZoom(zoom);
      if (nextZoom === state.zoom) return state;
      return { zoom: nextZoom };
    }),
  zoomIn: () =>
    set((state) => {
      const nextZoom = normalizeZoom(state.zoom + ZOOM_STEP);
      if (nextZoom === state.zoom) return state;
      return { zoom: nextZoom };
    }),
  zoomOut: () =>
    set((state) => {
      const nextZoom = normalizeZoom(state.zoom - ZOOM_STEP);
      if (nextZoom === state.zoom) return state;
      return { zoom: nextZoom };
    }),
  resetZoom: () => set({ zoom: 1 }),
  rotateCanvasLeft: () =>
    set((state) => {
      const nextRotation = ((state.rotation - 90) % 360 + 360) % 360;
      if (nextRotation === state.rotation) return state;
      return { rotation: nextRotation };
    }),
  rotateCanvasRight: () =>
    set((state) => {
      const nextRotation = ((state.rotation + 90) % 360 + 360) % 360;
      if (nextRotation === state.rotation) return state;
      return { rotation: nextRotation };
    }),
  rotateSelectionClockwise: () =>
    set((state) => {
      if (!state.selection.length) return state;

      let hasUpdates = false;
      const nextNodes = state.nodes.map((node) => {
        if (!state.selection.includes(node.id)) return node;
        if (!node.data || typeof node.data !== "object") return node;
        if (!("rotation" in node.data)) return node;

        const rotationValue = (node.data as { rotation?: unknown }).rotation;
        const currentRotation =
          typeof rotationValue === "number" ? rotationValue : 0;
        const nextRotation = ((currentRotation + 90) % 360 + 360) % 360;

        if (nextRotation === currentRotation) return node;

        hasUpdates = true;

        return {
          ...node,
          data: {
            ...(node.data as Record<string, unknown>),
            rotation: nextRotation,
          },
        };
      });

      if (!hasUpdates) return state;

      return {
        nodes: cloneNodes(nextNodes),
        past: [...state.past, cloneNodes(state.nodes)],
        future: [],
      };
    }),
  setRotation: (rotation) => set({ rotation }),
  setNodes: (nodes) =>
    set((state) => ({
      nodes: cloneNodes(nodes),
      past: [...state.past, cloneNodes(state.nodes)],
      future: [],
    })),
  setSelection: (selection) => set({ selection }),
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, cloneNode(node)],
      past: [...state.past, cloneNodes(state.nodes)],
      future: [],
    })),
  addImageAssets: (images) =>
    set((state) => ({
      assets: {
        ...state.assets,
        images: [...state.assets.images, ...images],
      },
    })),
  addPdfAssets: (pdfs) =>
    set((state) => ({
      assets: {
        ...state.assets,
        pdfs: [...state.assets.pdfs, ...pdfs],
      },
    })),
  queueAssetPlacement: (placement) => set({ pendingPlacement: placement }),
  consumePendingPlacement: () => set({ pendingPlacement: null }),
  setPropertiesPanelOpen: (isOpen) => set({ isPropertiesPanelOpen: isOpen }),
  deleteSelection: () =>
    set((state) => {
      if (!state.selection.length) return state;
      const remainingNodes = state.nodes.filter(
        (node) => !state.selection.includes(node.id),
      );
      if (remainingNodes.length === state.nodes.length) return state;
      return {
        nodes: cloneNodes(remainingNodes),
        past: [...state.past, cloneNodes(state.nodes)],
        future: [],
        selection: [],
        isPropertiesPanelOpen: false,
      };
    }),
  toggleBoundingBox: () =>
    set((state) => ({ showBoundingBox: !state.showBoundingBox })),
  toggleTransparencyGrid: () =>
    set((state) => ({ showTransparencyGrid: !state.showTransparencyGrid })),
  undo: () =>
    set((state) => {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      const updatedPast = state.past.slice(0, -1);
      return {
        nodes: cloneNodes(previous),
        past: updatedPast,
        future: [cloneNodes(state.nodes), ...state.future],
        selection: [],
      };
    }),
  redo: () =>
    set((state) => {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        nodes: cloneNodes(next),
        past: [...state.past, cloneNodes(state.nodes)],
        future: rest,
        selection: [],
      };
    }),
  setPrintPreview: (value) => set({ isPrintPreview: value }),
  togglePrintPreview: () =>
    set((state) => ({ isPrintPreview: !state.isPrintPreview })),
  updateNode: (nodeId, updates, options) =>
    set((state) => {
      const index = state.nodes.findIndex((node) => node.id === nodeId);
      if (index === -1) {
        return state;
      }

      const node = state.nodes[index];
      const baseData = (node.data ?? {}) as Record<string, unknown>;

      const nextData =
        typeof updates === "function"
          ? updates(node.data as DocumentNode["data"])
          : ({
              ...baseData,
              ...updates,
            } as DocumentNode["data"]);

      if (!hasShallowChanges(node.data, nextData)) {
        return state;
      }

      const nextNodes = state.nodes.slice();
      nextNodes[index] = { ...node, data: nextData } as DocumentNode;

      if (options?.commit === false) {
        return {
          nodes: cloneNodes(nextNodes),
        };
      }

      return {
        nodes: cloneNodes(nextNodes),
        past: [...state.past, cloneNodes(state.nodes)],
        future: [],
      };
    }),
  bringSelectionToFront: () =>
    set((state) => {
      const selectedId = state.selection[state.selection.length - 1];
      if (!selectedId) {
        return state;
      }

      const index = state.nodes.findIndex((node) => node.id === selectedId);
      if (index === -1 || index === state.nodes.length - 1) {
        return state;
      }

      const nextNodes = state.nodes.slice();
      const [node] = nextNodes.splice(index, 1);
      nextNodes.push(node);

      return {
        nodes: cloneNodes(nextNodes),
        past: [...state.past, cloneNodes(state.nodes)],
        future: [],
      };
    }),
  sendSelectionBackward: () =>
    set((state) => {
      const selectedId = state.selection[state.selection.length - 1];
      if (!selectedId) {
        return state;
      }

      const index = state.nodes.findIndex((node) => node.id === selectedId);
      if (index <= 0) {
        return state;
      }

      const nextNodes = state.nodes.slice();
      const [node] = nextNodes.splice(index, 1);
      nextNodes.splice(index - 1, 0, node);

      return {
        nodes: cloneNodes(nextNodes),
        past: [...state.past, cloneNodes(state.nodes)],
        future: [],
      };
    }),
}));

export const useOpenPanel = () =>
  useDocumentStore((state) => state.openPanel);

export const useDocumentActions = () =>
  useDocumentStore((state) => ({
    setOpenPanel: state.setOpenPanel,
    setZoom: state.setZoom,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    resetZoom: state.resetZoom,
    rotateCanvasLeft: state.rotateCanvasLeft,
    rotateCanvasRight: state.rotateCanvasRight,
    rotateSelectionClockwise: state.rotateSelectionClockwise,
    setRotation: state.setRotation,
    setNodes: state.setNodes,
    setSelection: state.setSelection,
    addNode: state.addNode,
    addImageAssets: state.addImageAssets,
    addPdfAssets: state.addPdfAssets,
    deleteSelection: state.deleteSelection,
    undo: state.undo,
    redo: state.redo,
    queueAssetPlacement: state.queueAssetPlacement,
    setPropertiesPanelOpen: state.setPropertiesPanelOpen,
    updateNode: state.updateNode,
    bringSelectionToFront: state.bringSelectionToFront,
    sendSelectionBackward: state.sendSelectionBackward,
  }));
