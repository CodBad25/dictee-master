import { jsPDF } from "jspdf";

interface StudentExport {
  name: string;
  scores: Record<string, number>; // dicteeId → bestPct
  attempts: number;
  totalStars: number;
  note20: number;
}

interface DicteeInfo {
  id: string;
  position: number;
  title: string;
}

const C = {
  primary: [124, 58, 237] as [number, number, number],   // purple-600
  dark: [15, 23, 42] as [number, number, number],
  gray: [100, 116, 139] as [number, number, number],
  light: [226, 232, 240] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  gold: [218, 165, 32] as [number, number, number],
};

export function generateClassPDF(
  students: StudentExport[],
  dictees: DicteeInfo[],
  className: string,
  displayName: (n: string) => string
) {
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, mx = 8;

  // Header
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, W, 16, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 16, W, 1.2, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DICTÉEMASTER", mx, 8);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Bilan de classe — Orthographe", mx, 13);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(className, W - mx, 8, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), W - mx, 13, { align: "right" });

  let y = 22;

  // Stats globales
  const notes = sorted.map((s) => s.note20);
  const avg = notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
  const sortedNotes = [...notes].sort((a, b) => a - b);
  const median = sortedNotes.length === 0 ? 0 : sortedNotes.length % 2 === 0 ? (sortedNotes[sortedNotes.length / 2 - 1] + sortedNotes[sortedNotes.length / 2]) / 2 : sortedNotes[Math.floor(sortedNotes.length / 2)];
  const min = notes.length > 0 ? Math.min(...notes) : 0;
  const max = notes.length > 0 ? Math.max(...notes) : 0;

  // Cards
  const cards = [
    { l: "Moyenne", v: avg.toFixed(1) + "/20" },
    { l: "Médiane", v: median.toFixed(1) + "/20" },
    { l: "Min", v: min + "/20" },
    { l: "Max", v: max + "/20" },
    { l: "Élèves", v: sorted.length.toString() },
  ];
  const cw = 28, ch = 14;
  cards.forEach((c, i) => {
    const cx = mx + i * (cw + 4);
    doc.setFillColor(...C.bg);
    doc.roundedRect(cx, y, cw, ch, 1.5, 1.5, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text(c.v, cx + cw / 2, y + 8, { align: "center" });
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.gray);
    doc.text(c.l, cx + cw / 2, y + 12, { align: "center" });
  });

  // Histogramme
  const hx = mx + 5 * (cw + 4) + 8, hw = 60, hh = ch;
  const bins = [0, 0, 0, 0, 0];
  const binLabels = ["0-4", "5-8", "9-12", "13-16", "17-20"];
  const binColors: [number, number, number][] = [C.red, C.amber, [234, 179, 8], C.green, C.primary];
  notes.forEach((n) => { bins[n <= 4 ? 0 : n <= 8 ? 1 : n <= 12 ? 2 : n <= 16 ? 3 : 4]++; });
  const maxBin = Math.max(...bins, 1);
  const bw = (hw - 4) / 5;
  bins.forEach((count, i) => {
    const bh = (count / maxBin) * (hh - 6);
    const bx = hx + 2 + i * bw + 1;
    const by = y + hh - bh;
    doc.setFillColor(...binColors[i]);
    if (bh > 0) doc.roundedRect(bx, by, bw - 2, bh, 0.8, 0.8, "F");
    if (count > 0) { doc.setFontSize(5.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.dark); doc.text(count.toString(), bx + (bw - 2) / 2, by - 1, { align: "center" }); }
    doc.setFontSize(5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.gray); doc.text(binLabels[i], bx + (bw - 2) / 2, y + hh + 3, { align: "center" });
  });

  y += ch + 10;

  // Tableau élèves
  const numDictees = Math.min(dictees.length, 26);
  const nameW = 34;
  const colW = (W - 2 * mx - nameW - 36) / numDictees; // 36 = stars + note + ess
  const headerH = 5;
  const availH = H - y - headerH - 12;
  const rowH = Math.min(5, Math.max(3.2, availH / sorted.length));
  const fs = rowH < 4 ? 5 : 6;
  const ty = rowH * 0.65;

  // Header tableau
  doc.setFillColor(...C.primary);
  doc.rect(mx, y, W - 2 * mx, headerH, "F");
  doc.setFontSize(fs);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("Élève", mx + 1, y + headerH * 0.7);
  let hcx = mx + nameW;
  dictees.slice(0, numDictees).forEach((d) => {
    doc.text(d.position.toString(), hcx + colW / 2, y + headerH * 0.7, { align: "center" });
    hcx += colW;
  });
  doc.text("⭐", hcx + 6, y + headerH * 0.7, { align: "center" }); hcx += 12;
  doc.text("Note", hcx + 6, y + headerH * 0.7, { align: "center" }); hcx += 12;
  doc.text("Ess", hcx + 6, y + headerH * 0.7, { align: "center" });
  y += headerH;

  // Lignes
  sorted.forEach((s, idx) => {
    if (idx % 2 === 0) { doc.setFillColor(...C.bg); doc.rect(mx, y, W - 2 * mx, rowH, "F"); }
    doc.setFontSize(fs);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    const dn = displayName(s.name);
    const short = dn.split(" ")[0] + " " + (dn.split(" ").pop()?.[0] || "") + ".";
    doc.text(short, mx + 1, y + ty);

    let cx = mx + nameW;
    dictees.slice(0, numDictees).forEach((d) => {
      const pct = s.scores[d.id];
      if (pct !== undefined) {
        if (pct >= 80) doc.setTextColor(...C.green);
        else if (pct >= 50) doc.setTextColor(...C.amber);
        else doc.setTextColor(...C.red);
        doc.setFont("helvetica", "bold");
        doc.text(Math.round(pct * 20 / 100).toString(), cx + colW / 2, y + ty, { align: "center" });
      } else {
        doc.setTextColor(...C.light);
        doc.text("-", cx + colW / 2, y + ty, { align: "center" });
      }
      cx += colW;
    });

    doc.setTextColor(...C.dark);
    doc.setFont("helvetica", "normal");
    doc.text(s.totalStars > 0 ? s.totalStars.toString() : "-", cx + 6, y + ty, { align: "center" }); cx += 12;

    const n = s.note20;
    if (n >= 16) doc.setTextColor(...C.green); else if (n >= 10) doc.setTextColor(...C.amber); else doc.setTextColor(...C.red);
    doc.setFont("helvetica", "bold");
    doc.text(n > 0 ? `${n}/20` : "-", cx + 6, y + ty, { align: "center" }); cx += 12;

    doc.setTextColor(...C.gray);
    doc.setFont("helvetica", "normal");
    doc.text(s.attempts > 0 ? s.attempts.toString() : "-", cx + 6, y + ty, { align: "center" });

    y += rowH;
  });

  // Ligne moyenne
  doc.setFillColor(...C.primary);
  doc.rect(mx, y, W - 2 * mx, headerH, "F");
  doc.setFontSize(fs);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("Moyenne", mx + 1, y + headerH * 0.7);

  let fx = mx + nameW;
  dictees.slice(0, numDictees).forEach((d) => {
    const scores = sorted.map((s) => s.scores[d.id]).filter((s) => s !== undefined);
    if (scores.length > 0) {
      const a = (scores.reduce((sum, s) => sum + s, 0) / scores.length * 20 / 100).toFixed(1);
      doc.text(a, fx + colW / 2, y + headerH * 0.7, { align: "center" });
    }
    fx += colW;
  });
  doc.text(avg.toFixed(1) + "/20", fx + 18, y + headerH * 0.7, { align: "center" });

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(...C.gray);
  doc.text(`DictéeMaster — ${className}`, mx, H - 4);
  doc.text("dictee-master.vercel.app", W / 2, H - 4, { align: "center" });
  doc.text(new Date().toLocaleDateString("fr-FR"), W - mx, H - 4, { align: "right" });

  doc.save(`dictee-master_${className}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Export Pronote : copie dans le presse-papier (Note + Compétences)
export function exportPronote(students: StudentExport[], dictees: DicteeInfo[]) {
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const lines = sorted.map((s) => {
    const noteStr = s.note20.toString().replace(".", ",");
    const nbDictees = Object.keys(s.scores).length;
    const avgPct = nbDictees > 0 ? Object.values(s.scores).reduce((a, b) => a + b, 0) / nbDictees : 0;
    const comp1 = nbDictees >= 6 && s.attempts >= 15 ? "A" : nbDictees >= 4 && s.attempts >= 10 ? "B" : nbDictees >= 2 && s.attempts >= 5 ? "C" : "D";
    const comp2 = avgPct >= 80 ? "A" : avgPct >= 60 ? "B" : avgPct >= 40 ? "C" : "D";
    return `${noteStr}\t${comp1}\t${comp2}`;
  });
  navigator.clipboard.writeText(lines.join("\n"));
}

// Export CSV/Excel
export function exportExcel(students: StudentExport[], dictees: DicteeInfo[], className: string, displayName: (n: string) => string) {
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const header = ["Élève", ...dictees.map((d) => `D${d.position}`), "Étoiles", "Note/20", "Essais"];
  const rows = sorted.map((s) => {
    const scores = dictees.map((d) => s.scores[d.id] !== undefined ? Math.round(s.scores[d.id] * 20 / 100).toString() : "");
    return [displayName(s.name), ...scores, s.totalStars.toString(), s.note20.toString(), s.attempts.toString()];
  });
  const csv = "\uFEFF" + [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dictee-master_${className}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
