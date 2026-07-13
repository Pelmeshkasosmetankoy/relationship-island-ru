import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { tr } from '../i18n';

// Export a world's memories as a printable PDF "book" or a ZIP backup (full-size
// photos + a readable HTML + a plain-text list). Heavy libraries (jsPDF, JSZip,
// html2canvas) are imported lazily so they don't weigh down app startup.

function byDate(a, b) { return new Date(a.dateISO) - new Date(b.dateISO); }

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function fetchPhoto(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return { blob, dataUrl: await blobToDataUrl(blob) };
  } catch { return null; }
}

function extFromType(mime) {
  if (mime && mime.includes('png')) return 'png';
  if (mime && mime.includes('webp')) return 'webp';
  return 'jpg';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

const DOC_STYLE = `
.export-doc{ font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; color:#241d2e; background:#fff; padding:34px; box-sizing:border-box; }
.export-doc .cover{ text-align:center; margin:0 0 34px; }
.export-doc .cover h1{ font-size:30px; margin:0 0 6px; }
.export-doc .cover p{ color:#8a7f95; margin:0; font-size:14px; }
.export-doc .m{ page-break-inside:avoid; margin:0 0 24px; padding-bottom:20px; border-bottom:1px solid #ececec; }
.export-doc .m .d{ color:#b08a3a; font-weight:600; font-size:13px; letter-spacing:.03em; }
.export-doc .m .t{ font-size:18px; margin:3px 0 8px; }
.export-doc .m .n{ font-size:14px; line-height:1.5; white-space:pre-wrap; margin:0 0 10px; }
.export-doc .m img{ max-width:100%; border-radius:8px; display:block; }
`;

function memoryItemHtml(ev, photoSrc) {
  const note = ev.note ? `<p class="n">${escapeHtml(ev.note)}</p>` : '';
  const img = photoSrc ? `<img src="${photoSrc}" alt="">` : '';
  return `<div class="m"><div class="d">${escapeHtml(ev.date)}</div>`
    + `<div class="t">${escapeHtml(tr('type_' + ev.type))}</div>${note}${img}</div>`;
}

function bodyHtml(items) {
  return `<div class="export-doc">`
    + `<div class="cover"><h1>${escapeHtml(tr('export_title'))}</h1>`
    + `<p>${escapeHtml(tr('export_cover_sub'))}</p></div>`
    + items.join('') + `</div>`;
}

// deliver a blob as a file: native → save to cache + open the share sheet;
// web → trigger a normal download.
async function saveFile(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const dataUrl = await blobToDataUrl(blob);
    const res = await Filesystem.writeFile({
      path: filename,
      data: dataUrl.split(',')[1],
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: res.uri });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}

// ---- ZIP: full-size photos + readable HTML + plain text ----
export async function exportZip(events, code, onProgress) {
  const JSZip = (await import('jszip')).default;
  const sorted = [...events].sort(byDate);
  const zip = new JSZip();
  const photos = zip.folder('photos');
  const items = [];
  const txt = [`${tr('export_title')} (${code})`, ''];

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    onProgress && onProgress(i + 1, sorted.length);
    txt.push(`${ev.date} — ${tr('type_' + ev.type)}`);
    if (ev.note) txt.push(ev.note);
    txt.push('');
    let rel = null;
    if (ev.photo) {
      const p = await fetchPhoto(ev.photo);
      if (p) {
        const name = `${String(i + 1).padStart(3, '0')}.${extFromType(p.blob.type)}`;
        photos.file(name, p.blob);
        rel = `photos/${name}`;
      }
    }
    items.push(memoryItemHtml(ev, rel));
  }

  zip.file('memories.txt', txt.join('\n'));
  zip.file('memories.html', `<!doctype html><html lang="ru"><head><meta charset="utf-8">`
    + `<title>${escapeHtml(tr('export_title'))}</title><style>${DOC_STYLE}</style></head>`
    + `<body style="margin:0">${bodyHtml(items)}</body></html>`);

  const blob = await zip.generateAsync({ type: 'blob' });
  await saveFile(blob, `nash-ostrov-${code}.zip`);
}

function imgSettled(img) {
  return new Promise((resolve) => {
    if (img.complete) return resolve();
    img.onload = img.onerror = () => resolve();
  });
}

// ---- PDF: a rendered "book" (handles Cyrillic + photos via html2canvas) ----
export async function exportPdf(events, code, onProgress) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const sorted = [...events].sort(byDate);

  const items = [];
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    onProgress && onProgress(i + 1, sorted.length);
    let src = null;
    if (ev.photo) {
      const p = await fetchPhoto(ev.photo);
      if (p) src = p.dataUrl;
    }
    items.push(memoryItemHtml(ev, src));
  }

  // render the document off-screen at A4 width (≈794px at 96dpi)
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed; left:-10000px; top:0; width:794px; background:#fff;';
  holder.innerHTML = `<style>${DOC_STYLE}</style>${bodyHtml(items)}`;
  document.body.appendChild(holder);
  await Promise.all(Array.from(holder.querySelectorAll('img')).map(imgSettled));

  try {
    const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    const blob = pdf.output('blob');
    await saveFile(blob, `nash-ostrov-${code}.pdf`);
  } finally {
    holder.remove();
  }
}
