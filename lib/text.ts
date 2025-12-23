import type { TextFontWeight, TextNodeData } from "./store";

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext() {
  if (measureContext) {
    return measureContext;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  measureContext = canvas.getContext("2d");
  return measureContext;
}

const FALLBACK_LETTER_WIDTH_RATIO = 0.6;

export type StraightTextMetrics = {
  width: number;
  height: number;
};

export type CurvedGlyph = {
  char: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
};

export type CurvedTextLayout = {
  glyphs: CurvedGlyph[];
  width: number;
  height: number;
};

const FONT_WEIGHT_MAP: Record<TextFontWeight, string> = {
  "400": "400",
  "600": "600",
  "700": "700",
};

function toCanvasFont(
  fontWeight: TextFontWeight,
  fontSize: number,
  fontFamily: string,
) {
  return `${FONT_WEIGHT_MAP[fontWeight] ?? fontWeight} ${fontSize}px ${fontFamily}`;
}

function getTextHeight(metrics: TextMetrics | undefined, fontSize: number) {
  if (!metrics) {
    return fontSize;
  }

  const ascent = metrics.actualBoundingBoxAscent ?? 0;
  const descent = metrics.actualBoundingBoxDescent ?? 0;
  const height = ascent + descent;
  return height || fontSize;
}

export function measureStraightText({
  text,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
}: {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: TextFontWeight;
  letterSpacing: number;
}): StraightTextMetrics {
  const context = getMeasureContext();
  if (!context) {
    const baseWidth = Math.max(text.length, 1) * fontSize * FALLBACK_LETTER_WIDTH_RATIO;
    const spacing = Math.max(text.length - 1, 0) * letterSpacing;
    return {
      width: baseWidth + spacing,
      height: fontSize,
    };
  }

  context.font = toCanvasFont(fontWeight, fontSize, fontFamily);
  const metrics = context.measureText(text.length ? text : " ");
  const baseWidth = metrics.width;
  const spacing = Math.max(text.length - 1, 0) * letterSpacing;

  return {
    width: baseWidth + spacing,
    height: getTextHeight(metrics, fontSize),
  };
}

export function computeCurvedTextLayout({
  text,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  angle,
}: {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: TextFontWeight;
  letterSpacing: number;
  radius: number;
  angle: number;
}): CurvedTextLayout {
  const characters = Array.from(text);
  const context = getMeasureContext();
  const safeRadius = Math.max(1, Math.abs(radius));
  const radiusDirection = radius >= 0 ? 1 : -1;

  if (!characters.length) {
    const fallbackSize = Math.max(fontSize, 1);
    return {
      glyphs: [],
      width: fallbackSize,
      height: fallbackSize,
    };
  }

  let widths: number[] = [];
  let glyphHeight = fontSize;

  if (context) {
    context.font = toCanvasFont(fontWeight, fontSize, fontFamily);
  }

  for (let index = 0; index < characters.length; index += 1) {
    const char = characters[index];
    if (context) {
      const metrics = context.measureText(char);
      const charWidth = metrics.width;
      widths.push(charWidth + (index < characters.length - 1 ? letterSpacing : 0));
      glyphHeight = getTextHeight(metrics, fontSize);
    } else {
      const charWidth = fontSize * FALLBACK_LETTER_WIDTH_RATIO;
      widths.push(charWidth + (index < characters.length - 1 ? letterSpacing : 0));
      glyphHeight = fontSize;
    }
  }

  const totalWidth = widths.reduce((acc, value) => acc + value, 0);
  const angleRad = angle === 0 ? totalWidth / safeRadius : (angle * Math.PI) / 180;
  const pxToAngle = totalWidth === 0 ? 0 : angleRad / totalWidth;
  const startAngle = -angleRad / 2;

  let progressedAngle = 0;
  const glyphsRaw: CurvedGlyph[] = [];

  for (let index = 0; index < characters.length; index += 1) {
    const char = characters[index];
    const widthWithSpacing = widths[index];
    const charAngle = widthWithSpacing * pxToAngle;
    const charCenterAngle = startAngle + progressedAngle + charAngle / 2;
    const positionAngle = charCenterAngle;
    const r = safeRadius * radiusDirection;
    const x = r * Math.cos(positionAngle);
    const y = r * Math.sin(positionAngle);
    const charWidth = widthWithSpacing - (index < characters.length - 1 ? letterSpacing : 0);
    const rotation = (positionAngle * 180) / Math.PI + (angleRad >= 0 ? 90 : -90);

    glyphsRaw.push({
      char,
      x,
      y,
      rotation,
      width: charWidth,
      height: glyphHeight,
    });

    progressedAngle += charAngle;
  }

  const minX = glyphsRaw.reduce(
    (min, glyph) => Math.min(min, glyph.x - glyph.width / 2),
    Number.POSITIVE_INFINITY,
  );
  const maxX = glyphsRaw.reduce(
    (max, glyph) => Math.max(max, glyph.x + glyph.width / 2),
    Number.NEGATIVE_INFINITY,
  );
  const minY = glyphsRaw.reduce(
    (min, glyph) => Math.min(min, glyph.y - glyph.height / 2),
    Number.POSITIVE_INFINITY,
  );
  const maxY = glyphsRaw.reduce(
    (max, glyph) => Math.max(max, glyph.y + glyph.height / 2),
    Number.NEGATIVE_INFINITY,
  );

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const glyphs = glyphsRaw.map((glyph) => ({
    ...glyph,
    x: glyph.x - centerX,
    y: glyph.y - centerY,
  }));

  return {
    glyphs,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function withUpdatedTextMetrics(
  data: TextNodeData,
  updates: Partial<TextNodeData>,
): TextNodeData {
  const next: TextNodeData = {
    ...data,
    ...updates,
  };

  if (!Number.isFinite(next.fontSize) || next.fontSize <= 0) {
    next.fontSize = Math.max(12, data.fontSize);
  }

  if (!Number.isFinite(next.letterSpacing)) {
    next.letterSpacing = data.letterSpacing;
  }

  if (!Number.isFinite(next.radius) || next.radius === 0) {
    next.radius = data.radius || 150;
  }

  if (!Number.isFinite(next.angle)) {
    next.angle = data.angle;
  }

  if (next.isCurved) {
    const layout = computeCurvedTextLayout({
      text: next.text,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fontWeight: next.fontWeight,
      letterSpacing: next.letterSpacing,
      radius: next.radius,
      angle: next.angle,
    });

    next.width = layout.width || Math.max(next.fontSize, 1);
    next.height = layout.height || Math.max(next.fontSize, 1);
  } else {
    const metrics = measureStraightText({
      text: next.text,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fontWeight: next.fontWeight,
      letterSpacing: next.letterSpacing,
    });

    next.width = metrics.width || Math.max(next.fontSize, 1);
    next.height = metrics.height || Math.max(next.fontSize, 1);
  }

  return next;
}

export function fontWeightToFontStyle(fontWeight: TextFontWeight) {
  return Number(fontWeight) >= 600 ? "bold" : "normal";
}
