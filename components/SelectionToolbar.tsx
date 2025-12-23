"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Bounds = { left: number; top: number; width: number; height: number };
type ToolbarPosition = { left: number; top: number };

interface SelectionToolbarProps {
  bounds: Bounds;
  onDelete: () => void;
  showBoundingBox: boolean;
  onToggleBoundingBox: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}

const MARGIN = 12;

export default function SelectionToolbar({
  bounds,
  onDelete,
  showBoundingBox,
  onToggleBoundingBox,
  showGrid,
  onToggleGrid,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<ToolbarPosition>(() =>
    getFallbackPosition(bounds),
  );

  const updatePosition = useCallback(() => {
    const element = toolbarRef.current;
    if (!element) {
      setPosition((prev) => {
        const fallback = getFallbackPosition(bounds);
        return positionsEqual(prev, fallback) ? prev : fallback;
      });
      return;
    }

    const nextPosition = calculateToolbarPosition(bounds, element);
    if (!nextPosition) {
      setPosition((prev) => {
        const fallback = getFallbackPosition(bounds);
        return positionsEqual(prev, fallback) ? prev : fallback;
      });
      return;
    }

    setPosition((prev) =>
      positionsEqual(prev, nextPosition) ? prev : nextPosition,
    );
  }, [bounds]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleWindowChange = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const handleViewportChange = () => {
      updatePosition();
    };

    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);

    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const element = toolbarRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updatePosition();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [updatePosition]);

  if (typeof document === "undefined") {
    return null;
  }

  const toggleBaseClass =
    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const toggleActiveClass = "border-slate-900 bg-slate-900 text-white focus-visible:ring-slate-400/60";
  const toggleInactiveClass =
    "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 focus-visible:ring-slate-300/60";
  const deleteButtonClass =
    "rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60";

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-lg"
      style={{ left: position.left, top: position.top }}
    >
      <button
        type="button"
        className={deleteButtonClass}
        onClick={onDelete}
        title="Delete selection"
        aria-label="Delete selection"
      >
        Delete
      </button>
      <button
        type="button"
        className={`${toggleBaseClass} ${
          showBoundingBox ? toggleActiveClass : toggleInactiveClass
        }`}
        aria-pressed={showBoundingBox}
        onClick={onToggleBoundingBox}
        title={showBoundingBox ? "Hide bounds" : "Show bounds"}
        aria-label={showBoundingBox ? "Hide bounds" : "Show bounds"}
      >
        Bounds
      </button>
      <button
        type="button"
        className={`${toggleBaseClass} ${
          showGrid ? toggleActiveClass : toggleInactiveClass
        }`}
        aria-pressed={showGrid}
        onClick={onToggleGrid}
        title={showGrid ? "Hide grid overlay" : "Show grid overlay"}
        aria-label={showGrid ? "Hide grid overlay" : "Show grid overlay"}
      >
        Grid
      </button>
    </div>,
    document.body,
  );
}

function calculateToolbarPosition(bounds: Bounds, element: HTMLDivElement) {
  if (typeof window === "undefined") {
    return null;
  }

  const { width, height } = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const desiredLeft = bounds.left + bounds.width / 2 - width / 2;
  const maxLeft = viewportWidth - width - MARGIN;
  const clampedLeft = Math.min(
    Math.max(MARGIN, desiredLeft),
    Math.max(MARGIN, maxLeft),
  );

  let desiredTop = bounds.top - height - MARGIN;
  if (desiredTop < MARGIN) {
    desiredTop = bounds.top + bounds.height + MARGIN;
  }

  const maxTop = viewportHeight - height - MARGIN;
  const clampedTop = Math.min(
    Math.max(MARGIN, desiredTop),
    Math.max(MARGIN, maxTop),
  );

  return { left: clampedLeft, top: clampedTop };
}

function getFallbackPosition(bounds: Bounds): ToolbarPosition {
  return {
    left: bounds.left + bounds.width / 2,
    top: bounds.top - MARGIN,
  };
}

function positionsEqual(a: ToolbarPosition, b: ToolbarPosition) {
  return a.left === b.left && a.top === b.top;
}
