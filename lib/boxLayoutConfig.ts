export type BoxFaceKey = "front" | "back" | "left" | "right" | "top" | "bottom";

export interface FaceRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoxFaceConfig {
  key: BoxFaceKey;
  label: string;
  rect: FaceRectangle;
  materialIndex: number;
}

export const BOX_FACE_ORDER: BoxFaceKey[] = [
  "front",
  "right",
  "back",
  "left",
  "top",
  "bottom",
];

export const BOX_FACE_CONFIG: Record<BoxFaceKey, BoxFaceConfig> = {
  front: {
    key: "front",
    label: "Front Panel",
    rect: { x: 220, y: 260, width: 380, height: 140 },
    materialIndex: 4,
  },
  back: {
    key: "back",
    label: "Back Panel",
    rect: { x: 220, y: 120, width: 380, height: 140 },
    materialIndex: 5,
  },
  left: {
    key: "left",
    label: "Left Side",
    rect: { x: 100, y: 180, width: 120, height: 160 },
    materialIndex: 1,
  },
  right: {
    key: "right",
    label: "Right Side",
    rect: { x: 600, y: 180, width: 120, height: 160 },
    materialIndex: 0,
  },
  top: {
    key: "top",
    label: "Top Flap",
    rect: { x: 220, y: 60, width: 380, height: 60 },
    materialIndex: 2,
  },
  bottom: {
    key: "bottom",
    label: "Bottom Flap",
    rect: { x: 220, y: 400, width: 380, height: 60 },
    materialIndex: 3,
  },
};

export const BOX_DIMENSIONS = {
  width: BOX_FACE_CONFIG.front.rect.width,
  height: BOX_FACE_CONFIG.front.rect.height,
  depth: BOX_FACE_CONFIG.left.rect.width,
};
