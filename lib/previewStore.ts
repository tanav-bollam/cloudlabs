import { create } from "zustand";

import {
  BOX_FACE_CONFIG,
  BOX_FACE_ORDER,
  type BoxFaceConfig,
  type BoxFaceKey,
} from "./boxLayoutConfig";

export type FaceTextureState = BoxFaceConfig & {
  dataUrl: string | null;
  version: number;
};

export interface PreviewState {
  faces: Record<BoxFaceKey, FaceTextureState>;
  setFaceTextures: (updates: Partial<Record<BoxFaceKey, string | null>>) => void;
  resetFaceTextures: () => void;
}

const createInitialFaces = (): Record<BoxFaceKey, FaceTextureState> => {
  return BOX_FACE_ORDER.reduce((acc, key) => {
    acc[key] = { ...BOX_FACE_CONFIG[key], dataUrl: null, version: 0 };
    return acc;
  }, {} as Record<BoxFaceKey, FaceTextureState>);
};

export const usePreviewStore = create<PreviewState>((set) => ({
  faces: createInitialFaces(),
  setFaceTextures: (updates) =>
    set((state) => {
      if (!updates || !Object.keys(updates).length) {
        return state;
      }

      const nextFaces: Record<BoxFaceKey, FaceTextureState> = {
        ...state.faces,
      };
      let hasChanges = false;

      (Object.keys(updates) as BoxFaceKey[]).forEach((key) => {
        const face = state.faces[key];
        if (!face) return;

        const dataUrl = updates[key] ?? null;
        if (face.dataUrl === dataUrl) {
          return;
        }

        nextFaces[key] = {
          ...face,
          dataUrl,
          version: face.version + 1,
        };
        hasChanges = true;
      });

      if (!hasChanges) {
        return state;
      }

      return { faces: nextFaces };
    }),
  resetFaceTextures: () => set({ faces: createInitialFaces() }),
}));
