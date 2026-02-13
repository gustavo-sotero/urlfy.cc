'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

interface RevealSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Scroll-reveal animation wrapper.
 *
 * - Above-the-fold sections render immediately (no animation) to avoid
 *   the page appearing "scrolled down" on initial load.
 * - Below-the-fold sections start hidden and animate in when they enter
 *   the viewport via IntersectionObserver.
 *
 * SSR: content is rendered visible (no animation classes) so the server
 * HTML is correct and there's no layout shift during hydration.
 */
export function RevealSection({
  children,
  delay = 0,
  className = ''
}: RevealSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  // 'idle'   → SSR / before client check (content visible, no animation)
  // 'hidden' → below the fold, waiting for scroll reveal
  // 'visible'→ revealed (either immediately or after scroll)
  const [state, setState] = useState<'idle' | 'hidden' | 'visible'>('idle');

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight;

    if (isAboveFold) {
      // Already in viewport → show immediately, no animation needed
      setState('visible');
      return;
    }

    // Below the fold → hide instantly (no transition), then observe
    el.style.transition = 'none';
    setState('hidden');

    // Re-enable CSS transitions after the browser paints the hidden state.
    // Double rAF ensures the paint has flushed before transitions kick in.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition = '';
      });
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setState('visible'), delay);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer.disconnect();
    };
  }, [delay]);

  // idle/visible → no transform, fully opaque
  // hidden       → shifted down + transparent, with transition class for reveal
  const animationClass =
    state === 'hidden'
      ? 'translate-y-8 opacity-0 transition-all duration-1000 ease-out'
      : state === 'visible'
        ? 'translate-y-0 opacity-100 transition-all duration-1000 ease-out'
        : '';

  const finalClassName = [animationClass, className].filter(Boolean).join(' ');

  return (
    <div ref={sectionRef} className={finalClassName || undefined}>
      {children}
    </div>
  );
}
