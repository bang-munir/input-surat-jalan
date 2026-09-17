import { useEffect, useRef, useState, type ReactNode } from "react";

/** Menampilkan lembar A4 dan menyesuaikan skalanya dengan lebar layar. */
export function SheetPreview({
  children,
  sheetRef,
}: {
  children: ReactNode;
  sheetRef: React.RefObject<HTMLDivElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const sheetW = 210;
  const sheetH = 297;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const sheetPx = (sheetW / 25.4) * 96;
      setScale(Math.min(1, el.clientWidth / sheetPx));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheetW]);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{ height: scale * (sheetH / 25.4) * 96 }}
        className="print-area flex justify-center"
      >
        <div
          ref={sheetRef}
          className="sheet-a4 origin-top-left shadow-[0_18px_50px_-20px_oklch(0.22_0.03_260/0.45)] ring-1 ring-border"
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
