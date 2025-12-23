"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PdfAsset } from "@/lib/store";

const THUMBNAIL_MAX_WIDTH = 220;
const PAGE_RENDER_MAX_WIDTH = 1200;

type PdfJsViewport = { width: number; height: number };

type PdfJsPage = {
  getViewport: (params: { scale: number }) => PdfJsViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfJsViewport;
  }) => { promise: Promise<void> };
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy: () => void;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
};

type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: string | { data: ArrayBuffer }) => PdfJsLoadingTask;
};

type PdfPageThumbnail = {
  pageNumber: number;
  dataUrl: string;
};

export type PdfPageSelection = {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
};

declare global {
  interface Window {
    __cloudlabsPdfjs?: PdfJsLib;
  }
}

async function loadPdfJs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") {
    throw new Error("PDF.js can only be loaded in the browser.");
  }

  if (window.__cloudlabsPdfjs) {
    return window.__cloudlabsPdfjs;
  }

  const pdfModule = (await import(
    /* webpackIgnore: true */
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
  )) as { default?: PdfJsLib } & PdfJsLib;

  const pdfjs = pdfModule?.default ?? pdfModule;
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
  window.__cloudlabsPdfjs = pdfjs;
  return pdfjs;
}

interface PdfPagePickerModalProps {
  asset: PdfAsset;
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (selection: PdfPageSelection) => void;
}

export default function PdfPagePickerModal({
  asset,
  isOpen,
  onClose,
  onSelectPage,
}: PdfPagePickerModalProps) {
  const [thumbnails, setThumbnails] = useState<PdfPageThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRenderingSelection, setIsRenderingSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const pdfDocumentRef = useRef<PdfJsDocument | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setThumbnails([]);
      setIsLoading(false);
      setIsRenderingSelection(false);
      setError(null);
      if (pdfDocumentRef.current) {
        pdfDocumentRef.current.destroy();
        pdfDocumentRef.current = null;
      }
      return;
    }

    let isCancelled = false;
    let loadedDocument: PdfJsDocument | null = null;

    if (pdfDocumentRef.current) {
      pdfDocumentRef.current.destroy();
      pdfDocumentRef.current = null;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setThumbnails([]);

      try {
        const pdfjs = await loadPdfJs();
        if (isCancelled) {
          return;
        }

        const task = pdfjs.getDocument(asset.url);
        loadedDocument = await task.promise;

        if (isCancelled) {
          loadedDocument.destroy();
          loadedDocument = null;
          return;
        }

        pdfDocumentRef.current = loadedDocument;

        const nextThumbnails: PdfPageThumbnail[] = [];

        for (let pageNumber = 1; pageNumber <= loadedDocument.numPages; pageNumber += 1) {
          if (isCancelled) {
            break;
          }

          const page = await loadedDocument.getPage(pageNumber);
          if (isCancelled) {
            break;
          }

          const viewport = page.getViewport({ scale: 1 });
          const scale = Math.min(THUMBNAIL_MAX_WIDTH / viewport.width, 1);
          const thumbnailViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(thumbnailViewport.width);
          canvas.height = Math.ceil(thumbnailViewport.height);
          const context = canvas.getContext("2d");

          if (!context) {
            continue;
          }

          await page.render({ canvasContext: context, viewport: thumbnailViewport }).promise;

          if (isCancelled) {
            break;
          }

          nextThumbnails.push({
            pageNumber,
            dataUrl: canvas.toDataURL("image/png"),
          });
        }

        if (!isCancelled) {
          setThumbnails(nextThumbnails);
        }
      } catch (err) {
        if (isCancelled) {
          return;
        }

        console.error("Failed to load PDF pages", err);
        setError("Unable to load PDF pages. Check your network connection and try again.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
      if (loadedDocument) {
        loadedDocument.destroy();
        loadedDocument = null;
      }
      if (pdfDocumentRef.current) {
        pdfDocumentRef.current.destroy();
        pdfDocumentRef.current = null;
      }
    };
  }, [asset, isOpen, reloadCounter]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePageSelect = useCallback(
    async (pageNumber: number) => {
      if (isRenderingSelection || !pdfDocumentRef.current) {
        return;
      }

      setIsRenderingSelection(true);
      setError(null);

      try {
        const page = await pdfDocumentRef.current.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(PAGE_RENDER_MAX_WIDTH / viewport.width, 1);
        const renderViewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const width = Math.max(1, Math.ceil(renderViewport.width));
        const height = Math.max(1, Math.ceil(renderViewport.height));
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to prepare a canvas for rendering.");
        }

        await page.render({ canvasContext: context, viewport: renderViewport }).promise;

        onSelectPage({
          pageNumber,
          imageUrl: canvas.toDataURL("image/png"),
          width,
          height,
        });
      } catch (err) {
        console.error("Failed to render PDF page", err);
        setError("Unable to render the selected page. Please try again.");
      } finally {
        setIsRenderingSelection(false);
      }
    },
    [isRenderingSelection, onSelectPage],
  );

  const body = useMemo(() => {
    if (!isOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div
          role="presentation"
          className="absolute inset-0 bg-slate-900/40"
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Select a page from ${asset.name}`}
          className="relative z-[101] flex max-h-[80vh] w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Select a page</h2>
              <p className="text-sm text-slate-500">{asset.name}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              aria-label="Close page picker"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                Loading pages...
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-600">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadCounter((value) => value + 1)}
                  className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                  disabled={isLoading || isRenderingSelection}
                >
                  Try again
                </button>
              </div>
            ) : thumbnails.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                No pages found in this PDF.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {thumbnails.map((thumbnail) => (
                  <button
                    key={thumbnail.pageNumber}
                    type="button"
                    className="group flex flex-col items-stretch gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => handlePageSelect(thumbnail.pageNumber)}
                    disabled={isRenderingSelection}
                  >
                    <div className="relative flex h-60 w-full items-center justify-center overflow-hidden rounded-lg bg-white">
                      <img
                        src={thumbnail.dataUrl}
                        alt={`Page ${thumbnail.pageNumber}`}
                        className="h-full w-full object-contain"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white shadow">
                        Page {thumbnail.pageNumber}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-700">Select page {thumbnail.pageNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-5 py-3 text-right text-xs text-slate-500">
            {isRenderingSelection
              ? "Rendering selected page..."
              : "Click a page thumbnail to place it on the canvas."}
          </div>
        </div>
      </div>
    );
  }, [
    asset.name,
    handleClose,
    handlePageSelect,
    isLoading,
    isOpen,
    isRenderingSelection,
    thumbnails,
    error,
  ]);

  if (!isOpen) {
    return null;
  }

  return createPortal(body, document.body);
}
