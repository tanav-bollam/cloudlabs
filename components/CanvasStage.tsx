"use client";

import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import {
  Group,
  Image as KonvaImageComponent,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text as KonvaTextComponent,
  Transformer as KonvaTransformer,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Node as KonvaNode } from "konva/lib/Node";
import type { Group as KonvaGroupShape } from "konva/lib/Group";
import type { Transformer as KonvaTransformerShape } from "konva/lib/shapes/Transformer";
import type { Image as KonvaImageShape } from "konva/lib/shapes/Image";
import type { Text as KonvaTextShape } from "konva/lib/shapes/Text";
import type { Stage as KonvaStage } from "konva/lib/Stage";

import type { Path as KonvaPathShape } from "konva/lib/shapes/Path";
import type { Layer as KonvaLayerShape } from "konva/lib/Layer";
import type { Rect as KonvaRectShape } from "konva/lib/shapes/Rect";

import Konva from "konva";

import {
  DielineDocument,
  getDielineScale,
  isInsideDieline,
  loadDielineDocument,
} from "@/lib/dieline";
import {
  DocumentNode,
  ImageAsset,
  PdfAsset,
  isImageNode,
  isPdfNode,
  isShapeNode,
  isTextNode,
  TextFontWeight,
  TextNodeData,
  useDocumentStore,
} from "@/lib/store";
import {
  computeCurvedTextLayout,
  fontWeightToFontStyle,
  measureStraightText,
  withUpdatedTextMetrics,
} from "@/lib/text";

import { createRandomId } from "@/lib/randomId";
import {
  BOX_FACE_CONFIG,
  BOX_FACE_ORDER,
  type BoxFaceKey,
} from "@/lib/boxLayoutConfig";
import { usePreviewStore } from "@/lib/previewStore";
import { DRAG_DATA_TYPE } from "./LeftToolbar/ImagePanel";
import { SHAPE_DRAG_DATA_TYPE } from "./LeftToolbar/ShapesPanel";
import SelectionToolbar from "./SelectionToolbar";

interface StageSize {
  width: number;
  height: number;
}

const DEFAULT_STAGE_SIZE: StageSize = { width: 0, height: 0 };
const DIELINE_NAME = "mailer";

type ImageDocumentNode = Extract<DocumentNode, { type: "image" }>;
type PdfDocumentNode = Extract<DocumentNode, { type: "pdf" }>;
type ShapeDocumentNode = Extract<DocumentNode, { type: "shape" }>;
type TextDocumentNode = Extract<DocumentNode, { type: "text" }>;

type TextEditBounds = {
  rect: { x: number; y: number; width: number; height: number };
  stagePosition: { left: number; top: number };
};

type EditingTextState = {
  id: string;
  value: string;
  originalValue: string;
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: TextFontWeight;
  color: string;
  rotation: number;
  isCurved: boolean;
  data: TextNodeData;
  scale: number;
};

const MIN_TRANSFORM_SIZE = 5;
const SHAPE_BASE_SIZE = 100;
const MIN_SHAPE_SCALE = 0.2;
const MIN_TEXT_EDITOR_SIZE = 32;
const CORNER_ANCHORS = new Set([
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
]);

const ALL_TRANSFORMER_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "bottom-right",
  "bottom-center",
  "bottom-left",
  "middle-left",
] as const;

const CORNER_TRANSFORMER_ANCHORS = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
] as const;

const ROTATION_SNAP_STEP = 15;
const RAD_TO_DEG = 180 / Math.PI;

const GRID_SIZE = 24;
const GRID_MINOR_LINE_COLOR = "rgba(148, 163, 184, 0.25)";
const GRID_MAJOR_LINE_COLOR = "rgba(148, 163, 184, 0.45)";
const GRID_MAJOR_LINE_INTERVAL = 4;

const MAGNIFIER_RADIUS = 140;
const MAGNIFIER_DIAMETER = MAGNIFIER_RADIUS * 2;
const MAGNIFICATION_FACTOR = 2.5;
const OUTSIDE_DIELINE_OPACITY = 0.6;
const DEFAULT_IMAGE_PLACEHOLDER_WIDTH = 320;
const DEFAULT_IMAGE_PLACEHOLDER_HEIGHT = 240;
const DEFAULT_PDF_WIDTH = 400;
const DEFAULT_PDF_HEIGHT = 520;
const MIN_PDF_DIMENSION = 120;
const TEXTURE_UPDATE_DEBOUNCE_MS = 260;
const TARGET_TEXTURE_RESOLUTION = 1024;
const MAX_TEXTURE_PIXEL_RATIO = 4;

const getClientPoint = (
  event: MouseEvent | TouchEvent,
): { clientX: number; clientY: number } | null => {
  if ("clientX" in event) {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  if (event.touches && event.touches[0]) {
    const touch = event.touches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  if (event.changedTouches && event.changedTouches[0]) {
    const touch = event.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  return null;
};

type SelectionViewportBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type NodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MagnifierPosition = { left: number; top: number };
type StagePoint = { x: number; y: number };

type RotationSession = {
  nodeId: string;
  pointerId: number;
  centerX: number;
  centerY: number;
  startAngle: number;
  initialRotation: number;
  latestRotation: number;
};

export default function CanvasStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const backgroundLayerRef = useRef<KonvaLayerShape | null>(null);
  const dielineLayerRef = useRef<KonvaLayerShape | null>(null);
  const gridLayerRef = useRef<KonvaLayerShape | null>(null);
  const artworkLayerRef = useRef<KonvaLayerShape | null>(null);
  const [artworkLayerInstance, setArtworkLayerInstance] =
    useState<KonvaLayerShape | null>(null);
  const textureUpdateTimerRef = useRef<number | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>(DEFAULT_STAGE_SIZE);
  const [dieline, setDieline] = useState<DielineDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodes = useDocumentStore((state) => state.nodes);
  const addNode = useDocumentStore((state) => state.addNode);
  const setNodes = useDocumentStore((state) => state.setNodes);
  const updateNode = useDocumentStore((state) => state.updateNode);
  const selection = useDocumentStore((state) => state.selection);
  const setSelection = useDocumentStore((state) => state.setSelection);
  const zoom = useDocumentStore((state) => state.zoom);
  const zoomInAction = useDocumentStore((state) => state.zoomIn);
  const zoomOutAction = useDocumentStore((state) => state.zoomOut);
  const deleteSelection = useDocumentStore((state) => state.deleteSelection);
  const imageAssets = useDocumentStore((state) => state.assets.images);
  const pdfAssets = useDocumentStore((state) => state.assets.pdfs);
  const pendingPlacement = useDocumentStore((state) => state.pendingPlacement);
  const consumePendingPlacement = useDocumentStore(
    (state) => state.consumePendingPlacement,
  );
  const canvasRotation = useDocumentStore((state) => state.rotation);
  const isPrintPreview = useDocumentStore((state) => state.isPrintPreview);
  const transformerRef = useRef<KonvaTransformerShape | null>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedShapeRefs = useRef<Map<string, KonvaNode>>(new Map());
  const detachSelectedShapeListenersRef = useRef<Map<string, () => void>>(
    new Map(),
  );
  const boundsRectRefs = useRef<Map<string, KonvaRectShape>>(new Map());
  const selectionBoundsAnimationFrameRef = useRef<number | null>(null);
  const magnifierAnimationFrameRef = useRef<number | null>(null);
  const rotationSessionRef = useRef<RotationSession | null>(null);
  const [editingText, setEditingText] = useState<EditingTextState | null>(null);
  const [selectionBounds, setSelectionBounds] =
    useState<SelectionViewportBounds | null>(null);
  const [showBounds, setShowBounds] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const setFaceTextures = usePreviewStore((state) => state.setFaceTextures);
  const resetFaceTextures = usePreviewStore((state) => state.resetFaceTextures);
  const [magnifierPosition, setMagnifierPosition] =
    useState<MagnifierPosition | null>(null);
  const gridSize = showGrid ? GRID_SIZE : null;
  const hasSelection = selection.length > 0;
  const selectedNodeIds = selection;

  const handleRotatePointerMove = useCallback(
    (event: PointerEvent) => {
      const session = rotationSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      event.preventDefault();

      const angle = Math.atan2(
        event.clientY - session.centerY,
        event.clientX - session.centerX,
      );
      const deltaRadians = angle - session.startAngle;
      let nextRotation = session.initialRotation + deltaRadians * RAD_TO_DEG;

      if (event.shiftKey) {
        nextRotation = snapRotation(nextRotation, ROTATION_SNAP_STEP);
      }

      session.latestRotation = nextRotation;

      updateNode(
        session.nodeId,
        { rotation: normalizeRotation(nextRotation) },
        { commit: false },
      );
    },
    [updateNode],
  );

  const handleRotatePointerUp = useCallback(
    (event: PointerEvent) => {
      const session = rotationSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      document.removeEventListener("pointermove", handleRotatePointerMove);
      document.removeEventListener("pointerup", handleRotatePointerUp);
      document.removeEventListener("pointercancel", handleRotatePointerUp);

      rotationSessionRef.current = null;

      updateNode(session.nodeId, {
        rotation: normalizeRotation(session.latestRotation),
      });
    },
    [handleRotatePointerMove, updateNode],
  );

  useEffect(
    () => () => {
      if (rotationSessionRef.current) {
        document.removeEventListener("pointermove", handleRotatePointerMove);
        document.removeEventListener("pointerup", handleRotatePointerUp);
        document.removeEventListener("pointercancel", handleRotatePointerUp);
        rotationSessionRef.current = null;
      }
    },
    [handleRotatePointerMove, handleRotatePointerUp],
  );

  const clearMagnifier = useCallback(() => {
    const canvas = magnifierCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const renderMagnifier = useCallback((stage: KonvaStage, point: StagePoint) => {
    const canvas = magnifierCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    if (
      canvas.width !== MAGNIFIER_DIAMETER ||
      canvas.height !== MAGNIFIER_DIAMETER
    ) {
      canvas.width = MAGNIFIER_DIAMETER;
      canvas.height = MAGNIFIER_DIAMETER;
    }

    const cropWidth = MAGNIFIER_DIAMETER / MAGNIFICATION_FACTOR;
    const cropHeight = MAGNIFIER_DIAMETER / MAGNIFICATION_FACTOR;
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    const desiredX = point.x - cropWidth / 2;
    const desiredY = point.y - cropHeight / 2;

    const clampedX = Math.min(
      Math.max(0, desiredX),
      Math.max(0, stageWidth - cropWidth),
    );
    const clampedY = Math.min(
      Math.max(0, desiredY),
      Math.max(0, stageHeight - cropHeight),
    );

    let snapshot: HTMLCanvasElement;
    try {
      snapshot = stage.toCanvas({
        x: clampedX,
        y: clampedY,
        width: cropWidth,
        height: cropHeight,
        pixelRatio: MAGNIFICATION_FACTOR,
      });
    } catch (error) {
      return;
    }

    context.clearRect(0, 0, MAGNIFIER_DIAMETER, MAGNIFIER_DIAMETER);
    context.save();
    context.beginPath();
    context.arc(
      MAGNIFIER_DIAMETER / 2,
      MAGNIFIER_DIAMETER / 2,
      MAGNIFIER_RADIUS,
      0,
      Math.PI * 2,
    );
    context.clip();
    context.drawImage(snapshot, 0, 0, MAGNIFIER_DIAMETER, MAGNIFIER_DIAMETER);
    context.restore();

    context.beginPath();
    context.arc(
      MAGNIFIER_DIAMETER / 2,
      MAGNIFIER_DIAMETER / 2,
      MAGNIFIER_RADIUS - 1,
      0,
      Math.PI * 2,
    );
    context.strokeStyle = "rgba(15, 23, 42, 0.25)";
    context.lineWidth = 2;
    context.stroke();
  }, []);

  const scheduleMagnifierRender = useCallback(
    (stage: KonvaStage, point: StagePoint) => {
      const draw = () => {
        magnifierAnimationFrameRef.current = null;
        renderMagnifier(stage, point);
      };

      if (typeof window === "undefined") {
        draw();
        return;
      }

      if (magnifierAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(magnifierAnimationFrameRef.current);
      }

      magnifierAnimationFrameRef.current = window.requestAnimationFrame(draw);
    },
    [renderMagnifier],
  );

  const handleToggleBounds = useCallback(() => {
    setShowBounds((prev) => !prev);
  }, []);

  const handleToggleGrid = useCallback(() => {
    const nextShowGrid = !showGrid;
    setShowGrid(nextShowGrid);

    if (nextShowGrid) {
      const snappedNodes = nodes.map((node) =>
        snapDocumentNodeToGrid(node, GRID_SIZE),
      );

      const hasChanges = snappedNodes.some(
        (node, index) => node !== nodes[index],
      );

      if (hasChanges) {
        setNodes(snappedNodes);
      }
    }
  }, [nodes, setNodes, showGrid]);

  useEffect(() => {
    let isMounted = true;

    loadDielineDocument(DIELINE_NAME)
      .then((document) => {
        if (isMounted) {
          setDieline(document);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isPrintPreview) {
      return;
    }

    setMagnifierPosition(null);
    clearMagnifier();
  }, [clearMagnifier, isPrintPreview]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    setStageSize({ width: element.clientWidth, height: element.clientHeight });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      setStageSize({ width, height });
    });

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  const isReady =
    !!dieline &&
    stageSize.width > 0 &&
    stageSize.height > 0 &&
    !error;

  const { scale, offsetX, offsetY } = useMemo(() => {
    if (!dieline || !stageSize.width || !stageSize.height) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }

    return getDielineScale(stageSize.width, stageSize.height, dieline, 64);
  }, [dieline, stageSize.height, stageSize.width]);

  const effectiveScale = useMemo(() => scale * zoom, [scale, zoom]);

  const layerPosition = useMemo(() => {
    if (!dieline) {
      return { x: 0, y: 0 };
    }

    const extraOffsetX = (dieline.width * scale * (zoom - 1)) / 2;
    const extraOffsetY = (dieline.height * scale * (zoom - 1)) / 2;
    const adjustedOffsetX = offsetX - extraOffsetX;
    const adjustedOffsetY = offsetY - extraOffsetY;

    return {
      x: adjustedOffsetX - dieline.x * effectiveScale,
      y: adjustedOffsetY - dieline.y * effectiveScale,
    };
  }, [dieline, effectiveScale, offsetX, offsetY, scale, zoom]);
  const layerPositionX = layerPosition.x;
  const layerPositionY = layerPosition.y;

  const imageAssetById = useMemo(() => {
    const map = new Map<string, ImageAsset>();
    for (const asset of imageAssets) {
      map.set(asset.id, asset);
    }
    return map;
  }, [imageAssets]);

  const pdfAssetById = useMemo(() => {
    const map = new Map<string, PdfAsset>();
    for (const asset of pdfAssets) {
      map.set(asset.id, asset);
    }
    return map;
  }, [pdfAssets]);

  const handleBackgroundLayerRef = useCallback((layer: KonvaLayerShape | null) => {
    backgroundLayerRef.current = layer;
  }, []);

  const handleDielineLayerRef = useCallback((layer: KonvaLayerShape | null) => {
    dielineLayerRef.current = layer;
  }, []);

  const handleGridLayerRef = useCallback((layer: KonvaLayerShape | null) => {
    gridLayerRef.current = layer;
  }, []);

  const handleArtworkLayerRef = useCallback((layer: KonvaLayerShape | null) => {
    artworkLayerRef.current = layer;
    setArtworkLayerInstance(layer);
  }, []);

  const updateFaceTextures = useCallback(() => {
    if (!stageRef.current || !dieline || !isReady) {
      return;
    }

    if (canvasRotation % 360 !== 0) {
      return;
    }

    const stage = stageRef.current;
    const layersToToggle: KonvaLayerShape[] = [];

    if (backgroundLayerRef.current) {
      layersToToggle.push(backgroundLayerRef.current);
    }
    if (dielineLayerRef.current) {
      layersToToggle.push(dielineLayerRef.current);
    }
    if (gridLayerRef.current) {
      layersToToggle.push(gridLayerRef.current);
    }

    const transformer = transformerRef.current;
    const transformerWasVisible = transformer?.visible() ?? false;

    const updates: Partial<Record<BoxFaceKey, string | null>> = {};

    try {
      layersToToggle.forEach((layer) => {
        layer.visible(false);
      });

      if (transformer && transformerWasVisible) {
        transformer.visible(false);
      }

      stage.batchDraw();

      for (const faceKey of BOX_FACE_ORDER) {
        const { rect } = BOX_FACE_CONFIG[faceKey];
        const stageWidth = rect.width * effectiveScale;
        const stageHeight = rect.height * effectiveScale;

        if (stageWidth <= 0 || stageHeight <= 0) {
          updates[faceKey] = null;
          continue;
        }

        const stageX = layerPositionX + rect.x * effectiveScale;
        const stageY = layerPositionY + rect.y * effectiveScale;
        const longestSide = Math.max(stageWidth, stageHeight);
        const pixelRatio =
          longestSide > 0
            ? Math.min(
                MAX_TEXTURE_PIXEL_RATIO,
                Math.max(1, TARGET_TEXTURE_RESOLUTION / longestSide),
              )
            : 1;

        const dataUrl = stage.toDataURL({
          x: stageX,
          y: stageY,
          width: stageWidth,
          height: stageHeight,
          pixelRatio,
          mimeType: "image/png",
          quality: 1,
        });

        updates[faceKey] = dataUrl;
      }
    } catch (error) {
      console.error("Failed to update 3D preview textures", error);
    } finally {
      layersToToggle.forEach((layer) => {
        layer.visible(true);
        layer.batchDraw();
      });

      if (transformer) {
        transformer.visible(transformerWasVisible);
        transformer.getLayer()?.batchDraw();
      }

      stage.batchDraw();
    }

    if (Object.keys(updates).length > 0) {
      setFaceTextures(updates);
    }
  }, [
    canvasRotation,
    dieline,
    effectiveScale,
    isReady,
    layerPositionX,
    layerPositionY,
    setFaceTextures,
  ]);

  const scheduleTextureUpdate = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (textureUpdateTimerRef.current) {
      window.clearTimeout(textureUpdateTimerRef.current);
    }

    textureUpdateTimerRef.current = window.setTimeout(() => {
      textureUpdateTimerRef.current = null;
      updateFaceTextures();
    }, TEXTURE_UPDATE_DEBOUNCE_MS);
  }, [updateFaceTextures]);

  useEffect(() => {
    if (!artworkLayerInstance) {
      return;
    }

    const handleDraw = () => {
      scheduleTextureUpdate();
    };

    artworkLayerInstance.on("draw", handleDraw);

    return () => {
      artworkLayerInstance.off("draw", handleDraw);
    };
  }, [artworkLayerInstance, scheduleTextureUpdate]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const handleChange = () => {
      scheduleTextureUpdate();
    };

    stage.on("dragend transformend", handleChange);

    return () => {
      stage.off("dragend transformend", handleChange);
    };
  }, [scheduleTextureUpdate]);

  useEffect(() => {
    if (!isReady || !dieline) {
      return;
    }

    if (canvasRotation % 360 !== 0) {
      return;
    }

    scheduleTextureUpdate();
  }, [
    dieline,
    isReady,
    nodes,
    effectiveScale,
    layerPositionX,
    layerPositionY,
    stageSize.height,
    stageSize.width,
    canvasRotation,
    showGrid,
    scheduleTextureUpdate,
  ]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && textureUpdateTimerRef.current) {
        window.clearTimeout(textureUpdateTimerRef.current);
      }

      resetFaceTextures();
    },
    [resetFaceTextures],
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types);
    if (
      !types.includes(DRAG_DATA_TYPE) &&
      !types.includes(SHAPE_DRAG_DATA_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const shapeDataRaw = event.dataTransfer.getData(SHAPE_DRAG_DATA_TYPE);
    if (shapeDataRaw) {
      const shapeData = parseShapeDragData(shapeDataRaw);
      if (!shapeData) {
        return;
      }

      event.preventDefault();

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;

      const canvasX = (pointerX - layerPosition.x) / effectiveScale;
      const canvasY = (pointerY - layerPosition.y) / effectiveScale;

      const shapeLeft = canvasX - SHAPE_BASE_SIZE / 2;
      const shapeTop = canvasY - SHAPE_BASE_SIZE / 2;

      const node: ShapeDocumentNode = {
        id: createRandomId(),
        type: "shape",
        data: {
          path: shapeData.path,
          fill: shapeData.fill ?? "#000000",
          fillRule: shapeData.fillRule,
          x: gridSize ? snapToGrid(shapeLeft, gridSize) : shapeLeft,
          y: gridSize ? snapToGrid(shapeTop, gridSize) : shapeTop,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          stroke: "#000000",
          strokeWidth: 0,
          opacity: 1,
          lockAspectRatio: false,
        },
      };

      addNode(node);
      setSelection([node.id]);
      return;
    }

    const assetId = event.dataTransfer.getData(DRAG_DATA_TYPE);
    if (!assetId) {
      return;
    }

    const asset = imageAssetById.get(assetId);
    if (!asset) {
      return;
    }

    event.preventDefault();

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;

    const canvasX = (pointerX - layerPosition.x) / effectiveScale;
    const canvasY = (pointerY - layerPosition.y) / effectiveScale;

    const node: ImageDocumentNode = {
      id: createRandomId(),
      type: "image",
      data: {
        assetId: asset.id,
        x: gridSize ? snapToGrid(canvasX, gridSize) : canvasX,
        y: gridSize ? snapToGrid(canvasY, gridSize) : canvasY,
        rotation: 0,
        opacity: 1,
        lockAspectRatio: false,
      },
    };

    addNode(node);
    setSelection([node.id]);
  };

  useEffect(() => {
    if (!pendingPlacement) {
      return;
    }

    if (!dieline) {
      return;
    }

    let isCancelled = false;

    const computeCenteredTopLeft = (width: number, height: number) => {
      const centerX = dieline.x + dieline.width / 2 - width / 2;
      const centerY = dieline.y + dieline.height / 2 - height / 2;

      return {
        x: gridSize ? snapToGrid(centerX, gridSize) : centerX,
        y: gridSize ? snapToGrid(centerY, gridSize) : centerY,
      };
    };

    if (pendingPlacement.type === "image") {
      const asset = imageAssetById.get(pendingPlacement.assetId);
      if (!asset) {
        consumePendingPlacement();
        return;
      }

      const finalizePlacement = (width: number, height: number) => {
        if (isCancelled) {
          return;
        }

        const usableWidth = width || DEFAULT_IMAGE_PLACEHOLDER_WIDTH;
        const usableHeight = height || DEFAULT_IMAGE_PLACEHOLDER_HEIGHT;
        const { x, y } = computeCenteredTopLeft(usableWidth, usableHeight);

        const node: ImageDocumentNode = {
          id: createRandomId(),
          type: "image",
          data: {
            assetId: asset.id,
            x,
            y,
            width: usableWidth,
            height: usableHeight,
            rotation: 0,
            opacity: 1,
            lockAspectRatio: false,
          },
        };

        addNode(node);
        setSelection([node.id]);
        consumePendingPlacement();
        isCancelled = true;
      };

      if (typeof window !== "undefined") {
        const image = new window.Image();
        image.onload = () => {
          finalizePlacement(image.width, image.height);
        };
        image.onerror = () => {
          finalizePlacement(
            DEFAULT_IMAGE_PLACEHOLDER_WIDTH,
            DEFAULT_IMAGE_PLACEHOLDER_HEIGHT,
          );
        };
        image.src = asset.url;

        return () => {
          isCancelled = true;
        };
      }

      finalizePlacement(
        DEFAULT_IMAGE_PLACEHOLDER_WIDTH,
        DEFAULT_IMAGE_PLACEHOLDER_HEIGHT,
      );

      return () => {
        isCancelled = true;
      };
    }

    if (pendingPlacement.type === "pdf") {
      const asset = pdfAssetById.get(pendingPlacement.assetId);
      if (!asset) {
        consumePendingPlacement();
        return;
      }

      const naturalWidth = pendingPlacement.width;
      const naturalHeight = pendingPlacement.height;
      const scale = Math.max(
        MIN_PDF_DIMENSION / Math.max(naturalWidth, 1),
        MIN_PDF_DIMENSION / Math.max(naturalHeight, 1),
        1,
      );
      const width = Math.max(naturalWidth * scale, MIN_PDF_DIMENSION);
      const height = Math.max(naturalHeight * scale, MIN_PDF_DIMENSION);
      const baseX = 100;
      const baseY = 100;
      const x = gridSize ? snapToGrid(baseX, gridSize) : baseX;
      const y = gridSize ? snapToGrid(baseY, gridSize) : baseY;

      const node: PdfDocumentNode = {
        id: createRandomId(),
        type: "pdf",
        data: {
          assetId: asset.id,
          pageNumber: pendingPlacement.pageNumber,
          imageUrl: pendingPlacement.imageUrl,
          x,
          y,
          width,
          height,
          rotation: 0,
          opacity: 1,
          lockAspectRatio: false,
        },
      };

      addNode(node);
      setSelection([node.id]);
      consumePendingPlacement();
      isCancelled = true;
    }

    return () => {
      isCancelled = true;
    };
  }, [
    addNode,
    consumePendingPlacement,
    dieline,
    gridSize,
    imageAssetById,
    pdfAssetById,
    pendingPlacement,
    setSelection,
  ]);

  const primarySelectedNodeId =
    selectedNodeIds[selectedNodeIds.length - 1] ?? null;

  const primarySelectedNode = useMemo(
    () =>
      primarySelectedNodeId
        ? nodes.find((node) => node.id === primarySelectedNodeId) ?? null
        : null,
    [nodes, primarySelectedNodeId],
  );

  const primaryLockAspectRatio = primarySelectedNode
    ? getNodeLockAspectRatio(primarySelectedNode)
    : false;

  const transformerAnchors = useMemo(
    () =>
      new Set<(typeof ALL_TRANSFORMER_ANCHORS)[number]>(
        primaryLockAspectRatio
          ? CORNER_TRANSFORMER_ANCHORS
          : ALL_TRANSFORMER_ANCHORS,
      ),
    [primaryLockAspectRatio],
  );

  const destroyBoundsRect = useCallback((nodeId: string) => {
    const rect = boundsRectRefs.current.get(nodeId);
    if (!rect) {
      return;
    }

    const layer = rect.getLayer();
    boundsRectRefs.current.delete(nodeId);
    rect.destroy();
    layer?.batchDraw();
  }, []);

  const updateBoundsRectForNode = useCallback(
    (nodeId: string) => {
      if (!showBounds) {
        destroyBoundsRect(nodeId);
        return;
      }

      const shape = selectedShapeRefs.current.get(nodeId);
      if (!shape) {
        destroyBoundsRect(nodeId);
        return;
      }

      const layer = shape.getLayer();
      if (!layer) {
        destroyBoundsRect(nodeId);
        return;
      }

      const clientRect = shape.getClientRect({ relativeTo: layer });
      let boundsRect = boundsRectRefs.current.get(nodeId);

      if (!boundsRect) {
        boundsRect = new Konva.Rect({
          name: "selection-bounds-rect",
          listening: false,
          stroke: "#22c55e",
          dash: [6, 4],
          strokeWidth: 1,
        });
        boundsRectRefs.current.set(nodeId, boundsRect);
        layer.add(boundsRect);
      }

      boundsRect.setAttrs({
        x: clientRect.x,
        y: clientRect.y,
        width: clientRect.width,
        height: clientRect.height,
        visible: true,
      });
      boundsRect.moveToTop();
      layer.batchDraw();
    },
    [destroyBoundsRect, showBounds],
  );

  const cancelScheduledSelectionBoundsUpdate = useCallback(() => {
    if (selectionBoundsAnimationFrameRef.current == null) {
      return;
    }

    if (typeof window !== "undefined") {
      window.cancelAnimationFrame(selectionBoundsAnimationFrameRef.current);
    }

    selectionBoundsAnimationFrameRef.current = null;
  }, []);

  const recomputeSelectionBounds = useCallback(() => {
    const shapeEntries = Array.from(selectedShapeRefs.current.values());

    if (!shapeEntries.length) {
      setSelectionBounds(null);
      return;
    }

    let stageRect: DOMRect | null = null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const shape of shapeEntries) {
      const stage = shape.getStage();
      if (!stage) {
        continue;
      }

      if (!stageRect) {
        stageRect = stage.container().getBoundingClientRect();
      }

      const rect = shape.getClientRect();
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    if (
      !stageRect ||
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      setSelectionBounds(null);
      return;
    }

    const nextBounds: SelectionViewportBounds = {
      left: stageRect.left + minX,
      top: stageRect.top + minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };

    setSelectionBounds((prev) => {
      if (
        prev &&
        prev.left === nextBounds.left &&
        prev.top === nextBounds.top &&
        prev.width === nextBounds.width &&
        prev.height === nextBounds.height
      ) {
        return prev;
      }

      return nextBounds;
    });
  }, []);

  const scheduleRecomputeSelectionBounds = useCallback(() => {
    if (typeof window === "undefined") {
      recomputeSelectionBounds();
      return;
    }

    cancelScheduledSelectionBoundsUpdate();

    selectionBoundsAnimationFrameRef.current = window.requestAnimationFrame(() => {
      selectionBoundsAnimationFrameRef.current = null;
      recomputeSelectionBounds();
    });
  }, [cancelScheduledSelectionBoundsUpdate, recomputeSelectionBounds]);

  useEffect(() => {
    const selectedSet = new Set(selectedNodeIds);
    const detachMap = detachSelectedShapeListenersRef.current;
    const shapeMap = selectedShapeRefs.current;

    for (const [nodeId, detach] of Array.from(detachMap.entries())) {
      if (!selectedSet.has(nodeId)) {
        detach();
        detachMap.delete(nodeId);
        shapeMap.delete(nodeId);
      }
    }

    if (!selectedSet.size) {
      cancelScheduledSelectionBoundsUpdate();
      setSelectionBounds(null);
      return;
    }

    scheduleRecomputeSelectionBounds();
  }, [
    cancelScheduledSelectionBoundsUpdate,
    scheduleRecomputeSelectionBounds,
    selectedNodeIds,
  ]);

  useEffect(() => {
    if (!selectedNodeIds.length) {
      return;
    }

    scheduleRecomputeSelectionBounds();
  }, [
    selectedNodeIds,
    scheduleRecomputeSelectionBounds,
    nodes,
    effectiveScale,
    layerPosition.x,
    layerPosition.y,
    stageSize.width,
    stageSize.height,
  ]);

  useEffect(() => {
    if (!showBounds) {
      const entries = Array.from(boundsRectRefs.current.keys());
      for (const nodeId of entries) {
        destroyBoundsRect(nodeId);
      }
      return;
    }

    for (const nodeId of selectedNodeIds) {
      updateBoundsRectForNode(nodeId);
    }
  }, [destroyBoundsRect, selectedNodeIds, showBounds, updateBoundsRectForNode]);

  useEffect(() => {
    if (!hasSelection) {
      return;
    }

    const handleWindowChange = () => {
      recomputeSelectionBounds();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [hasSelection, recomputeSelectionBounds]);

  useEffect(
    () => () => {
      for (const detach of detachSelectedShapeListenersRef.current.values()) {
        detach();
      }
      detachSelectedShapeListenersRef.current.clear();
      selectedShapeRefs.current.clear();
      for (const rect of boundsRectRefs.current.values()) {
        rect.destroy();
      }
      boundsRectRefs.current.clear();
      cancelScheduledSelectionBoundsUpdate();
    },
    [cancelScheduledSelectionBoundsUpdate],
  );

  useEffect(
    () => () => {
      if (
        typeof window !== "undefined" &&
        magnifierAnimationFrameRef.current != null
      ) {
        window.cancelAnimationFrame(magnifierAnimationFrameRef.current);
        magnifierAnimationFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    if (!primarySelectedNodeId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [primarySelectedNodeId]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    transformer.keepRatio(primaryLockAspectRatio);
    transformer.enabledAnchors(Array.from(transformerAnchors));
    transformer.getLayer()?.batchDraw();
  }, [primaryLockAspectRatio, transformerAnchors]);

  const handleStagePointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (isPrintPreview) {
        event.evt.preventDefault();
        return;
      }

      const stage = event.target.getStage();
      if (!stage) {
        return;
      }

      if (event.target === stage) {
        setSelection([]);
      }
    },
    [isPrintPreview, setSelection],
  );

  const handleStagePointerMove = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isPrintPreview) {
        return;
      }

      const stage = event.target.getStage();
      const container = containerRef.current;
      const pointer = getClientPoint(event.evt);

      if (!stage || !container || !pointer) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const left = pointer.clientX - bounds.left;
      const top = pointer.clientY - bounds.top;

      if (
        left < 0 ||
        top < 0 ||
        left > bounds.width ||
        top > bounds.height
      ) {
        setMagnifierPosition(null);
        clearMagnifier();
        return;
      }

      setMagnifierPosition((prev) => {
        if (prev && prev.left === left && prev.top === top) {
          return prev;
        }

        return { left, top };
      });

      const stagePointer = stage.getPointerPosition();
      if (!stagePointer) {
        return;
      }

      scheduleMagnifierRender(stage, {
        x: stagePointer.x,
        y: stagePointer.y,
      });
    },
    [
      clearMagnifier,
      isPrintPreview,
      scheduleMagnifierRender,
      setMagnifierPosition,
    ],
  );

  const handleStagePointerLeave = useCallback(
    () => {
      setMagnifierPosition(null);

      if (typeof window !== "undefined" && magnifierAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(magnifierAnimationFrameRef.current);
        magnifierAnimationFrameRef.current = null;
      }

      clearMagnifier();
    },
    [clearMagnifier],
  );

  const handleRotatePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!primarySelectedNode || !selectionBounds) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const centerX = selectionBounds.left + selectionBounds.width / 2;
      const centerY = selectionBounds.top + selectionBounds.height / 2;
      const startAngle = Math.atan2(
        event.clientY - centerY,
        event.clientX - centerX,
      );

      if (typeof document === "undefined") {
        return;
      }

      if (rotationSessionRef.current) {
        document.removeEventListener("pointermove", handleRotatePointerMove);
        document.removeEventListener("pointerup", handleRotatePointerUp);
        document.removeEventListener("pointercancel", handleRotatePointerUp);
        rotationSessionRef.current = null;
      }

      const initialRotation = normalizeRotation(
        getNodeRotationValue(primarySelectedNode),
      );

      rotationSessionRef.current = {
        nodeId: primarySelectedNode.id,
        pointerId: event.pointerId,
        centerX,
        centerY,
        startAngle,
        initialRotation,
        latestRotation: initialRotation,
      };

      document.addEventListener("pointermove", handleRotatePointerMove);
      document.addEventListener("pointerup", handleRotatePointerUp);
      document.addEventListener("pointercancel", handleRotatePointerUp);
    },
    [
      handleRotatePointerMove,
      handleRotatePointerUp,
      primarySelectedNode,
      selectionBounds,
    ],
  );

  const handleImageNodeChange = useCallback(
    (nodeId: string, updates: Partial<ImageDocumentNode["data"]>) => {
      const snappedUpdates = snapUpdatesToGrid(updates, gridSize);

      setNodes(
        nodes.map((node) => {
          if (!isImageNode(node) || node.id !== nodeId) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              ...snappedUpdates,
            },
          };
        }),
      );
    },
    [gridSize, nodes, setNodes],
  );

  const handlePdfNodeChange = useCallback(
    (nodeId: string, updates: Partial<PdfDocumentNode["data"]>) => {
      const snappedUpdates = snapUpdatesToGrid(updates, gridSize);

      setNodes(
        nodes.map((node) => {
          if (!isPdfNode(node) || node.id !== nodeId) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              ...snappedUpdates,
            },
          };
        }),
      );
    },
    [gridSize, nodes, setNodes],
  );

  const handleShapeNodeChange = useCallback(
    (nodeId: string, updates: Partial<ShapeDocumentNode["data"]>) => {
      const snappedUpdates = snapUpdatesToGrid(updates, gridSize);

      setNodes(
        nodes.map((node) => {
          if (!isShapeNode(node) || node.id !== nodeId) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              ...snappedUpdates,
            },
          };
        }),
      );
    },
    [gridSize, nodes, setNodes],
  );

  const handleTextNodeChange = useCallback(
    (nodeId: string, updates: Partial<TextNodeData>) => {
      const snappedUpdates = snapUpdatesToGrid(updates, gridSize);

      setNodes(
        nodes.map((node) => {
          if (!isTextNode(node) || node.id !== nodeId) {
            return node;
          }

          return {
            ...node,
            data: withUpdatedTextMetrics(node.data, snappedUpdates),
          };
        }),
      );
    },
    [gridSize, nodes, setNodes],
  );

  const handleTextEditRequest = useCallback(
    (node: TextDocumentNode, bounds: TextEditBounds) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const stageLeftOffset = bounds.stagePosition.left - containerRect.left;
      const stageTopOffset = bounds.stagePosition.top - containerRect.top;
      const rawLeft = stageLeftOffset + bounds.rect.x;
      const rawTop = stageTopOffset + bounds.rect.y;
      const rawWidth = Math.max(bounds.rect.width, MIN_TEXT_EDITOR_SIZE);
      const rawHeight = Math.max(bounds.rect.height, MIN_TEXT_EDITOR_SIZE);
      const centerX = rawLeft + rawWidth / 2;
      const centerY = rawTop + rawHeight / 2;
      const scale = effectiveScale || 1;
      const dimensions = calculateEditingDimensions(node.data, node.data.text, scale);
      const width = Math.max(rawWidth, dimensions.width);
      const height = Math.max(rawHeight, dimensions.height);
      const left = centerX - width / 2;
      const top = centerY - height / 2;

      setEditingText({
        id: node.id,
        value: node.data.text,
        originalValue: node.data.text,
        left,
        top,
        width,
        height,
        centerX,
        centerY,
        fontSize: node.data.fontSize * scale,
        fontFamily: node.data.fontFamily,
        fontWeight: node.data.fontWeight,
        color: node.data.fill,
        rotation: node.data.rotation,
        isCurved: node.data.isCurved,
        data: node.data,
        scale,
      });
      setSelection([node.id]);
    },
    [effectiveScale, setSelection],
  );

  const handleEditingChange = useCallback((value: string) => {
    setEditingText((prev) => {
      if (!prev) {
        return prev;
      }

      const dimensions = calculateEditingDimensions(prev.data, value, prev.scale);
      const left = prev.centerX - dimensions.width / 2;
      const top = prev.centerY - dimensions.height / 2;

      if (
        prev.value === value &&
        prev.width === dimensions.width &&
        prev.height === dimensions.height &&
        prev.left === left &&
        prev.top === top
      ) {
        return prev;
      }

      return {
        ...prev,
        value,
        width: dimensions.width,
        height: dimensions.height,
        left,
        top,
      };
    });
  }, []);

  const handleEditingCommit = useCallback(() => {
    if (!editingText) {
      return;
    }

    if (editingText.value !== editingText.originalValue) {
      handleTextNodeChange(editingText.id, { text: editingText.value });
    }

    setEditingText(null);
  }, [editingText, handleTextNodeChange]);

  const handleEditingCancel = useCallback(() => {
    setEditingText(null);
  }, []);

  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelection([nodeId]);
    },
    [setSelection],
  );

  const handleSelectedNodeRefChange = useCallback(
    (nodeId: string, shape: KonvaNode | null) => {
      const shapeMap = selectedShapeRefs.current;
      const detachMap = detachSelectedShapeListenersRef.current;
      const detach = detachMap.get(nodeId);

      if (!shape) {
        detach?.();
        detachMap.delete(nodeId);

        if (shapeMap.delete(nodeId)) {
          destroyBoundsRect(nodeId);
          cancelScheduledSelectionBoundsUpdate();
          if (!shapeMap.size) {
            setSelectionBounds(null);
          } else {
            scheduleRecomputeSelectionBounds();
          }
        } else {
          destroyBoundsRect(nodeId);
        }

        return;
      }

      if (shapeMap.get(nodeId) === shape) {
        updateBoundsRectForNode(nodeId);
        return;
      }

      detach?.();

      shapeMap.set(nodeId, shape);

      const handleShapeChange = () => {
        scheduleRecomputeSelectionBounds();
        updateBoundsRectForNode(nodeId);
      };

      shape.on("dragmove.selectionToolbar", handleShapeChange);
      shape.on("dragend.selectionToolbar", handleShapeChange);
      shape.on("transform.selectionToolbar", handleShapeChange);
      shape.on("transformend.selectionToolbar", handleShapeChange);

      detachMap.set(nodeId, () => {
        shape.off("dragmove.selectionToolbar", handleShapeChange);
        shape.off("dragend.selectionToolbar", handleShapeChange);
        shape.off("transform.selectionToolbar", handleShapeChange);
        shape.off("transformend.selectionToolbar", handleShapeChange);
      });

      updateBoundsRectForNode(nodeId);
      scheduleRecomputeSelectionBounds();
    },
    [
      cancelScheduledSelectionBoundsUpdate,
      destroyBoundsRect,
      scheduleRecomputeSelectionBounds,
      updateBoundsRectForNode,
    ],
  );

  const handleStageWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      if (isPrintPreview) {
        event.evt.preventDefault();
        return;
      }

      event.evt.preventDefault();

      if (event.evt.deltaY > 0) {
        zoomOutAction();
      } else if (event.evt.deltaY < 0) {
        zoomInAction();
      }
    },
    [isPrintPreview, zoomInAction, zoomOutAction],
  );

  const handleDeleteSelection = useCallback(() => {
    if (!selectedNodeIds.length) {
      return;
    }

    setEditingText(null);

    const transformer = transformerRef.current;
    if (transformer) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }

    const shapeMap = selectedShapeRefs.current;
    const detachMap = detachSelectedShapeListenersRef.current;

    for (const nodeId of selectedNodeIds) {
      const detach = detachMap.get(nodeId);
      if (detach) {
        detach();
        detachMap.delete(nodeId);
      }

      const shape = shapeMap.get(nodeId);
      if (shape) {
        const layer = shape.getLayer();
        shape.remove();
        layer?.batchDraw();
        shapeMap.delete(nodeId);
      } else {
        shapeMap.delete(nodeId);
      }

      destroyBoundsRect(nodeId);
    }

    cancelScheduledSelectionBoundsUpdate();
    setSelectionBounds(null);
    deleteSelection();
  }, [
    cancelScheduledSelectionBoundsUpdate,
    deleteSelection,
    destroyBoundsRect,
    selectedNodeIds,
    setEditingText,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!hasSelection) {
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (editingText) {
        return;
      }

      event.preventDefault();
      handleDeleteSelection();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingText, handleDeleteSelection, hasSelection]);

  useEffect(() => {
    if (!editingText) {
      return;
    }

    const node = nodes.find((item) => item.id === editingText.id);
    if (!node || !isTextNode(node)) {
      setEditingText(null);
      return;
    }

    const nextScale = effectiveScale || 1;
    const dimensions = calculateEditingDimensions(node.data, editingText.value, nextScale);
    const left = editingText.centerX - dimensions.width / 2;
    const top = editingText.centerY - dimensions.height / 2;
    const fontSize = node.data.fontSize * nextScale;

    setEditingText((prev) => {
      if (!prev) {
        return prev;
      }

      if (
        prev.data === node.data &&
        prev.scale === nextScale &&
        prev.width === dimensions.width &&
        prev.height === dimensions.height &&
        prev.left === left &&
        prev.top === top &&
        prev.fontSize === fontSize &&
        prev.fontFamily === node.data.fontFamily &&
        prev.fontWeight === node.data.fontWeight &&
        prev.color === node.data.fill &&
        prev.rotation === node.data.rotation &&
        prev.isCurved === node.data.isCurved
      ) {
        return prev;
      }

      return {
        ...prev,
        data: node.data,
        scale: nextScale,
        width: dimensions.width,
        height: dimensions.height,
        left,
        top,
        fontSize,
        fontFamily: node.data.fontFamily,
        fontWeight: node.data.fontWeight,
        color: node.data.fill,
        rotation: node.data.rotation,
        isCurved: node.data.isCurved,
      };
    });
  }, [editingText, effectiveScale, nodes]);

  const containerClassName =
    "relative flex h-full w-full max-w-[960px] flex-1 rounded-2xl bg-slate-100 shadow-inner";

  return (
    <section className="flex h-full min-h-[420px] w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-100/70 p-6 shadow-inner">
      <div
        ref={containerRef}
        className={containerClassName}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isReady ? (
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            rotation={canvasRotation}
            offsetX={stageSize.width / 2}
            offsetY={stageSize.height / 2}
            x={stageSize.width / 2}
            y={stageSize.height / 2}
            onMouseDown={handleStagePointerDown}
            onTouchStart={handleStagePointerDown}
            onMouseMove={handleStagePointerMove}
            onTouchMove={handleStagePointerMove}
            onMouseLeave={handleStagePointerLeave}
            onTouchEnd={handleStagePointerLeave}
            onWheel={handleStageWheel}
          >
            <Layer ref={handleBackgroundLayerRef} listening={false}>
              <Rect
                x={0}
                y={0}
                width={stageSize.width}
                height={stageSize.height}
                fill="#f8fafc"
              />
            </Layer>
            <Layer
              ref={handleDielineLayerRef}
              listening={false}
              scaleX={effectiveScale}
              scaleY={effectiveScale}
              x={layerPosition.x}
              y={layerPosition.y}
            >
              {dieline.paths.map((path) => (
                <Path
                  key={path.id}
                  data={path.data}
                  stroke={path.stroke}
                  strokeWidth={path.strokeWidth}
                  dash={path.dash}
                  listening={false}
                />
              ))}
            </Layer>
            {showGrid ? (
              <Layer
                ref={handleGridLayerRef}
                listening={false}
                scaleX={effectiveScale}
                scaleY={effectiveScale}
                x={layerPosition.x}
                y={layerPosition.y}
              >
                <GridOverlay
                  x={dieline.x}
                  y={dieline.y}
                  width={dieline.width}
                  height={dieline.height}
                  gridSize={GRID_SIZE}
                />
              </Layer>
            ) : null}
            <Layer
              ref={handleArtworkLayerRef}
              scaleX={effectiveScale}
              scaleY={effectiveScale}
              x={layerPosition.x}
              y={layerPosition.y}
            >
              {nodes.map((node) => {
                const isSelected = selectedNodeIds.includes(node.id);
                const isPrimarySelected = node.id === primarySelectedNodeId;
                const nodeBounds = getDocumentNodeBounds(node);
                const isOutsideByData =
                  !!dieline && nodeBounds
                    ? !isInsideDieline(dieline, nodeBounds)
                    : false;
                const baseOpacity = getNodeBaseOpacity(node);
                const nodeOpacity = clampOpacity(
                  baseOpacity * (isOutsideByData ? OUTSIDE_DIELINE_OPACITY : 1),
                );

                if (isImageNode(node)) {
                  const asset = imageAssetById.get(node.data.assetId);
                  if (!asset) {
                    return null;
                  }

                  return (
                    <CanvasImage
                      key={node.id}
                      node={node}
                      asset={asset}
                      transformerRef={transformerRef}
                      isSelected={isSelected}
                      isPrimarySelected={isPrimarySelected}
                      opacity={nodeOpacity}
                      onSelect={handleNodeSelect}
                      onChange={handleImageNodeChange}
                      onSelectedRefChange={handleSelectedNodeRefChange}
                      gridSize={gridSize}
                      dieline={dieline}
                    />
                  );
                }

                if (isPdfNode(node)) {
                  const asset = pdfAssetById.get(node.data.assetId);
                  if (!asset) {
                    return null;
                  }

                  return (
                    <CanvasPdf
                      key={node.id}
                      node={node}
                      asset={asset}
                      transformerRef={transformerRef}
                      isSelected={isSelected}
                      isPrimarySelected={isPrimarySelected}
                      opacity={nodeOpacity}
                      onSelect={handleNodeSelect}
                      onChange={handlePdfNodeChange}
                      onSelectedRefChange={handleSelectedNodeRefChange}
                      gridSize={gridSize}
                      dieline={dieline}
                    />
                  );
                }

                if (isShapeNode(node)) {
                  return (
                    <CanvasShape
                      key={node.id}
                      node={node}
                      transformerRef={transformerRef}
                      isSelected={isSelected}
                      isPrimarySelected={isPrimarySelected}
                      opacity={nodeOpacity}
                      onSelect={handleNodeSelect}
                      onChange={handleShapeNodeChange}
                      onSelectedRefChange={handleSelectedNodeRefChange}
                      gridSize={gridSize}
                      dieline={dieline}
                    />
                  );
                }

                if (isTextNode(node)) {
                  return (
                    <CanvasTextNodeComponent
                      key={node.id}
                      node={node}
                      transformerRef={transformerRef}
                      isSelected={isSelected}
                      isPrimarySelected={isPrimarySelected}
                      opacity={nodeOpacity}
                      onSelect={handleNodeSelect}
                      onChange={handleTextNodeChange}
                      onEditRequest={handleTextEditRequest}
                      onSelectedRefChange={handleSelectedNodeRefChange}
                      gridSize={gridSize}
                      dieline={dieline}
                    />
                  );
                }

                return null;
              })}
              <KonvaTransformer
                ref={transformerRef}
                borderStroke="#22c55e"
                borderStrokeWidth={1.5}
                anchorStroke="#16a34a"
                anchorFill="#bbf7d0"
                anchorSize={8}
                rotateEnabled={false}
                visible={showBounds}
                listening={showBounds}
                enabledAnchors={Array.from(transformerAnchors)}
                boundBoxFunc={(oldBox, newBox) =>
                  constrainBoundingBox(transformerRef, oldBox, newBox)
                }
              />
            </Layer>
          </Stage>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500">
            {error ? `Unable to load dieline: ${error}` : "Loading dieline..."}
          </div>
        )}
        <div
          className="pointer-events-none absolute z-30 flex items-center justify-center drop-shadow-xl"
          style={{
            left: magnifierPosition?.left ?? 0,
            top: magnifierPosition?.top ?? 0,
            width: MAGNIFIER_DIAMETER,
            height: MAGNIFIER_DIAMETER,
            transform: "translate(-50%, -50%)",
            visibility:
              isPrintPreview && magnifierPosition ? "visible" : "hidden",
            opacity: isPrintPreview && magnifierPosition ? 1 : 0,
          }}
        >
          <canvas
            ref={magnifierCanvasRef}
            className="h-full w-full rounded-full"
            data-testid="print-preview-magnifier"
          />
        </div>
        {editingText ? (
          <InlineTextEditor
            key={editingText.id}
            state={editingText}
            onChange={handleEditingChange}
            onCommit={handleEditingCommit}
            onCancel={handleEditingCancel}
          />
        ) : null}
        {hasSelection && selectionBounds ? (
          <>
            {!editingText ? (
              <RotationHandleOverlay
                bounds={selectionBounds}
                onPointerDown={handleRotatePointerDown}
              />
            ) : null}
            <SelectionToolbar
              bounds={selectionBounds}
              onDelete={handleDeleteSelection}
              showBoundingBox={showBounds}
              onToggleBoundingBox={handleToggleBounds}
              showGrid={showGrid}
              onToggleGrid={handleToggleGrid}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

interface RotationHandleOverlayProps {
  bounds: SelectionViewportBounds;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

function RotationHandleOverlay({
  bounds,
  onPointerDown,
}: RotationHandleOverlayProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const centerX = bounds.left + bounds.width / 2;
  const handleY = bounds.top - 40;

  return createPortal(
    <div
      className="fixed z-50 flex flex-col items-center gap-2"
      style={{ left: centerX, top: handleY, transform: "translate(-50%, -100%)" }}
    >
      <div className="h-6 w-px bg-emerald-400" />
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 bg-white text-base text-emerald-600 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
        aria-label="Rotate selection"
        title="Rotate selection"
        onPointerDown={onPointerDown}
      >
        ⟳
      </button>
    </div>,
    document.body,
  );
}

function GridOverlay({
  x,
  y,
  width,
  height,
  gridSize,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  gridSize: number;
}) {
  if (gridSize <= 0) {
    return null;
  }

  const columnCount = Math.ceil(width / gridSize) + 1;
  const rowCount = Math.ceil(height / gridSize) + 1;
  const verticalLines = [];
  const horizontalLines = [];

  for (let column = 0; column <= columnCount; column += 1) {
    const currentX = x + column * gridSize;
    const isMajor = column % GRID_MAJOR_LINE_INTERVAL === 0;

    verticalLines.push(
      <Line
        key={`grid-v-${column}`}
        points={[currentX, y, currentX, y + height]}
        stroke={isMajor ? GRID_MAJOR_LINE_COLOR : GRID_MINOR_LINE_COLOR}
        strokeWidth={isMajor ? 1.5 : 1}
        listening={false}
      />,
    );
  }

  for (let row = 0; row <= rowCount; row += 1) {
    const currentY = y + row * gridSize;
    const isMajor = row % GRID_MAJOR_LINE_INTERVAL === 0;

    horizontalLines.push(
      <Line
        key={`grid-h-${row}`}
        points={[x, currentY, x + width, currentY]}
        stroke={isMajor ? GRID_MAJOR_LINE_COLOR : GRID_MINOR_LINE_COLOR}
        strokeWidth={isMajor ? 1.5 : 1}
        listening={false}
      />,
    );
  }

  return (
    <>
      {verticalLines}
      {horizontalLines}
    </>
  );
}

function CanvasPdf({
  node,
  asset,
  transformerRef,
  isSelected,
  isPrimarySelected,
  opacity,
  onSelect,
  onChange,
  onSelectedRefChange,
  gridSize,
  dieline,
}: {
  node: PdfDocumentNode;
  asset: PdfAsset;
  transformerRef: RefObject<KonvaTransformerShape | null>;
  isSelected: boolean;
  isPrimarySelected: boolean;
  opacity: number;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, updates: Partial<PdfDocumentNode["data"]>) => void;
  onSelectedRefChange: (nodeId: string, shape: KonvaNode | null) => void;
  gridSize: number | null;
  dieline: DielineDocument | null;
}) {
  const image = useImage(node.data.imageUrl);
  const shapeRef = useRef<KonvaImageShape | null>(null);

  const { x, y, width, height, rotation, pageNumber } = node.data;

  useEffect(() => {
    const transformer = transformerRef.current;
    const shape = shapeRef.current;

    if (!transformer || !shape) {
      return;
    }

    if (isPrimarySelected) {
      transformer.nodes([shape]);
      transformer.getLayer()?.batchDraw();
    } else if (transformer.nodes()[0] === shape) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [image, isPrimarySelected, transformerRef]);

  useEffect(() => {
    const shape = shapeRef.current;

    if (isSelected && shape) {
      onSelectedRefChange(node.id, shape);
      return () => {
        onSelectedRefChange(node.id, null);
      };
    }

    onSelectedRefChange(node.id, null);

    return () => {
      onSelectedRefChange(node.id, null);
    };
  }, [image, isSelected, node.id, onSelectedRefChange]);

  if (!image) {
    return null;
  }

  if (!image) {
    return null;
  }

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const baseOpacity = clampOpacity(node.data.opacity ?? 1);

  return (
    <KonvaImageComponent
      ref={shapeRef}
      image={image}
      x={centerX}
      y={centerY}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      opacity={opacity}
      draggable
      name="pdf-page"
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDblClick={() => {
        if (typeof window !== "undefined") {
          const url = `${asset.url}#page=${pageNumber}`;
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
      onDblTap={() => {
        if (typeof window !== "undefined") {
          const url = `${asset.url}#page=${pageNumber}`;
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
      onDragMove={(event) => {
        const targetShape = event.target as KonvaImageShape;

        if (!gridSize) {
          updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
          return;
        }

        const layer = targetShape.getLayer();
        if (!layer) {
          return;
        }

        const { x: rectX, y: rectY } = targetShape.getClientRect({
          relativeTo: layer,
        });
        const snappedX = snapToGrid(rectX, gridSize);
        const snappedY = snapToGrid(rectY, gridSize);
        const deltaX = snappedX - rectX;
        const deltaY = snappedY - rectY;

        if (deltaX !== 0 || deltaY !== 0) {
          targetShape.x(targetShape.x() + deltaX);
          targetShape.y(targetShape.y() + deltaY);
        }

        updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
      }}
      onDragEnd={(event) => {
        const shape = event.target as KonvaImageShape;
        const layer = shape.getLayer();
        if (!layer) {
          return;
        }

        const { x: rectX, y: rectY } = shape.getClientRect({ relativeTo: layer });
        const snappedX = gridSize ? snapToGrid(rectX, gridSize) : rectX;
        const snappedY = gridSize ? snapToGrid(rectY, gridSize) : rectY;

        onChange(node.id, {
          x: snappedX,
          y: snappedY,
        });

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
      onTransformEnd={() => {
        const shape = shapeRef.current;
        if (!shape) {
          return;
        }

        const layer = shape.getLayer();
        if (!layer) {
          return;
        }

        const scaleX = shape.scaleX();
        const scaleY = shape.scaleY();

        const nextWidth = Math.max(
          MIN_PDF_DIMENSION,
          shape.width() * Math.abs(scaleX),
        );
        const nextHeight = Math.max(
          MIN_PDF_DIMENSION,
          shape.height() * Math.abs(scaleY),
        );

        const { x: rectX, y: rectY } = shape.getClientRect({ relativeTo: layer });

        shape.scaleX(1);
        shape.scaleY(1);

        onChange(node.id, {
          x: gridSize ? snapToGrid(rectX, gridSize) : rectX,
          y: gridSize ? snapToGrid(rectY, gridSize) : rectY,
          width: nextWidth,
          height: nextHeight,
          rotation: shape.rotation(),
        });

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
    />
  );
}

function CanvasImage({
  node,
  asset,
  transformerRef,
  isSelected,
  isPrimarySelected,
  opacity,
  onSelect,
  onChange,
  onSelectedRefChange,
  gridSize,
  dieline,
}: {
  node: ImageDocumentNode;
  asset: ImageAsset;
  transformerRef: RefObject<KonvaTransformerShape | null>;
  isSelected: boolean;
  isPrimarySelected: boolean;
  opacity: number;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, updates: Partial<ImageDocumentNode["data"]>) => void;
  onSelectedRefChange: (nodeId: string, shape: KonvaNode | null) => void;
  gridSize: number | null;
  dieline: DielineDocument | null;
}) {
  const image = useImage(asset.url);
  const shapeRef = useRef<KonvaImageShape | null>(null);

  const {
    x,
    y,
    width: storedWidth,
    height: storedHeight,
    rotation: storedRotation,
  } = node.data;

  useEffect(() => {
    if (!image) {
      return;
    }

    if (storedWidth == null || storedHeight == null) {
      onChange(node.id, { width: image.width, height: image.height });
    }
  }, [image, node.id, onChange, storedHeight, storedWidth]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const shape = shapeRef.current;

    if (!transformer || !shape) {
      return;
    }

    if (isPrimarySelected) {
      transformer.nodes([shape]);
      transformer.getLayer()?.batchDraw();
    } else if (transformer.nodes()[0] === shape) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [image, isPrimarySelected, transformerRef]);

  useEffect(() => {
    const shape = shapeRef.current;

    if (isSelected && shape) {
      onSelectedRefChange(node.id, shape);
      return () => {
        onSelectedRefChange(node.id, null);
      };
    }

    onSelectedRefChange(node.id, null);

    return () => {
      onSelectedRefChange(node.id, null);
    };
  }, [image, isSelected, node.id, onSelectedRefChange]);

  if (!image) {
    return null;
  }

  const width = storedWidth ?? image.width;
  const height = storedHeight ?? image.height;
  const rotation = storedRotation ?? 0;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const baseOpacity = clampOpacity(node.data.opacity ?? 1);

  return (
    <KonvaImageComponent
      ref={shapeRef}
      image={image}
      x={centerX}
      y={centerY}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      opacity={opacity}
      draggable
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragMove={(event) => {
        const targetShape = event.target as KonvaImageShape;

        if (!gridSize) {
          updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
          return;
        }

        const layer = targetShape.getLayer();
        if (!layer) {
          return;
        }

        const { x: rectX, y: rectY } = targetShape.getClientRect({
          relativeTo: layer,
        });
        const snappedX = snapToGrid(rectX, gridSize);
        const snappedY = snapToGrid(rectY, gridSize);
        const deltaX = snappedX - rectX;
        const deltaY = snappedY - rectY;

        if (deltaX !== 0 || deltaY !== 0) {
          targetShape.x(targetShape.x() + deltaX);
          targetShape.y(targetShape.y() + deltaY);
        }

        updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
      }}
      onDragEnd={(event) => {
        const shape = event.target as KonvaImageShape;
        const layer = shape.getLayer();
        if (!layer) {
          return;
        }

        const { x: rectX, y: rectY } = shape.getClientRect({ relativeTo: layer });
        const snappedX = gridSize ? snapToGrid(rectX, gridSize) : rectX;
        const snappedY = gridSize ? snapToGrid(rectY, gridSize) : rectY;

        onChange(node.id, {
          x: snappedX,
          y: snappedY,
        });

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
      onTransformEnd={() => {
        const shape = shapeRef.current;
        if (!shape) {
          return;
        }

        const layer = shape.getLayer();
        if (!layer) {
          return;
        }

        const scaleX = shape.scaleX();
        const scaleY = shape.scaleY();

        const nextWidth = Math.max(5, shape.width() * scaleX);
        const nextHeight = Math.max(5, shape.height() * scaleY);

        const { x: rectX, y: rectY } = shape.getClientRect({ relativeTo: layer });

        shape.scaleX(1);
        shape.scaleY(1);

        onChange(node.id, {
          x: gridSize ? snapToGrid(rectX, gridSize) : rectX,
          y: gridSize ? snapToGrid(rectY, gridSize) : rectY,
          width: nextWidth,
          height: nextHeight,
        });

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
    />
  );
}

function CanvasShape({
  node,
  transformerRef,
  isSelected,
  isPrimarySelected,
  opacity,
  onSelect,
  onChange,
  onSelectedRefChange,
  gridSize,
  dieline,
}: {
  node: ShapeDocumentNode;
  transformerRef: RefObject<KonvaTransformerShape | null>;
  isSelected: boolean;
  isPrimarySelected: boolean;
  opacity: number;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, updates: Partial<ShapeDocumentNode["data"]>) => void;
  onSelectedRefChange: (nodeId: string, shape: KonvaNode | null) => void;
  gridSize: number | null;
  dieline: DielineDocument | null;
}) {
  const shapeRef = useRef<KonvaPathShape | null>(null);

  const { path, x, y, scaleX, scaleY, rotation, fill, fillRule } = node.data;
  const { stroke, strokeWidth } = node.data;
  const width = SHAPE_BASE_SIZE * scaleX;
  const height = SHAPE_BASE_SIZE * scaleY;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const baseOpacity = clampOpacity(node.data.opacity ?? 1);

  useEffect(() => {
    const transformer = transformerRef.current;
    const shape = shapeRef.current;

    if (!transformer || !shape) {
      return;
    }

    if (isPrimarySelected) {
      transformer.nodes([shape]);
      transformer.getLayer()?.batchDraw();
    } else if (transformer.nodes()[0] === shape) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [isPrimarySelected, transformerRef]);

  useEffect(() => {
    const shape = shapeRef.current;

    if (isSelected && shape) {
      onSelectedRefChange(node.id, shape);
      return () => {
        onSelectedRefChange(node.id, null);
      };
    }

    onSelectedRefChange(node.id, null);

    return () => {
      onSelectedRefChange(node.id, null);
    };
  }, [isSelected, node.id, onSelectedRefChange]);

  return (
    <Path
      ref={shapeRef}
      data={path}
      x={centerX}
      y={centerY}
      scaleX={scaleX}
      scaleY={scaleY}
      offsetX={SHAPE_BASE_SIZE / 2}
      offsetY={SHAPE_BASE_SIZE / 2}
      rotation={rotation}
      fill={fill}
      fillRule={fillRule ?? "nonzero"}
      stroke={stroke ?? "transparent"}
      strokeWidth={strokeWidth ?? 0}
      opacity={opacity}
      draggable
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragMove={(event) => {
        const targetShape = event.target as KonvaPathShape;

        if (!gridSize) {
          updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
          return;
        }

        const layer = targetShape.getLayer();
        if (!layer) {
          return;
        }

        const { x: rectX, y: rectY } = targetShape.getClientRect({ relativeTo: layer });
        const snappedX = snapToGrid(rectX, gridSize);
        const snappedY = snapToGrid(rectY, gridSize);
        const deltaX = snappedX - rectX;
        const deltaY = snappedY - rectY;

        if (deltaX !== 0 || deltaY !== 0) {
          targetShape.x(targetShape.x() + deltaX);
          targetShape.y(targetShape.y() + deltaY);
        }

        updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
      }}
      onDragEnd={(event) => {
        const targetShape = event.target as KonvaPathShape;
        const layer = targetShape.getLayer();
        if (!layer) {
          return;
        }

        const { x: rectX, y: rectY } = targetShape.getClientRect({ relativeTo: layer });

        onChange(node.id, {
          x: gridSize ? snapToGrid(rectX, gridSize) : rectX,
          y: gridSize ? snapToGrid(rectY, gridSize) : rectY,
        });

        updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
      }}
      onTransformEnd={() => {
        const shape = shapeRef.current;
        if (!shape) {
          return;
        }

        const updates = getShapeNodeTransform(shape);

        shape.scaleX(updates.scaleX);
        shape.scaleY(updates.scaleY);

        onChange(node.id, {
          x: gridSize ? snapToGrid(updates.x, gridSize) : updates.x,
          y: gridSize ? snapToGrid(updates.y, gridSize) : updates.y,
          scaleX: updates.scaleX,
          scaleY: updates.scaleY,
          rotation: updates.rotation,
        });

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
    />
  );
}

function getShapeNodeTransform(shape: KonvaNode) {
  const { x: centerX, y: centerY } = shape.position();
  const rawScaleX = shape.scaleX();
  const rawScaleY = shape.scaleY();
  const scaleX = Math.max(MIN_SHAPE_SCALE, Math.abs(rawScaleX));
  const scaleY = Math.max(MIN_SHAPE_SCALE, Math.abs(rawScaleY));

  return {
    x: centerX - (SHAPE_BASE_SIZE * scaleX) / 2,
    y: centerY - (SHAPE_BASE_SIZE * scaleY) / 2,
    scaleX,
    scaleY,
    rotation: shape.rotation(),
  };
}

function snapToGrid(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}

function snapUpdatesToGrid<T extends Partial<{ x: number; y: number }>>(
  updates: T,
  gridSize: number | null,
): T {
  if (!gridSize) {
    return updates;
  }

  let didChange = false;
  const result: Partial<{ x: number; y: number }> = { ...updates };

  if (typeof updates.x === "number") {
    const snappedX = snapToGrid(updates.x, gridSize);
    if (snappedX !== updates.x) {
      result.x = snappedX;
      didChange = true;
    }
  }

  if (typeof updates.y === "number") {
    const snappedY = snapToGrid(updates.y, gridSize);
    if (snappedY !== updates.y) {
      result.y = snappedY;
      didChange = true;
    }
  }

  return didChange ? ({ ...updates, ...result } as T) : updates;
}

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function getNodeBaseOpacity(node: DocumentNode) {
  if (isImageNode(node)) {
    return clampOpacity(node.data.opacity ?? 1);
  }

  if (isPdfNode(node)) {
    return clampOpacity(node.data.opacity ?? 1);
  }

  if (isShapeNode(node)) {
    return clampOpacity(node.data.opacity ?? 1);
  }

  if (isTextNode(node)) {
    return clampOpacity(node.data.opacity ?? 1);
  }

  return 1;
}

function getNodeLockAspectRatio(node: DocumentNode) {
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

function getNodeRotationValue(node: DocumentNode) {
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

function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function snapRotation(value: number, step: number) {
  if (!Number.isFinite(value) || step <= 0) {
    return value;
  }

  return Math.round(value / step) * step;
}

function CanvasTextNodeComponent({
  node,
  transformerRef,
  isSelected,
  isPrimarySelected,
  opacity,
  onSelect,
  onChange,
  onEditRequest,
  onSelectedRefChange,
  gridSize,
  dieline,
}: {
  node: TextDocumentNode;
  transformerRef: RefObject<KonvaTransformerShape | null>;
  isSelected: boolean;
  isPrimarySelected: boolean;
  opacity: number;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, updates: Partial<TextNodeData>) => void;
  onEditRequest: (node: TextDocumentNode, bounds: TextEditBounds) => void;
  onSelectedRefChange: (nodeId: string, shape: KonvaNode | null) => void;
  gridSize: number | null;
  dieline: DielineDocument | null;
}) {
  if (node.data.isCurved) {
    return (
      <CanvasCurvedText
        node={node}
        transformerRef={transformerRef}
        isSelected={isSelected}
        isPrimarySelected={isPrimarySelected}
        opacity={opacity}
        onSelect={onSelect}
        onChange={onChange}
        onEditRequest={onEditRequest}
        onSelectedRefChange={onSelectedRefChange}
        gridSize={gridSize}
        dieline={dieline}
      />
    );
  }

  return (
    <CanvasStraightText
      node={node}
      transformerRef={transformerRef}
      isSelected={isSelected}
      isPrimarySelected={isPrimarySelected}
      opacity={opacity}
      onSelect={onSelect}
      onChange={onChange}
      onEditRequest={onEditRequest}
      onSelectedRefChange={onSelectedRefChange}
      gridSize={gridSize}
      dieline={dieline}
    />
  );
}

function CanvasStraightText({
  node,
  transformerRef,
  isSelected,
  isPrimarySelected,
  opacity,
  onSelect,
  onChange,
  onEditRequest,
  onSelectedRefChange,
  gridSize,
  dieline,
}: {
  node: TextDocumentNode;
  transformerRef: RefObject<KonvaTransformerShape | null>;
  isSelected: boolean;
  isPrimarySelected: boolean;
  opacity: number;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, updates: Partial<TextNodeData>) => void;
  onEditRequest: (node: TextDocumentNode, bounds: TextEditBounds) => void;
  onSelectedRefChange: (nodeId: string, shape: KonvaNode | null) => void;
  gridSize: number | null;
  dieline: DielineDocument | null;
}) {
  const textRef = useRef<KonvaTextShape | null>(null);

  const {
    text,
    x,
    y,
    rotation,
    fontFamily,
    fontSize,
    fontWeight,
    fill,
    letterSpacing,
    width,
    height,
  } = node.data;
  const baseOpacity = clampOpacity(node.data.opacity ?? 1);

  useEffect(() => {
    const transformer = transformerRef.current;
    const shape = textRef.current;

    if (!transformer || !shape) {
      return;
    }

    if (isPrimarySelected) {
      transformer.nodes([shape]);
      transformer.getLayer()?.batchDraw();
    } else if (transformer.nodes()[0] === shape) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [isPrimarySelected, transformerRef]);

  useEffect(() => {
    const shape = textRef.current;

    if (isSelected && shape) {
      onSelectedRefChange(node.id, shape);
      return () => {
        onSelectedRefChange(node.id, null);
      };
    }

    onSelectedRefChange(node.id, null);

    return () => {
      onSelectedRefChange(node.id, null);
    };
  }, [isSelected, node.id, onSelectedRefChange]);

  const handleEdit = useCallback(() => {
    const shape = textRef.current;
    if (!shape) {
      return;
    }

    const stage = shape.getStage();
    if (!stage) {
      return;
    }

    const rect = shape.getClientRect();
    const stageRect = stage.container().getBoundingClientRect();
    onEditRequest(node, {
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      stagePosition: { left: stageRect.left, top: stageRect.top },
    });
  }, [node, onEditRequest]);

  return (
    <KonvaTextComponent
      ref={textRef}
      text={text}
      x={x}
      y={y}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      fontFamily={fontFamily}
      fontSize={fontSize}
      fontStyle={fontWeightToFontStyle(fontWeight)}
      fill={fill}
      letterSpacing={letterSpacing}
      opacity={opacity}
      draggable
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        handleEdit();
      }}
      onDblTap={(event) => {
        event.cancelBubble = true;
        handleEdit();
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragMove={(event) => {
        const shape = event.target as KonvaTextShape;

        if (!gridSize) {
          updateShapeOpacityForDieline(shape, dieline, baseOpacity);
          return;
        }

        const layer = shape.getLayer();
        if (!layer) {
          return;
        }

        const rect = shape.getClientRect({ relativeTo: layer });
        const snappedX = snapToGrid(rect.x, gridSize);
        const snappedY = snapToGrid(rect.y, gridSize);
        const deltaX = snappedX - rect.x;
        const deltaY = snappedY - rect.y;

        if (deltaX !== 0 || deltaY !== 0) {
          shape.x(shape.x() + deltaX);
          shape.y(shape.y() + deltaY);
        }

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
      onDragEnd={(event) => {
        const targetShape = event.target as KonvaTextShape;
        const nextX = gridSize ? snapToGrid(targetShape.x(), gridSize) : targetShape.x();
        const nextY = gridSize ? snapToGrid(targetShape.y(), gridSize) : targetShape.y();

        onChange(node.id, {
          x: nextX,
          y: nextY,
        });

        updateShapeOpacityForDieline(targetShape, dieline, baseOpacity);
      }}
      onTransformEnd={() => {
        const shape = textRef.current;
        if (!shape) {
          return;
        }

        const scaleX = Math.abs(shape.scaleX());
        const scaleY = Math.abs(shape.scaleY());
        const nextFontSize = Math.max(4, fontSize * scaleY);
        const nextLetterSpacing = letterSpacing * scaleX;

        shape.scaleX(1);
        shape.scaleY(1);

        onChange(node.id, {
          x: gridSize ? snapToGrid(shape.x(), gridSize) : shape.x(),
          y: gridSize ? snapToGrid(shape.y(), gridSize) : shape.y(),
          rotation: shape.rotation(),
          fontSize: nextFontSize,
          letterSpacing: nextLetterSpacing,
        });

        updateShapeOpacityForDieline(shape, dieline, baseOpacity);
      }}
    />
  );
}

function CanvasCurvedText({
  node,
  transformerRef,
  isSelected,
  isPrimarySelected,
  opacity,
  onSelect,
  onChange,
  onEditRequest,
  onSelectedRefChange,
  gridSize,
  dieline,
}: {
  node: TextDocumentNode;
  transformerRef: RefObject<KonvaTransformerShape | null>;
  isSelected: boolean;
  isPrimarySelected: boolean;
  opacity: number;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, updates: Partial<TextNodeData>) => void;
  onEditRequest: (node: TextDocumentNode, bounds: TextEditBounds) => void;
  onSelectedRefChange: (nodeId: string, shape: KonvaNode | null) => void;
  gridSize: number | null;
  dieline: DielineDocument | null;
}) {
  const groupRef = useRef<KonvaGroupShape | null>(null);
  const baseOpacity = clampOpacity(node.data.opacity ?? 1);

  const layout = useMemo(
    () =>
      computeCurvedTextLayout({
        text: node.data.text,
        fontFamily: node.data.fontFamily,
        fontSize: node.data.fontSize,
        fontWeight: node.data.fontWeight,
        letterSpacing: node.data.letterSpacing,
        radius: node.data.radius,
        angle: node.data.angle,
      }),
    [
      node.data.angle,
      node.data.fontFamily,
      node.data.fontSize,
      node.data.fontWeight,
      node.data.letterSpacing,
      node.data.radius,
      node.data.text,
    ],
  );

  const hitPadding = useMemo(
    () => Math.max(node.data.fontSize * 0.15, 4),
    [node.data.fontSize],
  );
  const hitRectWidth = layout.width + hitPadding * 2;
  const hitRectHeight = layout.height + hitPadding * 2;

  useEffect(() => {
    const transformer = transformerRef.current;
    const group = groupRef.current;

    if (!transformer || !group) {
      return;
    }

    if (isPrimarySelected) {
      transformer.nodes([group]);
      transformer.getLayer()?.batchDraw();
    } else if (transformer.nodes()[0] === group) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [isPrimarySelected, transformerRef]);

  useEffect(() => {
    const group = groupRef.current;

    if (isSelected && group) {
      onSelectedRefChange(node.id, group);
      return () => {
        onSelectedRefChange(node.id, null);
      };
    }

    onSelectedRefChange(node.id, null);

    return () => {
      onSelectedRefChange(node.id, null);
    };
  }, [isSelected, node.id, onSelectedRefChange]);

  const handleEdit = useCallback(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const stage = group.getStage();
    if (!stage) {
      return;
    }

    const rect = group.getClientRect();
    const stageRect = stage.container().getBoundingClientRect();
    onEditRequest(node, {
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      stagePosition: { left: stageRect.left, top: stageRect.top },
    });
  }, [node, onEditRequest]);

  return (
    <Group
      ref={groupRef}
      x={node.data.x}
      y={node.data.y}
      rotation={node.data.rotation}
      opacity={opacity}
      draggable
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        handleEdit();
      }}
      onDblTap={(event) => {
        event.cancelBubble = true;
        handleEdit();
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
        onSelect(node.id);
      }}
      onDragMove={(event) => {
        const group = event.target as KonvaGroupShape;

        if (!gridSize) {
          updateShapeOpacityForDieline(group, dieline, baseOpacity);
          return;
        }

        const layer = group.getLayer();
        if (!layer) {
          return;
        }

        const rect = group.getClientRect({ relativeTo: layer });
        const snappedX = snapToGrid(rect.x, gridSize);
        const snappedY = snapToGrid(rect.y, gridSize);
        const deltaX = snappedX - rect.x;
        const deltaY = snappedY - rect.y;

        if (deltaX !== 0 || deltaY !== 0) {
          group.x(group.x() + deltaX);
          group.y(group.y() + deltaY);
        }

        updateShapeOpacityForDieline(group, dieline, baseOpacity);
      }}
      onDragEnd={(event) => {
        const group = event.target as KonvaGroupShape;
        const nextX = gridSize ? snapToGrid(group.x(), gridSize) : group.x();
        const nextY = gridSize ? snapToGrid(group.y(), gridSize) : group.y();

        onChange(node.id, {
          x: nextX,
          y: nextY,
        });

        updateShapeOpacityForDieline(group, dieline, baseOpacity);
      }}
      onTransformEnd={() => {
        const group = groupRef.current;
        if (!group) {
          return;
        }

        const scaleX = Math.abs(group.scaleX());
        const scaleY = Math.abs(group.scaleY());
        const averageScale = (scaleX + scaleY) / 2;
        const nextFontSize = Math.max(4, node.data.fontSize * averageScale);
        const nextRadius = Math.max(10, node.data.radius * scaleX);
        const nextLetterSpacing = node.data.letterSpacing * scaleX;

        group.scaleX(1);
        group.scaleY(1);

        onChange(node.id, {
          x: gridSize ? snapToGrid(group.x(), gridSize) : group.x(),
          y: gridSize ? snapToGrid(group.y(), gridSize) : group.y(),
          rotation: group.rotation(),
          fontSize: nextFontSize,
          radius: nextRadius,
          letterSpacing: nextLetterSpacing,
        });

        updateShapeOpacityForDieline(group, dieline, baseOpacity);
      }}
    >
      <Rect
        x={-hitRectWidth / 2}
        y={-hitRectHeight / 2}
        width={hitRectWidth}
        height={hitRectHeight}
        fill="rgba(0,0,0,0)"
        strokeEnabled={false}
        listening
      />
      {layout.glyphs.length ? (
        layout.glyphs.map((glyph, index) => (
          <KonvaTextComponent
            key={`${node.id}-glyph-${index}`}
            text={glyph.char}
            x={glyph.x}
            y={glyph.y}
            offsetX={glyph.width / 2}
            offsetY={glyph.height / 2}
            fontFamily={node.data.fontFamily}
            fontSize={node.data.fontSize}
            fontStyle={fontWeightToFontStyle(node.data.fontWeight)}
            fill={node.data.fill}
            rotation={glyph.rotation}
          />
        ))
      ) : (
        <KonvaTextComponent
          text=""
          x={0}
          y={0}
          fontFamily={node.data.fontFamily}
          fontSize={node.data.fontSize}
          fontStyle={fontWeightToFontStyle(node.data.fontWeight)}
          fill={node.data.fill}
        />
      )}
    </Group>
  );
}

function getDocumentNodeBounds(node: DocumentNode): NodeBounds | null {
  if (isImageNode(node)) {
    const width = node.data.width ?? 0;
    const height = node.data.height ?? 0;

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: node.data.x,
      y: node.data.y,
      width,
      height,
    };
  }

  if (isShapeNode(node)) {
    const width = Math.abs(SHAPE_BASE_SIZE * node.data.scaleX);
    const height = Math.abs(SHAPE_BASE_SIZE * node.data.scaleY);

    return {
      x: node.data.x,
      y: node.data.y,
      width,
      height,
    };
  }

  if (isPdfNode(node)) {
    const width = node.data.width;
    const height = node.data.height;

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: node.data.x,
      y: node.data.y,
      width,
      height,
    };
  }

  if (isTextNode(node)) {
    const width = node.data.width;
    const height = node.data.height;

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: node.data.x - width / 2,
      y: node.data.y - height / 2,
      width,
      height,
    };
  }

  return null;
}

function updateShapeOpacityForDieline(
  shape: KonvaNode | null,
  dieline: DielineDocument | null,
  baseOpacity: number,
) {
  if (!shape) {
    return;
  }

  const layer = shape.getLayer();
  if (!layer) {
    return;
  }

  const resolvedBaseOpacity = clampOpacity(baseOpacity);

  if (!dieline) {
    if (shape.opacity() !== resolvedBaseOpacity) {
      shape.opacity(resolvedBaseOpacity);
      layer.batchDraw();
    }
    return;
  }

  const rect = shape.getClientRect({ relativeTo: layer });
  const bounds: NodeBounds = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };

  const isInside = isInsideDieline(dieline, bounds);
  const nextOpacity = clampOpacity(
    resolvedBaseOpacity * (isInside ? 1 : OUTSIDE_DIELINE_OPACITY),
  );

  if (shape.opacity() !== nextOpacity) {
    shape.opacity(nextOpacity);
    layer.batchDraw();
  }
}

function InlineTextEditor({
  state,
  onChange,
  onCommit,
  onCancel,
}: {
  state: EditingTextState;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  }, [state.id]);

  return (
    <textarea
      ref={textareaRef}
      className="absolute z-10 rounded-lg border border-blue-400 bg-white/95 p-2 text-slate-900 shadow-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      style={{
        left: `${state.left}px`,
        top: `${state.top}px`,
        width: `${state.width}px`,
        height: `${state.height}px`,
        fontFamily: state.fontFamily,
        fontSize: `${state.fontSize}px`,
        fontWeight: Number(state.fontWeight),
        color: state.color,
        lineHeight: 1.2,
        resize: "none",
        whiteSpace: "pre-wrap",
      }}
      spellCheck={false}
      value={state.value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onCommit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

type ShapeDragData = {
  path: string;
  fill?: string;
  fillRule?: CanvasFillRule;
};

function snapDocumentNodeToGrid(node: DocumentNode, gridSize: number): DocumentNode {
  if (isImageNode(node)) {
    const snappedData = snapUpdatesToGrid(node.data, gridSize);
    if (snappedData === node.data) {
      return node;
    }

    return {
      ...node,
      data: snappedData,
    };
  }

  if (isPdfNode(node)) {
    const snappedData = snapUpdatesToGrid(node.data, gridSize);
    if (snappedData === node.data) {
      return node;
    }

    return {
      ...node,
      data: snappedData,
    };
  }

  if (isShapeNode(node)) {
    const snappedData = snapUpdatesToGrid(node.data, gridSize);
    if (snappedData === node.data) {
      return node;
    }

    return {
      ...node,
      data: snappedData,
    };
  }

  if (isTextNode(node)) {
    const snappedData = snapUpdatesToGrid(node.data, gridSize);
    if (snappedData === node.data) {
      return node;
    }

    return {
      ...node,
      data: snappedData,
    };
  }

  return node;
}

function calculateEditingDimensions(
  data: TextNodeData,
  value: string,
  scale: number,
) {
  const safeScale = scale > 0 ? scale : 1;

  if (data.isCurved) {
    const layout = computeCurvedTextLayout({
      text: value,
      fontFamily: data.fontFamily,
      fontSize: data.fontSize,
      fontWeight: data.fontWeight,
      letterSpacing: data.letterSpacing,
      radius: data.radius,
      angle: data.angle,
    });

    const baseWidth = Math.max(layout.width, data.fontSize);
    const baseHeight = Math.max(layout.height, data.fontSize);

    return {
      width: Math.max(MIN_TEXT_EDITOR_SIZE, baseWidth * safeScale),
      height: Math.max(MIN_TEXT_EDITOR_SIZE, baseHeight * safeScale),
    };
  }

  const metrics = measureStraightText({
    text: value,
    fontFamily: data.fontFamily,
    fontSize: data.fontSize,
    fontWeight: data.fontWeight,
    letterSpacing: data.letterSpacing,
  });

  const baseWidth = Math.max(metrics.width, data.fontSize);
  const baseHeight = Math.max(metrics.height, data.fontSize);

  return {
    width: Math.max(MIN_TEXT_EDITOR_SIZE, baseWidth * safeScale),
    height: Math.max(MIN_TEXT_EDITOR_SIZE, baseHeight * safeScale),
  };
}

function parseShapeDragData(value: string): ShapeDragData | null {
  try {
    const parsed = JSON.parse(value) as ShapeDragData | null;
    if (!parsed || typeof parsed.path !== "string" || parsed.path.length === 0) {
      return null;
    }

    if (parsed.fill != null && typeof parsed.fill !== "string") {
      return null;
    }

    if (
      parsed.fillRule != null &&
      parsed.fillRule !== "nonzero" &&
      parsed.fillRule !== "evenodd"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function constrainBoundingBox(
  transformerRef: RefObject<KonvaTransformerShape | null>,
  oldBox: BoundingBox,
  newBox: BoundingBox,
) {
  const transformer = transformerRef.current;
  if (!transformer) {
    return newBox;
  }

  const activeAnchor = transformer.getActiveAnchor();
  if (!activeAnchor) {
    return newBox;
  }

  const resolvedRotation = Number.isFinite(newBox.rotation)
    ? newBox.rotation
    : Number.isFinite(oldBox.rotation)
      ? oldBox.rotation
      : 0;

  if (CORNER_ANCHORS.has(activeAnchor)) {
    const oppositeX = activeAnchor.includes("left")
      ? oldBox.x + oldBox.width
      : oldBox.x;
    const oppositeY = activeAnchor.includes("top")
      ? oldBox.y + oldBox.height
      : oldBox.y;

    const widthScale =
      oldBox.width === 0 ? 1 : Math.abs(newBox.width / oldBox.width);
    const heightScale =
      oldBox.height === 0 ? 1 : Math.abs(newBox.height / oldBox.height);
    const scale = Math.max(widthScale, heightScale);

    const width = Math.max(MIN_TRANSFORM_SIZE, oldBox.width * scale);
    const height = Math.max(MIN_TRANSFORM_SIZE, oldBox.height * scale);

    return {
      x: activeAnchor.includes("left") ? oppositeX - width : oppositeX,
      y: activeAnchor.includes("top") ? oppositeY - height : oppositeY,
      width,
      height,
      rotation: resolvedRotation,
    };
  }

  return applyMinSizeConstraint(activeAnchor, oldBox, newBox, resolvedRotation);
}

function applyMinSizeConstraint(
  activeAnchor: string,
  oldBox: BoundingBox,
  newBox: BoundingBox,
  fallbackRotation: number,
) {
  let { width, height } = newBox;
  let { x, y } = newBox;
  const rotation = Number.isFinite(newBox.rotation)
    ? newBox.rotation
    : Number.isFinite(oldBox.rotation)
      ? oldBox.rotation
      : fallbackRotation;

  if (width < MIN_TRANSFORM_SIZE) {
    width = MIN_TRANSFORM_SIZE;
    const oppositeX = activeAnchor.includes("left")
      ? oldBox.x + oldBox.width
      : oldBox.x;
    x = activeAnchor.includes("left") ? oppositeX - width : oppositeX;
  }

  if (height < MIN_TRANSFORM_SIZE) {
    height = MIN_TRANSFORM_SIZE;
    const oppositeY = activeAnchor.includes("top")
      ? oldBox.y + oldBox.height
      : oldBox.y;
    y = activeAnchor.includes("top") ? oppositeY - height : oppositeY;
  }

  return { x, y, width, height, rotation };
}

function useImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      setImage(img);
    };
    img.src = url;

    return () => {
      img.onload = null;
    };
  }, [url]);

  return image;
}
