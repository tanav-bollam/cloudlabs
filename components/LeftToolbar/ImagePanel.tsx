"use client";

import { ChangeEvent, DragEvent, useCallback, useRef } from "react";

import { createRandomId } from "@/lib/randomId";
import { ImageAsset, useDocumentStore } from "@/lib/store";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/svg+xml";
const DRAG_DATA_TYPE = "application/x-cloudlabs-asset";

function createImageAsset(file: File): ImageAsset {
  return {
    id: createRandomId(),
    name: file.name,
    url: URL.createObjectURL(file),
  };
}

export default function ImagePanel() {
  const images = useDocumentStore((state) => state.assets.images);
  const addImageAssets = useDocumentStore((state) => state.addImageAssets);
  const queueAssetPlacement = useDocumentStore(
    (state) => state.queueAssetPlacement,
  );
  const isDraggingRef = useRef(false);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      const newAssets = Array.from(files, createImageAsset);
      addImageAssets(newAssets);

      event.target.value = "";
    },
    [addImageAssets],
  );

  const handleDragStart = useCallback((asset: ImageAsset, event: DragEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(DRAG_DATA_TYPE, asset.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
    } else {
      isDraggingRef.current = false;
    }
  }, []);

  const handleTileClick = useCallback(
    (asset: ImageAsset) => {
      if (isDraggingRef.current) {
        return;
      }

      queueAssetPlacement({ type: "image", assetId: asset.id });
    },
    [queueAssetPlacement],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm text-slate-600">
        <label className="font-medium text-slate-800" htmlFor="image-panel-input">
          Add images
        </label>
        <input
          id="image-panel-input"
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
          onChange={handleFileChange}
        />
        <p className="text-xs text-slate-400">Upload PNG, JPG, or SVG files.</p>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((asset) => (
            <div
              key={asset.id}
              className="group flex cursor-grab flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
              draggable
              onDragStart={(event) => handleDragStart(asset, event)}
              onDragEnd={handleDragEnd}
              onClick={() => handleTileClick(asset)}
              title={asset.name}
            >
              <div className="aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>
              <span className="truncate text-[11px] font-medium text-slate-600 group-hover:text-blue-700">
                {asset.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No images uploaded yet.</p>
      )}
    </div>
  );
}

export { DRAG_DATA_TYPE };
