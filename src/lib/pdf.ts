// Client-only PDF download helper.
// Uses html2canvas-pro (supports modern CSS color functions like oklch that
// Tailwind v4 emits) + jsPDF. html2pdf.js relies on the legacy html2canvas
// which throws on oklch(), silently breaking downloads.
export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDocument) => {
      clonedDocument.querySelectorAll<HTMLElement>(".print-only").forEach((node) => {
        node.style.display = "block";
      });
      clonedDocument.querySelectorAll<HTMLElement>(".no-print, [data-no-print]").forEach((node) => {
        node.style.display = "none";
      });
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH - margin * 2) {
    pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);
  } else {
    // Slice tall canvas across multiple A4 pages.
    const pxPerMm = canvas.width / imgW;
    const pageSlicePx = (pageH - margin * 2) * pxPerMm;
    let offsetPx = 0;
    let pageIndex = 0;
    while (offsetPx < canvas.height) {
      const sliceH = Math.min(pageSlicePx, canvas.height - offsetPx);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceData = slice.toDataURL("image/jpeg", 0.95);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", margin, margin, imgW, (sliceH * imgW) / canvas.width);
      offsetPx += sliceH;
      pageIndex += 1;
    }
  }

  pdf.save(filename);
}
