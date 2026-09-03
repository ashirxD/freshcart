'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * SECTION-LEVEL SCROLL REVEAL (§44)
 *
 * A section fades up 12px the first time it comes into view, once, over
 * ~420ms. Sections only — never individual products: a grid where forty cards
 * each fade in separately is slower to read, not more polished.
 *
 * WHY NOT THE CSS-ONLY VERSION
 * This started as `animation-timeline: view()`, which is tempting because it
 * needs no JavaScript at all. Two things ruled it out. Progress is measured
 * against the element, so a tall section sat on screen at a quarter opacity
 * while it was already being read — the reveal became a fog. And because the
 * opacity is a function of scroll position rather than a one-shot animation,
 * anything that renders the page outside a live scroll container — a full-page
 * screenshot, a print, a PDF — got transparent sections. An observer that fires
 * once and then gets out of the way has neither problem, and works in every
 * browser rather than only in Chrome.
 *
 * THE THREE STATES
 *   static   the server-rendered state, and the permanent state for anything
 *            already on screen or for a visitor who asked for reduced motion.
 *            No opacity, no animation — so a failure to hydrate, a missing
 *            IntersectionObserver or a disabled script can never leave a
 *            section invisible. This is the important one.
 *   armed    below the fold and waiting: transparent, ready to animate.
 *   revealed plays the animation once. The class then simply stays.
 */
export function useReveal(): {
  ref: React.RefObject<HTMLElement | null>;
  className: string;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'static' | 'armed' | 'revealed'>('static');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Anything already on screen stays `static`: fading in content the visitor
    // is looking at is a flash, not a reveal.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setState('armed');

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState('revealed');
        observer.disconnect();
      },
      // Waits until the section is a little way in, so the animation is not
      // already finished by the time it is properly on screen.
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return {
    ref,
    className: state === 'armed' ? 'opacity-0' : state === 'revealed' ? 'animate-fade-up' : '',
  };
}
