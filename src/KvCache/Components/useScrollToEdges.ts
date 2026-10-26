import { useCallback, useEffect, useRef, useState } from 'react';

// Tracks a scroll container's position so "scroll to top" / "scroll to bottom"
// buttons can show only when relevant: top when there is content above and we
// are not at the top, bottom when there is content below and we are not at the
// bottom. `contentKey` should change whenever the rendered content changes
// (e.g. the segments array) so the overflow state is re-evaluated.
export function useScrollToEdges(contentKey: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setShowTop(false);
      setShowBottom(false);
      return;
    }
    const canScroll = el.scrollHeight > el.clientHeight;
    const atTop = el.scrollTop < 8;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setShowTop(canScroll && !atTop);
    setShowBottom(canScroll && !atBottom);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [contentKey, update]);

  const scrollToTop = useCallback(() => {
    const el = ref.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  return { ref, showTop, showBottom, scrollToTop, scrollToBottom };
}
