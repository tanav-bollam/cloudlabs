"use client";

import { ChangeEvent, useCallback, useMemo, useState } from "react";

import { createRandomId } from "@/lib/randomId";
import { PdfAsset, useDocumentStore } from "@/lib/store";

import PdfPagePickerModal, {
  type PdfPageSelection,
} from "../PdfPagePickerModal";

const ACCEPTED_TYPES = "application/pdf";

function createPdfAsset(file: File): PdfAsset {
  return {
    id: createRandomId(),
    name: file.name,
    url: URL.createObjectURL(file),
  };
}

export default function PdfPanel() {
  const pdfs = useDocumentStore((state) => state.assets.pdfs);
  const addPdfAssets = useDocumentStore((state) => state.addPdfAssets);
  const queueAssetPlacement = useDocumentStore(
    (state) => state.queueAssetPlacement,
  );
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);

  const activeAsset = useMemo(() => {
    if (!activeAssetId) {
      return null;
    }

    return pdfs.find((asset) => asset.id === activeAssetId) ?? null;
  }, [activeAssetId, pdfs]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      const newAssets = Array.from(files, createPdfAsset);
      addPdfAssets(newAssets);

      if (newAssets.length > 0) {
        setActiveAssetId(newAssets[0].id);
      }

      event.target.value = "";
    },
    [addPdfAssets],
  );

  const handleTileClick = useCallback((asset: PdfAsset) => {
    setActiveAssetId(asset.id);
  }, []);

  const handleModalClose = useCallback(() => {
    setActiveAssetId(null);
  }, []);

  const handlePageSelect = useCallback(
    (asset: PdfAsset, page: PdfPageSelection) => {
      queueAssetPlacement({
        type: "pdf",
        assetId: asset.id,
        pageNumber: page.pageNumber,
        imageUrl: page.imageUrl,
        width: page.width,
        height: page.height,
      });
      setActiveAssetId(null);
    },
    [queueAssetPlacement],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm text-slate-600">
        <label className="font-medium text-slate-800" htmlFor="pdf-panel-input">
          Add PDFs
        </label>
        <input
          id="pdf-panel-input"
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="block w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500 transition hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onChange={handleFileChange}
        />
        <p className="text-xs text-slate-400">Upload PDF files to reference or place into your design.</p>
      </div>

      {pdfs.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {pdfs.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="group flex cursor-default flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => handleTileClick(asset)}
                title={asset.name}
              >
                <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  <object
                    data={asset.url}
                    type="application/pdf"
                    className="h-full w-full"
                    aria-label={`Preview of ${asset.name}`}
                  >
                    <p className="px-3 text-center text-xs text-slate-500">
                      Preview not available. Click to download {asset.name}.
                    </p>
                  </object>
                </div>
                <span className="truncate text-[11px] font-medium text-slate-600 group-hover:text-blue-700 select-text">
                  {asset.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">No PDF files uploaded yet.</p>
      )}

      {activeAsset ? (
        <PdfPagePickerModal
          asset={activeAsset}
          isOpen={true}
          onClose={handleModalClose}
          onSelectPage={(page) => handlePageSelect(activeAsset, page)}
        />
      ) : null}
    </div>
  );
}
