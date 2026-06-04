export type Rating = {
  base: string;
  modifier: string;
  full: string;
};

const TIERS: [number, string][] = [
  [200, "X"],
  [95, "SSS"],
  [90, "SS"],
  [85, "S"],
  [75, "A"],
  [60, "B"],
  [45, "C"],
  [30, "D"],
  [15, "E"],
  [0, "F"],
];

const MODIFIERS = ["--", "-", "", "+", "++"] as const;

function getModifier(avg: number, tierMin: number, tierMax: number): string {
  if (tierMin === tierMax) return "";
  const position = (avg - tierMin) / (tierMax - tierMin);
  const bucket = Math.min(
    MODIFIERS.length - 1,
    Math.floor(position * MODIFIERS.length),
  );
  return MODIFIERS[bucket];
}

export function calculateRating(value: number): Rating {
  for (let i = 0; i < TIERS.length; i++) {
    const [min, base] = TIERS[i];
    if (value >= min) {
      const nextMin = i === 0 ? 200 : TIERS[i - 1][0];
      const noModifier = base === "X" || base === "SSS" || base === "SS" || base === "F";
      const modifier = noModifier ? "" : getModifier(value, min, nextMin);
      return { base, modifier, full: `${base}${modifier}` };
    }
  }

  return { base: "F", modifier: "", full: "F" };
}

const RATING_COLORS: Record<string, string> = {
  X: "#e040fb",
  SSS: "#ff6b6b",
  SS: "#ff8c42",
  S: "#ffa94d",
  A: "#ffd43b",
  B: "#69db7c",
  C: "#38d9a9",
  D: "#4dabf7",
  E: "#9775fa",
  F: "#868e96",
};

export function getRatingColor(rating: Rating): string {
  return RATING_COLORS[rating.base] ?? "#868e96";
}
