import "server-only";
import { PDFDocument } from "pdf-lib";

/** Merges several label PDFs (and PNG/JPEG label images) into one printable PDF. */
export async function mergeLabels(files: { data: Buffer; type?: string }[]): Promise<Buffer> {
  if (files.length === 1 && (!files[0].type || files[0].type === "application/pdf")) return files[0].data;
  const out = await PDFDocument.create();
  for (const f of files) {
    const type = f.type ?? "application/pdf";
    if (type === "application/pdf") {
      const src = await PDFDocument.load(f.data, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else if (type === "image/png" || type === "image/jpeg") {
      const img = type === "image/png" ? await out.embedPng(f.data) : await out.embedJpg(f.data);
      // A6 page (105×148 mm) in points, image scaled to fit
      const W = 297.6;
      const H = 419.5;
      const s = Math.min(W / img.width, H / img.height);
      const page = out.addPage([W, H]);
      page.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
    }
  }
  return Buffer.from(await out.save());
}
