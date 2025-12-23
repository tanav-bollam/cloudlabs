export type DielineSegmentType = "cut" | "safe" | "bleed" | "unknown";

export interface DielinePath {
  id: string;
  data: string;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  type: DielineSegmentType;
}

export interface DielineDocument {
  width: number;
  height: number;
  x: number;
  y: number;
  paths: DielinePath[];
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function groupIdToType(id?: string | null): DielineSegmentType {
  if (!id) return "unknown";
  if (id.toLowerCase().includes("cut")) return "cut";
  if (id.toLowerCase().includes("safe")) return "safe";
  if (id.toLowerCase().includes("bleed")) return "bleed";
  return "unknown";
}

function parseDashArray(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const numbers = value
    .split(/[ ,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));

  return numbers.length ? numbers : undefined;
}

export async function loadDielineDocument(name: string): Promise<DielineDocument> {
  const response = await fetch(`/dielines/${name}.svg`);
  if (!response.ok) {
    throw new Error(`Failed to load dieline: ${name}`);
  }

  const svgText = await response.text();
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
  const svgElement = svgDoc.documentElement;

  const viewBox = svgElement.getAttribute("viewBox");
  let x = 0;
  let y = 0;
  let width = 0;
  let height = 0;

  if (viewBox) {
    const [vx, vy, vw, vh] = viewBox
      .split(/[ ,]+/)
      .map((value) => Number.parseFloat(value));
    x = Number.isFinite(vx) ? vx : 0;
    y = Number.isFinite(vy) ? vy : 0;
    width = Number.isFinite(vw) ? vw : 0;
    height = Number.isFinite(vh) ? vh : 0;
  } else {
    const rawWidth = svgElement.getAttribute("width");
    const rawHeight = svgElement.getAttribute("height");
    width = rawWidth ? Number.parseFloat(rawWidth) : 0;
    height = rawHeight ? Number.parseFloat(rawHeight) : 0;
  }

  if (!width || !height) {
    throw new Error(`Invalid SVG viewBox for dieline: ${name}`);
  }

  const paths: DielinePath[] = [];

  const pushPath = (element: SVGPathElement, type: DielineSegmentType) => {
    const data = element.getAttribute("d");
    if (!data) return;

    const stroke = element.getAttribute("stroke") ?? "#0f172a";
    const strokeWidth = Number.parseFloat(
      element.getAttribute("stroke-width") ?? "1"
    );
    const dash = parseDashArray(element.getAttribute("stroke-dasharray"));

    paths.push({
      id: element.id || `${type}-${paths.length}`,
      data,
      stroke,
      strokeWidth: Number.isFinite(strokeWidth) ? strokeWidth : 1,
      dash,
      type,
    });
  };

  const groupElements = Array.from(svgElement.querySelectorAll("g"));
  groupElements.forEach((group) => {
    const type = groupIdToType(group.id);
    group.querySelectorAll("path").forEach((path) => {
      const pathElement = path as SVGPathElement;
      if (!pathElement.getAttribute("stroke")) {
        const groupStroke = group.getAttribute("stroke");
        if (groupStroke) {
          pathElement.setAttribute("stroke", groupStroke);
        }
      }

      if (!pathElement.getAttribute("stroke-width")) {
        const groupStrokeWidth = group.getAttribute("stroke-width");
        if (groupStrokeWidth) {
          pathElement.setAttribute("stroke-width", groupStrokeWidth);
        }
      }

      if (!pathElement.getAttribute("stroke-dasharray")) {
        const groupDashArray = group.getAttribute("stroke-dasharray");
        if (groupDashArray) {
          pathElement.setAttribute("stroke-dasharray", groupDashArray);
        }
      }

      pushPath(pathElement, type);
    });
  });

  svgElement.querySelectorAll(":scope > path").forEach((path) => {
    const pathElement = path as SVGPathElement;
    pushPath(pathElement, groupIdToType(pathElement.id));
  });

  if (!paths.length) {
    throw new Error(`No path data found in dieline: ${name}`);
  }

  return {
    width,
    height,
    x,
    y,
    paths,
  };
}

export function getDielineScale(
  containerWidth: number,
  containerHeight: number,
  dieline: DielineDocument,
  padding = 48
): { scale: number; offsetX: number; offsetY: number } {
  const usableWidth = Math.max(containerWidth - padding * 2, 0);
  const usableHeight = Math.max(containerHeight - padding * 2, 0);

  const scale = Math.min(
    usableWidth / dieline.width,
    usableHeight / dieline.height
  );

  const finalScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const offsetX = padding + (usableWidth - dieline.width * finalScale) / 2;
  const offsetY = padding + (usableHeight - dieline.height * finalScale) / 2;

  return {
    scale: finalScale,
    offsetX,
    offsetY,
  };
}

export function isInsideDieline(
  dieline: Pick<DielineDocument, "x" | "y" | "width" | "height">,
  nodeBounds: RectBounds,
): boolean {
  if (nodeBounds.width <= 0 || nodeBounds.height <= 0) {
    return true;
  }

  const dielineLeft = dieline.x;
  const dielineTop = dieline.y;
  const dielineRight = dieline.x + dieline.width;
  const dielineBottom = dieline.y + dieline.height;

  const nodeLeft = nodeBounds.x;
  const nodeTop = nodeBounds.y;
  const nodeRight = nodeBounds.x + nodeBounds.width;
  const nodeBottom = nodeBounds.y + nodeBounds.height;

  return (
    nodeLeft >= dielineLeft &&
    nodeTop >= dielineTop &&
    nodeRight <= dielineRight &&
    nodeBottom <= dielineBottom
  );
}
