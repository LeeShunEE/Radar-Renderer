import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { getOctagonPoint } from "../../lib/math";
import type { AnimationConfig, RadarTheme } from "../../types/radar";
import { RADAR_MAX_RADIUS, computePhaseStarts } from "../../types/constants";

const MAX_RADIUS = RADAR_MAX_RADIUS;

type RadarDotProps = {
  cx: number;
  cy: number;
  index: number;
  value: number;
  isHighValue: boolean;
  theme: RadarTheme;
  animation: AnimationConfig;
};

function GlowPulse({ x, y, frame, appearFrame, color }: {
  x: number; y: number; frame: number; appearFrame: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  const cycle = (localFrame % 40) / 40;
  const scale = 1 + 0.3 * Math.sin(cycle * Math.PI);
  const opacity = interpolate(cycle, [0, 0.5, 1], [0.6, 0.2, 0.6], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <circle cx={x} cy={y} r={8 * scale} fill={color} opacity={opacity} />
  );
}

function GlowRing({ x, y, frame, fps, appearFrame, damping, color }: {
  x: number; y: number; frame: number; fps: number; appearFrame: number; damping: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  const glowSpring = spring({
    fps, frame: localFrame,
    config: { damping, mass: 0.8 },
    durationInFrames: 40,
  });
  const glowProgress = interpolate(glowSpring, [0, 1], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(glowProgress, [0, 0.3, 0.7, 1], [0, 0.8, 0.4, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const glowRadius = 6 + glowProgress * 40;
  if (glowOpacity < 0.01) return null;
  return (
    <circle cx={x} cy={y} r={glowRadius} fill="none" stroke={color} strokeWidth={2} opacity={glowOpacity} />
  );
}

function GlowRipple({ x, y, frame, appearFrame, color }: {
  x: number; y: number; frame: number; appearFrame: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  return (
    <>
      {[0, 12, 24].map((delay, i) => {
        const f = localFrame - delay;
        if (f < 0) return null;
        const progress = Math.min(f / 40, 1);
        const r = 6 + progress * 35;
        const opacity = interpolate(progress, [0, 0.5, 1], [0.7, 0.4, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        if (opacity < 0.01) return null;
        return (
          <circle
            key={i}
            cx={x} cy={y} r={r}
            fill="none" stroke={color}
            strokeWidth={2.5 - i * 0.5}
            opacity={opacity}
          />
        );
      })}
    </>
  );
}

function GlowSparkle({ x, y, frame, appearFrame, color }: {
  x: number; y: number; frame: number; appearFrame: number; color: string;
}) {
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;
  const flickerOpacity = 0.4 + 0.6 * Math.abs(Math.sin(localFrame * 0.3));
  const points: { dx: number; dy: number; size: number; opacity: number }[] = [];
  const seed = appearFrame + x * 7 + y * 13;
  for (let i = 0; i < 6; i++) {
    const angle = ((seed + i * 61) % 360) * (Math.PI / 180);
    const dist = 10 + ((seed + i * 37) % 20);
    const progress = Math.min(Math.max(localFrame - i * 3, 0) / 30, 1);
    if (progress <= 0) continue;
    points.push({
      dx: Math.cos(angle) * dist * progress,
      dy: Math.sin(angle) * dist * progress,
      size: 1.5 + progress * 1.5,
      opacity: interpolate(progress, [0, 0.5, 1], [0.9, 0.6, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
    });
  }
  return (
    <>
      <circle cx={x} cy={y} r={6} fill={color} opacity={flickerOpacity} />
      {points.map((p, i) => (
        <circle key={i} cx={x + p.dx} cy={y + p.dy} r={p.size} fill={color} opacity={p.opacity} />
      ))}
    </>
  );
}

export const RadarDot: React.FC<RadarDotProps> = ({
  cx,
  cy,
  index,
  value,
  isHighValue,
  theme,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fillStart = computePhaseStarts(animation).fillStart;
  const normalizedValue = (value / 100) * MAX_RADIUS;
  const pos = getOctagonPoint(index, normalizedValue, cx, cy);

  const dotAppearFrame = fillStart + animation.fillDuration * 0.7 + index * 2;

  const baseScale = spring({
    fps,
    frame: frame - dotAppearFrame,
    config: { damping: 200 },
    durationInFrames: 20,
  });

  const highValueScale = isHighValue
    ? spring({
        fps,
        frame: frame - (dotAppearFrame + animation.fillDuration * 0.3 + index * 3),
        config: { damping: animation.highValueSpringDamping, mass: 0.8 },
        durationInFrames: 40,
      })
    : 0;

  const radius = isHighValue ? 6 + highValueScale * 6 : 6;
  const scale = baseScale;

  const showGlow = isHighValue && animation.highValueGlowEnabled;

  if (scale < 0.01) return null;

  const glowAppearFrame = fillStart + animation.fillDuration * 0.8 + index * 3;

  const renderGlow = () => {
    if (!showGlow) return null;
    const props = { x: pos.x, y: pos.y, frame, appearFrame: glowAppearFrame, color: theme.glowColor };
    switch (animation.highValueGlowStyle) {
      case "pulse":
        return <GlowPulse {...props} />;
      case "ring":
        return <GlowRing {...props} fps={fps} damping={animation.highValueSpringDamping} />;
      case "ripple":
        return <GlowRipple {...props} />;
      case "sparkle":
        return <GlowSparkle {...props} />;
    }
  };

  return (
    <g>
      {renderGlow()}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={radius * scale}
        fill={isHighValue ? theme.highValueDotColor : theme.dotColor}
      />
    </g>
  );
};
