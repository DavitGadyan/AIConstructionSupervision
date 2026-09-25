/**
 * Generates the demo project's "official" documents as real PDFs, from the same
 * data as the seed (lib/domain/demo.ts), so Claude extraction can be tested on
 * them and the report annexes something that looks like the genuine article.
 * Every page carries a SAMPLE watermark - these are synthetic.
 *
 *   npx tsx scripts/make-sample-docs.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { DEMO, demoMilestones } from "../lib/domain/demo";
import { PHASE_LABEL } from "../lib/domain/schedule";

const OUT = "data/samples";
const ink = rgb(0.11, 0.13, 0.15);
const muted = rgb(0.4, 0.42, 0.44);
const accent = rgb(0.04, 0.56, 0.64);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function watermark(page: PDFPage, font: PDFFont) {
  const { width, height } = page.getSize();
  page.drawText("SAMPLE - SYNTHETIC DEMO DOCUMENT", { x: 70, y: height / 2 - 120, size: 30, font, color: rgb(0.85, 0.2, 0.15), opacity: 0.13, rotate: degrees(35) });
  page.drawText("Generated for control.io demonstration purposes. Not an official record.", { x: 40, y: 18, size: 7, font, color: muted });
  void width;
}

function header(page: PDFPage, bold: PDFFont, font: PDFFont, title: string, sub: string, pageNo: number, total: number) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: accent });
  page.drawText(title, { x: 40, y: height - 44, size: 15, font: bold, color: ink });
  page.drawText(sub, { x: 40, y: height - 60, size: 9, font, color: muted });
  page.drawText(`Page ${pageNo} of ${total}`, { x: width - 100, y: height - 44, size: 9, font, color: muted });
  page.drawLine({ start: { x: 40, y: height - 70 }, end: { x: width - 40, y: height - 70 }, thickness: 0.6, color: muted });
}

async function schedule() {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${DEMO.project.name} - Baseline Construction Schedule Rev. 2`);
  pdf.setAuthor(DEMO.project.developer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ms = demoMilestones();
  const rowsPerPage = 34;
  const pages = 1 + Math.ceil(ms.length / rowsPerPage);
  const title = "BASELINE CONSTRUCTION SCHEDULE - REV. 2";
  const sub = `${DEMO.project.name} | ${DEMO.project.address} | Permit ${DEMO.project.permitNo}`;

  // cover
  const cover = pdf.addPage([595, 842]);
  header(cover, bold, font, title, sub, 1, pages);
  const lines: [string, string][] = [
    ["Project", DEMO.project.name],
    ["Developer / Employer", DEMO.project.developer],
    ["Building", `${DEMO.project.floorsTotal} storeys above ground, storey height ${DEMO.project.floorHeightM} m`],
    ["Commencement", fmt(DEMO.project.startDate)],
    ["Contractual completion", fmt(DEMO.project.plannedCompletion)],
    ["Schedule status", "Approved baseline, revision 2, issued 2026-02-16"],
    ["Structure cycle", `${DEMO.structureDays} calendar days per storey from ${fmt(DEMO.structureStart)}`],
  ];
  lines.forEach(([k, v], i) => {
    cover.drawText(k, { x: 40, y: 720 - i * 26, size: 10, font: bold, color: ink });
    cover.drawText(v, { x: 200, y: 720 - i * 26, size: 10, font, color: ink });
  });
  cover.drawText("Approved by:", { x: 40, y: 480, size: 10, font: bold, color: ink });
  cover.drawText(`Chief Engineer, ${DEMO.project.developer} (sample signatory)`, { x: 40, y: 462, size: 10, font, color: ink });
  cover.drawText("Activity dates in the following tables are contractual milestones under clause 8.2 of the construction contract.", { x: 40, y: 420, size: 9, font, color: muted });
  watermark(cover, bold);

  // tables
  for (let p = 0; p < pages - 1; p++) {
    const page = pdf.addPage([595, 842]);
    header(page, bold, font, title, sub, p + 2, pages);
    const cols = [40, 90, 150, 330, 420, 500];
    ["ID", "Level", "Activity", "Start", "Finish", "Days"].forEach((h, i) => page.drawText(h, { x: cols[i], y: 750, size: 9, font: bold, color: ink }));
    ms.slice(p * rowsPerPage, (p + 1) * rowsPerPage).forEach((m, i) => {
      const y = 730 - i * 19;
      if (i % 2 === 0) page.drawRectangle({ x: 36, y: y - 5, width: 523, height: 17, color: rgb(0.95, 0.96, 0.97) });
      const days = Math.round((m.plannedEnd.getTime() - m.plannedStart.getTime()) / 86_400_000);
      const activity = {
        structure: "Frame: columns, core walls, slab pour",
        envelope: "External walls & facade panels",
        glazing: "Windows & glazing installation",
        finishes: "Interior finishes & MEP fit-out",
      }[m.phase];
      const cells = [`A-${String(p * rowsPerPage + i + 1).padStart(3, "0")}`, `L${String(m.floor).padStart(2, "0")}`, `${PHASE_LABEL[m.phase]} - ${activity}`, fmt(m.plannedStart), fmt(m.plannedEnd), String(days)];
      cells.forEach((c, j) => page.drawText(c, { x: cols[j], y, size: 8.5, font, color: ink }));
    });
    watermark(page, bold);
  }
  await writeFile(`${OUT}/baseline-schedule-rev2.pdf`, await pdf.save());
}

async function simpleDoc(file: string, title: string, sub: string, paragraphs: string[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  header(page, bold, font, title, sub, 1, 1);
  let y = 740;
  for (const para of paragraphs) {
    const isHeading = para.startsWith("#");
    const text = isHeading ? para.slice(1).trim() : para;
    const words = text.split(" ");
    let line = "";
    const f = isHeading ? bold : font;
    const size = isHeading ? 11 : 9.5;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > 510) {
        page.drawText(line, { x: 40, y, size, font: f, color: ink });
        y -= size + 5;
        line = w;
      } else line = next;
    }
    if (line) page.drawText(line, { x: 40, y, size, font: f, color: ink });
    y -= size + (isHeading ? 8 : 12);
  }
  watermark(page, bold);
  await writeFile(`${OUT}/${file}`, await pdf.save());
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await schedule();
  await simpleDoc(
    "building-permit.pdf",
    `BUILDING PERMIT No. ${DEMO.project.permitNo}`,
    "City Building Control Authority (sample issuer) | Issued 2025-12-18",
    [
      "# Permit holder",
      `${DEMO.project.developer}, developer of ${DEMO.project.name}, ${DEMO.project.address}.`,
      "# Scope",
      `Construction of a residential building of ${DEMO.project.floorsTotal} storeys above ground with an underground parking level, reinforced-concrete frame, total above-ground height not exceeding 55 m.`,
      "# Validity and conditions",
      `Works shall commence no later than ${fmt(DEMO.project.startDate)} and be completed, including external works, by ${fmt(DEMO.project.plannedCompletion)}.`,
      "The permit holder shall execute the works in accordance with the approved baseline construction schedule and shall notify the Authority of any deviation exceeding 30 calendar days on a critical-path activity within 10 working days.",
      "The Authority and parties financing the project may carry out independent inspections, including aerial surveys, at any time during the works.",
    ],
  );
  await simpleDoc(
    "construction-contract-extract.pdf",
    "CONSTRUCTION CONTRACT - EXTRACT (CLAUSES 8.2 - 8.7)",
    `${DEMO.project.developer} and General Contractor (sample parties) | Signed 2026-01-02`,
    [
      "# 8.2 Programme",
      "The Contractor shall carry out the Works in accordance with the Baseline Construction Schedule (Rev. 2), whose activity start and finish dates are contractual milestones.",
      "# 8.4 Completion",
      `The Works shall be completed by ${fmt(DEMO.project.plannedCompletion)} (the Time for Completion).`,
      "# 8.6 Delay damages",
      "If the Contractor fails to achieve a structural-frame milestone by its finish date, the Contractor shall pay delay damages of 0.05% of the Contract Price for every day between the milestone finish date and the date of actual achievement, capped at 10% of the Contract Price.",
      "# 8.7 Evidence of progress",
      "Progress shall be evidenced by dated aerial photography and 3D survey carried out by an independent supervisor appointed by the Employer or the financing bank. Such records shall be accepted as evidence of the state of the Works on the date of capture.",
    ],
  );
  console.log("wrote", OUT);
}

main();
