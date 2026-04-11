import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { useEffect, useRef, useState } from "react";

const ELLIPSIS = "\u2026";

function measure(text: string, font: string): number {
  const prepared = prepareWithSegments(text, font);
  const result = layoutWithLines(prepared, Number.MAX_SAFE_INTEGER, 16);
  return result.lines[0]?.width ?? 0;
}

function middleTruncate(text: string, font: string, maxWidth: number): string {
  if (text.length === 0 || maxWidth <= 0) {
    return text;
  }

  if (measure(text, font) <= maxWidth) {
    return text;
  }

  const ellipsisWidth = measure(ELLIPSIS, font);
  const available = maxWidth - ellipsisWidth;
  if (available <= 0) {
    return ELLIPSIS;
  }

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid), font) <= available / 2) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const startLen = lo;
  const startWidth = startLen > 0 ? measure(text.slice(0, startLen), font) : 0;

  const remainingBudget = available - startWidth;
  lo = 0;
  hi = text.length - startLen;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(text.length - mid), font) <= remainingBudget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const endLen = lo;

  if (startLen === 0 && endLen === 0) {
    return ELLIPSIS;
  }

  const start = text.slice(0, startLen);
  const end = endLen > 0 ? text.slice(text.length - endLen) : "";
  return `${start}${ELLIPSIS}${end}`;
}

export function MiddleTruncate({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(text);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const parent = el.parentElement;
    if (!parent) {
      return;
    }

    // Track max width to prevent oscillation: parent may shrink as a consequence
    // of our own truncation, which would otherwise cause an infinite shrink loop.
    let maxObservedWidth = 0;

    const update = () => {
      const style = getComputedStyle(el);
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const currentWidth = parent.clientWidth;
      if (currentWidth > maxObservedWidth) {
        maxObservedWidth = currentWidth;
      }
      setTruncated(middleTruncate(text, font, maxObservedWidth));
    };

    // On window resize, reset and re-measure from full text
    const handleWindowResize = () => {
      maxObservedWidth = 0;
      setTruncated(text);
      requestAnimationFrame(update);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(parent);
    window.addEventListener("resize", handleWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [text]);

  return (
    <span className={className} ref={ref}>
      {truncated}
    </span>
  );
}
