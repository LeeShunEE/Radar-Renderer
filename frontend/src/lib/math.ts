const NUM_SIDES = 8;

export function getOctagonPoint(
  index: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / NUM_SIDES - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function getRadarPolygonPoints(
  values: number[],
  maxRadius: number,
  cx: number,
  cy: number,
): string {
  return values
    .map((v, i) => {
      const r = (v / 100) * maxRadius;
      const { x, y } = getOctagonPoint(i, r, cx, cy);
      return `${x},${y}`;
    })
    .join(" ");
}

export function getGridRingPoints(
  ringLevel: number,
  maxRadius: number,
  cx: number,
  cy: number,
): string {
  const radius = maxRadius * ringLevel;
  return Array.from({ length: NUM_SIDES }, (_, i) => {
    const { x, y } = getOctagonPoint(i, radius, cx, cy);
    return `${x},${y}`;
  }).join(" ");
}

export function getLabelPosition(
  index: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const { x, y } = getOctagonPoint(index, radius, cx, cy);
  return { x, y };
}

export function getRadarLabelAnchor(
  index: number,
  cx: number,
  cy: number,
  maxRadius: number,
  attributeFontSize: number,
  ratingFontSize: number,
): { x: number; y: number; yOffset: number } {
  const distance =
    maxRadius + 30 + Math.max(attributeFontSize, ratingFontSize) * 0.8;
  const { x, y } = getOctagonPoint(index, distance, cx, cy);
  const yOffset = (attributeFontSize + ratingFontSize) * 0.5 + 6;
  return { x, y, yOffset };
}
