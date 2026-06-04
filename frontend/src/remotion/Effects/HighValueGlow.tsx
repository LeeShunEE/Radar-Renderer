import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { getOctagonPoint } from "../../lib/math";
import type { AnimationConfig } from "../../types/radar";
import { RADAR_MAX_RADIUS, computePhaseStarts } from "../../../types/constants";

const MAX_RADIUS = RADAR_MAX_RADIUS;

type HighValueGlowProps = {
  cx: number;
  cy: number;
  index: number;
  value: number;
  color: string;
  damping: number;
  animation: AnimationConfig;
};

function PulseGlow({ x, y, frame, appearFrame, color }: {
  x: number; y: number; frame: number; appearFrame: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  const fadeIn = Math.min(localFrame / 20, 1);
  const cycle = (localFrame % 50) / 50;
  const scale = 15 + 20 * Math.sin(cycle * Math.PI);
  const opacity = fadeIn * interpolate(cycle, [0, 0.5, 1], [0.5, 0.15, 0.5], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  if (opacity < 0.01) return null;
  return (
    <circle cx={x} cy={y} r={scale} fill={color} opacity={opacity} />
  );
}

function RingGlow({ x, y, frame, fps, appearFrame, damping, color }: {
  x: number; y: number; frame: number; fps: number; appearFrame: number; damping: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  const glowSpring = spring({
    fps, frame: localFrame,
    config: { damping, mass: 0.8 },
    durationInFrames: 40,
  });
  const ringRadius = 10 + glowSpring * 40;
  const ringOpacity = interpolate(glowSpring, [0, 0.5, 1], [0.8, 0.4, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  if (ringOpacity < 0.01) return null;
  return (
    <circle cx={x} cy={y} r={ringRadius} fill="none" stroke={color} strokeWidth={3} opacity={ringOpacity} />
  );
}

function RippleGlow({ x, y, frame, appearFrame, color }: {
  x: number; y: number; frame: number; appearFrame: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  return (
    <>
      {[0, 15, 30].map((delay, i) => {
        const f = localFrame - delay;
        if (f < 0) return null;
        const progress = Math.min(f / 45, 1);
        const r = 10 + progress * 50;
        const opacity = interpolate(progress, [0, 0.4, 1], [0.6, 0.3, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        if (opacity < 0.01) return null;
        return (
          <circle
            key={i}
            cx={x} cy={y} r={r}
            fill="none" stroke={color}
            strokeWidth={3 - i * 0.7}
            opacity={opacity}
          />
        );
      })}
    </>
  );
}

function SparkleGlow({ x, y, frame, appearFrame, color }: {
  x: number; y: number; frame: number; appearFrame: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  const flickerOpacity = 0.3 + 0.4 * Math.abs(Math.sin(localFrame * 0.25));
  const points: { dx: number; dy: number; size: number; opacity: number }[] = [];
  const seed = appearFrame + x * 7 + y * 13;
  for (let i = 0; i < 8; i++) {
    const angle = ((seed + i * 47) % 360) * (Math.PI / 180);
    const dist = 15 + ((seed + i * 31) % 30);
    const progress = Math.min(Math.max(localFrame - i * 2, 0) / 25, 1);
    if (progress <= 0) continue;
    points.push({
      dx: Math.cos(angle) * dist * progress,
      dy: Math.sin(angle) * dist * progress,
      size: 2 + progress * 2,
      opacity: interpolate(progress, [0, 0.6, 1], [0.8, 0.5, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
    });
  }
  return (
    <>
      <circle cx={x} cy={y} r={12} fill={color} opacity={flickerOpacity} />
      {points.map((p, i) => (
        <circle key={i} cx={x + p.dx} cy={y + p.dy} r={p.size} fill={color} opacity={p.opacity} />
      ))}
    </>
  );
}

export const HighValueGlow: React.FC<HighValueGlowProps> = ({
  cx,
  cy,
  index,
  value,
  color,
  damping,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!animation.highValueGlowEnabled) return null;

  const appearFrame = computePhaseStarts(animation).effectsStart + index * 3;

  const normalizedValue = (value / 100) * MAX_RADIUS;
  const pos = getOctagonPoint(index, normalizedValue, cx, cy);

  const props = { x: pos.x, y: pos.y, frame, appearFrame, color };

  switch (animation.highValueGlowStyle) {
    case "pulse":
      return <PulseGlow {...props} />;
    case "ring":
      return <RingGlow {...props} fps={fps} damping={damping} />;
    case "ripple":
      return <RippleGlow {...props} />;
    case "sparkle":
      return <SparkleGlow {...props} />;
    default:
      return null;
  }
};
