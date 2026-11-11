'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Tagline reveal (design-system rule B11): the words start muted at ~30%
 * opacity and activate one at a time in reading order when the section
 * scrolls into view. IntersectionObserver on the container, then a stepped
 * activation per word on the base curve. Under prefers-reduced-motion the
 * full text shows immediately at full color.
 */
export function TaglineReveal({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wordEls = Array.from(container.querySelectorAll<HTMLSpanElement>('.tagline-word'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      wordEls.forEach((el) => el.classList.add('active'));
      return;
    }

    let timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        wordEls.forEach((el, i) => {
          timers.push(
            window.setTimeout(() => el.classList.add('active'), i * 80)
          );
        });
      },
      { threshold: 0.4 }
    );
    io.observe(container);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
    };
  }, [text]);

  return (
    <span ref={containerRef} className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} aria-hidden="true" className="tagline-word">
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}
