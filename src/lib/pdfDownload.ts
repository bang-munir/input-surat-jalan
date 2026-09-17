import type { jsPDF } from "jspdf";

export function isIOS(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  if (/iP(hone|od)|iPad/.test(ua)) {
    return true;
  }
  return (
    ua.indexOf("Macintosh") !== -1 &&
    /Apple Computer/.test(navigator.vendor || "") &&
    navigator.maxTouchPoints > 1 &&
    navigator.platform === "MacIntel"
  );
}

function revokeAfterOpened(win: Window, url: string) {
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    URL.revokeObjectURL(url);
  };

  const timer = window.setTimeout(cleanup, 120_000);
  const poll = window.setInterval(() => {
    if (win.closed) {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      cleanup();
    }
  }, 4_000);

  window.addEventListener(
    "pagehide",
    () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      cleanup();
    },
    { once: true },
  );
}

function openPdfInNewTab(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  revokeAfterOpened(win, url);
  return true;
}

export async function downloadPdf(pdf: jsPDF, filename: string): Promise<void> {
  if (!isIOS()) {
    pdf.save(filename);
    return;
  }

  const blob = pdf.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  if (typeof navigator.canShare === "function" && typeof navigator.share === "function") {
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    }
  }

  if (!openPdfInNewTab(blob)) {
    throw new Error("Gagal membuka PDF: pop-up diblokir oleh browser");
  }
}