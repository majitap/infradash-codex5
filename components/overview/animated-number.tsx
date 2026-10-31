"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
  value,
  digits = 0,
}: {
  value: number;
  digits?: number;
}) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const started = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = reduced ? 1 : Math.min((now - started) / 480, 1);
      const next = from + (value - from) * (1 - Math.pow(1 - progress, 4));
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const format = (n: number) =>
    n.toLocaleString("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  return (
    <span aria-label={format(value)}>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  );
}
