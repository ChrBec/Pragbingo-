import jsPDF from "jspdf";
import type { EventDoc, FeedPost } from "../types";

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

async function loadImageAsJpeg(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image load failed"));
        el.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      return {
        dataUrl: canvas.toDataURL("image/jpeg", 0.85),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function exportFeedToPdf(
  event: EventDoc,
  feed: FeedPost[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(24);
  doc.text(event.name, pageWidth / 2, 60, { align: "center" });
  doc.setFontSize(14);
  doc.text(`Foto-Feed · Bräutigam: ${event.groomName}`, pageWidth / 2, 72, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Erstellt am ${formatDate(Date.now())} · ${feed.length} Beiträge`, pageWidth / 2, 82, {
    align: "center",
  });
  doc.setTextColor(0);

  const sorted = [...feed].sort((a, b) => a.createdAt - b.createdAt);
  let done = 0;

  for (const post of sorted) {
    doc.addPage();
    let cursorY = margin;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(post.playerName, margin, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(formatDate(post.createdAt), pageWidth - margin, cursorY, { align: "right" });
    doc.setTextColor(0);
    cursorY += 7;

    if (post.missionText) {
      doc.setFontSize(10);
      doc.setTextColor(150, 60, 120);
      const missionLines = doc.splitTextToSize(`🎯 ${post.missionText}`, contentWidth);
      doc.text(missionLines, margin, cursorY);
      cursorY += missionLines.length * 5 + 3;
      doc.setTextColor(0);
    }

    if (post.type === "photo") {
      const image = await loadImageAsJpeg(post.url);
      if (image) {
        const maxImgHeight = pageHeight - cursorY - margin - 16;
        let renderWidth = contentWidth;
        let renderHeight = (image.height / image.width) * renderWidth;
        if (renderHeight > maxImgHeight) {
          renderHeight = maxImgHeight;
          renderWidth = (image.width / image.height) * renderHeight;
        }
        const x = margin + (contentWidth - renderWidth) / 2;
        doc.addImage(image.dataUrl, "JPEG", x, cursorY, renderWidth, renderHeight);
        cursorY += renderHeight + 6;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(180, 60, 60);
        doc.text("(Foto konnte nicht geladen werden)", margin, cursorY);
        doc.setTextColor(0);
        cursorY += 8;
      }
    } else {
      doc.setFontSize(11);
      doc.text("🎥 Video – online in der App ansehen", margin, cursorY);
      cursorY += 8;
    }

    if (post.caption) {
      doc.setFontSize(10);
      const captionLines = doc.splitTextToSize(post.caption, contentWidth);
      doc.text(captionLines, margin, cursorY);
    }

    done += 1;
    onProgress?.(done, sorted.length);
  }

  const safeName = event.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "event";
  doc.save(`${safeName}-feed.pdf`);
}
