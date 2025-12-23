"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ImagePanel from "./ImagePanel";
import PdfPanel from "./PdfPanel";
import ShapesPanel from "./ShapesPanel";
import TextPanel from "./TextPanel";
import { PanelKey, useDocumentActions, useDocumentStore } from "@/lib/store";

type ToolbarAction =
  | "zoomIn"
  | "resetZoom"
  | "zoomOut"
  | "rotateSelection"
  | "openProperties";

type ToolbarItem = {
  label: string;
  icon: string;
  panel?: PanelKey;
  action?: ToolbarAction;
  requiresSelection?: boolean;
};

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { label: "Pdf", panel: "pdf", icon: "la la-file-pdf" },
  { label: "Add Image", panel: "addImage", icon: "la la-file-image" },
  { label: "Shapes", panel: "shapes", icon: "la la-shapes" },
  { label: "Add Text", panel: "addText", icon: "la la-font" },
  { label: "Blocks", panel: "blocks", icon: "la la-layer-group" },
  { label: "Save/Load Project", panel: "project", icon: "la la-save" },
  { label: "More", panel: "more", icon: "la la-ellipsis-h" },
  {
    label: "Properties",
    icon: "la la-sliders-h",
    action: "openProperties",
    requiresSelection: true,
  },
  { label: "Rotate", icon: "la la-sync-alt", action: "rotateSelection" },
  { label: "Zoom In", icon: "la la-search-plus", action: "zoomIn" },
  { label: "100%", icon: "la la-percent", action: "resetZoom" },
  { label: "Zoom Out", icon: "la la-search-minus", action: "zoomOut" },
];

const baseButtonStyles =
  "group m-0 flex w-full flex-col items-center justify-center gap-1 rounded-xl p-1.5 text-center text-blue-700 transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";
const inactiveStyles = "bg-white hover:bg-[#ea7a61] hover:text-white";
const activeStyles =
  "bg-blue-50 text-blue-700 ring-1 ring-blue-500 hover:bg-[#ea7a61] hover:text-white";

const POPUP_PANEL_KEYS: Set<PanelKey> = new Set([
  "pdf",
  "addImage",
  "shapes",
  "addText",
]);

export default function LeftToolbar() {
  const openPanel = useDocumentStore((state) => state.openPanel);
  const { setOpenPanel, zoomIn, resetZoom, zoomOut, rotateSelectionClockwise } =
    useDocumentActions();
  const selection = useDocumentStore((state) => state.selection);
  const hasSelection = selection.length > 0;
  const setPropertiesPanelOpen = useDocumentStore(
    (state) => state.setPropertiesPanelOpen,
  );
  const isPropertiesPanelOpen = useDocumentStore(
    (state) => state.isPropertiesPanelOpen,
  );
  const [isWide, setIsWide] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [sidebarRect, setSidebarRect] = useState<DOMRect | null>(null);

  const sidebarWidthClass = isWide ? "w-[128px]" : "w-[88px]";

  let panelContent: JSX.Element | null = null;
  if (openPanel === "pdf") {
    panelContent = <PdfPanel />;
  } else if (openPanel === "addImage") {
    panelContent = <ImagePanel />;
  } else if (openPanel === "shapes") {
    panelContent = <ShapesPanel />;
  } else if (openPanel === "addText") {
    panelContent = <TextPanel />;
  }

  const showPopup = openPanel ? POPUP_PANEL_KEYS.has(openPanel) : false;

  const activeToolbarItem = useMemo(
    () => TOOLBAR_ITEMS.find((item) => item.panel === openPanel),
    [openPanel],
  );

  const updateSidebarRect = useCallback(() => {
    if (!sidebarRef.current) {
      return;
    }

    setSidebarRect(sidebarRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    updateSidebarRect();
  }, [isWide, openPanel, updateSidebarRect]);

  useEffect(() => {
    const handleResize = () => updateSidebarRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [updateSidebarRect]);

  useEffect(() => {
    if (!showPopup) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setOpenPanel, showPopup]);

  const popupLeft = sidebarRect ? sidebarRect.right + 16 : 280;

  const handleSelect = (panel: PanelKey) => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const propertiesButtonTitle = hasSelection
    ? "Open the properties panel"
    : "Select an object to view properties.";

  const handleAction = (action: ToolbarAction) => {
    if (action === "zoomIn") zoomIn();
    if (action === "resetZoom") resetZoom();
    if (action === "zoomOut") zoomOut();
    if (action === "rotateSelection") rotateSelectionClockwise();
    if (action === "openProperties") {
      if (!hasSelection) {
        return;
      }
      setPropertiesPanelOpen(true);
    }
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`sidebar flex h-screen ${sidebarWidthClass} flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-sm`}
      >
      <header className="sr-only">
        <span>Toolbox</span>
        <h2>Editing Controls</h2>
      </header>

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="px-2 pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-pressed={isWide}
            onClick={() => setIsWide((prev) => !prev)}
          >
            <span aria-hidden className="text-base">
              {isWide ? "↔" : "⤢"}
            </span>
            <span>{isWide ? "Narrow toolbar" : "Wider toolbar"}</span>
          </button>
        </div>

        <nav className="flex flex-1 flex-col items-stretch gap-2 overflow-y-auto px-2 pb-2">
          {TOOLBAR_ITEMS.map(
            ({ label, panel, icon, action, requiresSelection }) => {
              const isActionActive =
                action === "openProperties" ? isPropertiesPanelOpen : false;
              const isActive = panel ? openPanel === panel : isActionActive;
              const isDisabled = Boolean(
                requiresSelection && !hasSelection,
              );
              const buttonClasses = `${baseButtonStyles} ${
                isActive ? activeStyles : inactiveStyles
              } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`;
              const ariaPressed = panel
                ? isActive
                : action === "openProperties"
                  ? isPropertiesPanelOpen
                  : undefined;

              return (
                <button
                  key={label}
                  type="button"
                  role="button"
                  tabIndex={0}
                  className={buttonClasses}
                  aria-label={label}
                  aria-pressed={ariaPressed}
                  aria-expanded={
                    action === "openProperties"
                      ? isPropertiesPanelOpen
                      : undefined
                  }
                  data-properties-trigger={
                    action === "openProperties" ? "true" : undefined
                  }
                  title={
                    action === "openProperties"
                      ? propertiesButtonTitle
                      : undefined
                  }
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) {
                      return;
                    }
                    if (panel) handleSelect(panel);
                    if (action) handleAction(action);
                  }}
                >
                  <i
                    aria-hidden={true}
                    className={`${icon} text-[24px] transition-colors duration-150 group-hover:text-white group-focus-visible:text-white`}
                  />
                  <span className="text-[12px] font-semibold leading-[1.05] tracking-[0.01em] text-center transition-colors duration-150 group-hover:text-white group-focus-visible:text-white">
                    {label}
                  </span>
                </button>
              );
            },
          )}
        </nav>
      </div>
      </aside>

      {showPopup && panelContent ? (
        <>
          <div
            role="presentation"
            className="fixed inset-0 z-30 bg-slate-900/20"
            onClick={() => setOpenPanel(null)}
          />
          <div
            className="fixed top-4 bottom-4 z-40 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ left: popupLeft }}
            role="dialog"
            aria-modal="true"
            aria-label={activeToolbarItem?.label ?? "Active tools"}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                {activeToolbarItem?.label ?? "Tools"}
              </h2>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => setOpenPanel(null)}
              >
                <span className="sr-only">Close panel</span>
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {panelContent}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
