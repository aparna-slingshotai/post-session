"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoScroll<T>(dep: T) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsNearBottom(distanceFromBottom < 120);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Double-rAF ensures the DOM has fully laid out new content
  // (e.g. multi-bubble assistant messages) before measuring scrollHeight.
  useEffect(() => {
    if (!containerRef.current || !isNearBottom) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    });
  }, [dep, isNearBottom]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
        setIsNearBottom(true);
      });
    });
  }, []);

  return { containerRef, scrollToBottom };
}
