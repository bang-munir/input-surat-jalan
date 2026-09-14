import { useEffect, useRef, useState, type ReactNode } from "react";

export type SheetOrientation = "landscape" | "portrait";

/** Menampilkan lembar A4 dan menyesuaikan skalanya dengan lebar layar. */
export function SheetPreview({
  children,
  sheetRef,
  orientation = "landscape",
}: {
  children: ReactNode;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  orientation?: SheetOrientation;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const isPortrait = orientation === "portrait";
  const sheetW = isPortrait ? 210 : 297;
  const sheetH = isPortrait ? 297 : 210;

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
          className={`sheet-a4 origin-top-left shadow-[0_18px_50px_-20px_oklch(0.22_0.03_260/0.45)] ring-1 ring-border ${isPortrait ? "sheet-portrait" : ""}`}
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
