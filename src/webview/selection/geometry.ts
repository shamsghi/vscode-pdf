export type SelectionPoint = {
  x: number;
  y: number;
};

export function pointDistance(a: SelectionPoint, b: SelectionPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polygonIntersectsBox(
  points: SelectionPoint[],
  rect: { left: number; top: number; right: number; bottom: number }
): boolean {
  const center = {
    x: rect.left + (rect.right - rect.left) / 2,
    y: rect.top + (rect.bottom - rect.top) / 2
  };
  if (pointInPolygon(center, points)) {
    return true;
  }

  const rectCorners = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom }
  ];
  if (rectCorners.some((corner) => pointInPolygon(corner, points))) {
    return true;
  }

  return polygonIntersectsRect(points, rectCorners);
}

function pointInPolygon(point: SelectionPoint, polygon: SelectionPoint[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    if (!crossesY) {
      continue;
    }

    const crossingX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (point.x < crossingX) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonIntersectsRect(
  polygon: SelectionPoint[],
  rectCorners: [SelectionPoint, SelectionPoint, SelectionPoint, SelectionPoint] | SelectionPoint[]
): boolean {
  const rectEdges = [
    [rectCorners[0], rectCorners[1]],
    [rectCorners[1], rectCorners[2]],
    [rectCorners[2], rectCorners[3]],
    [rectCorners[3], rectCorners[0]]
  ] as const;

  for (let index = 0; index < polygon.length; index += 1) {
    const nextIndex = (index + 1) % polygon.length;
    const polygonEdge = [polygon[index], polygon[nextIndex]] as const;
    if (rectEdges.some((rectEdge) => segmentsIntersect(polygonEdge[0], polygonEdge[1], rectEdge[0], rectEdge[1]))) {
      return true;
    }
  }

  return false;
}

function segmentsIntersect(a: SelectionPoint, b: SelectionPoint, c: SelectionPoint, d: SelectionPoint): boolean {
  const directionA = segmentDirection(a, b, c);
  const directionB = segmentDirection(a, b, d);
  const directionC = segmentDirection(c, d, a);
  const directionD = segmentDirection(c, d, b);

  if (directionA === 0 && pointOnSegment(c, a, b)) {
    return true;
  }
  if (directionB === 0 && pointOnSegment(d, a, b)) {
    return true;
  }
  if (directionC === 0 && pointOnSegment(a, c, d)) {
    return true;
  }
  if (directionD === 0 && pointOnSegment(b, c, d)) {
    return true;
  }

  return directionA > 0 !== directionB > 0 && directionC > 0 !== directionD > 0;
}

function segmentDirection(a: SelectionPoint, b: SelectionPoint, c: SelectionPoint): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

function pointOnSegment(point: SelectionPoint, start: SelectionPoint, end: SelectionPoint): boolean {
  return point.x >= Math.min(start.x, end.x)
    && point.x <= Math.max(start.x, end.x)
    && point.y >= Math.min(start.y, end.y)
    && point.y <= Math.max(start.y, end.y);
}
