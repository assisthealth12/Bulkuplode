import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import type { Color } from 'pdf-lib'
import type { StudentData } from './validation'
import { parseExcelDate } from './utils'

// ---------------------------------------------------------------------------
// Layout constants — tweak these instead of hunting for magic numbers below.
// ---------------------------------------------------------------------------
const PAGE_SIZE: [number, number] = [595.28, 841.89] // A4
const MARGIN = 30
const FOOTER_HEIGHT = 70 // reserved space at bottom for the footer block
const ROW_HEIGHT = 20
const BLACK = rgb(0, 0, 0)
const GREY_TEXT = rgb(0.3, 0.3, 0.3)

const FOOTER_LINE_1 = 'AssistHealth | Personalised • Connected • Continuum Care'
const FOOTER_LINE_2 =
  '#850, 3rd Floor, Sahakara Nagar Main Road, Bengaluru - 560092  |  +91 96112 32519  |  www.assisthealth.in'

interface Fonts {
  regular: PDFFont
  bold: PDFFont
  boldItalic: PDFFont
}

// ---------------------------------------------------------------------------
// Small text utilities
// ---------------------------------------------------------------------------

/** Truncates text with an ellipsis so it never overflows a given width. */
function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  const ellipsis = '…'
  let result = text
  while (result.length > 0 && font.widthOfTextAtSize(result + ellipsis, size) > maxWidth) {
    result = result.slice(0, -1)
  }
  return result + ellipsis
}

/** Greedily wraps text into lines that fit within maxWidth, capped at maxLines. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length === maxLines - 1) break
    }
  }
  if (current && lines.length < maxLines) lines.push(current)

  // If we truncated words that didn't fit, mark the last line with an ellipsis.
  const consumed = lines.join(' ').split(/\s+/).length
  if (consumed < words.length && lines.length > 0) {
    lines[lines.length - 1] = fitText(lines[lines.length - 1] + '…', font, size, maxWidth)
  }
  return lines
}



/**
 * Computes BMI from height/weight, handling the common data-entry ambiguity
 * where height is given in feet.inches (e.g. 5.6 => 5'6") rather than cm.
 * Returns '' when the inputs are missing or not physically plausible.
 */
function computeBMI(heightRaw: unknown, weightRaw: unknown): string {
  if (!heightRaw || !weightRaw) return ''
  let h = Number(heightRaw)
  const w = Number(weightRaw)
  if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) return ''

  // Heuristic: anything under 10 is almost certainly feet.inches, not cm.
  if (h < 10) {
    const feet = Math.floor(h)
    const inches = Math.round((h - feet) * 10)
    h = (feet * 12 + inches) * 2.54
  }

  if (h <= 50 || h >= 300) return '' // outside plausible human height in cm
  const m = h / 100
  const bmi = w / (m * m)
  return isFinite(bmi) ? bmi.toFixed(1) : ''
}

// ---------------------------------------------------------------------------
// Drawing helpers bound to a page/font context
// ---------------------------------------------------------------------------

class FormRenderer {
  private page: PDFPage
  private fonts: Fonts
  private width: number
  private pdfDoc: PDFDocument
  currentY: number

  constructor(pdfDoc: PDFDocument, page: PDFPage, fonts: Fonts) {
    this.pdfDoc = pdfDoc
    this.page = page
    this.fonts = fonts
    const { width, height } = page.getSize()
    this.width = width
    this.currentY = height
  }

  /** Ensures there is at least `needed` vertical space left; adds a new page if not. */
  private ensureSpace(needed: number) {
    if (this.currentY - needed < FOOTER_HEIGHT + MARGIN) {
      this.drawFooter()
      this.page = this.pdfDoc.addPage(PAGE_SIZE)
      const { width, height } = this.page.getSize()
      this.width = width
      this.currentY = height - MARGIN - 10
    }
  }

  ensureSpacePublic(needed: number) {
    this.ensureSpace(needed)
  }

  text(str: string, x: number, y: number, size: number, font: PDFFont, color: Color = BLACK) {
    this.page.drawText(str, { x, y, size, font, color })
  }

  line(x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color: Color = BLACK) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
  }

  rect(x: number, y: number, w: number, h: number, opts: { border?: boolean; fill?: Color } = {}) {
    this.page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: opts.border === false ? undefined : BLACK,
      borderWidth: opts.border === false ? 0 : 1,
      color: opts.fill,
    })
  }

  drawImageFit(bytes: ArrayBuffer, kind: 'png' | 'jpg', x: number, y: number, maxW: number, maxH: number) {
    return (kind === 'png' ? this.pdfDoc.embedPng(bytes) : this.pdfDoc.embedJpg(bytes)).then((img) => {
      const dims = img.scaleToFit(maxW, maxH)
      this.page.drawImage(img, { x, y: y - dims.height, width: dims.width, height: dims.height })
      return dims
    })
  }

  drawSectionHeader(label: string) {
    this.ensureSpace(30)
    this.text(label, MARGIN + 10, this.currentY, 11, this.fonts.bold, GREY_TEXT)
    this.currentY -= 20
  }

  drawSubHeader(label: string) {
    this.currentY -= 15
    this.text(label, MARGIN + 10, this.currentY, 10, this.fonts.boldItalic)
    this.currentY -= 6
  }

  /** Draws a two-column label/value row with an underline for each value. */
  drawRow(label1: string, val1: string, label2: string, val2: string) {
    this.ensureSpacePublic(ROW_HEIGHT)
    const colMid = this.width / 2

    const label1Width = this.fonts.bold.widthOfTextAtSize(label1, 10)
    const val1X = MARGIN + 10 + label1Width + 5
    // If no label2, let line 1 span to the right margin
    const endX1 = label2 ? colMid - 20 : this.width - MARGIN - 20

    this.text(label1, MARGIN + 10, this.currentY, 10, this.fonts.bold)
    this.text(fitText(val1, this.fonts.regular, 10, endX1 - val1X), val1X, this.currentY, 10, this.fonts.regular)
    this.line(val1X, this.currentY - 2, endX1, this.currentY - 2)

    if (label2) {
      const label2Width = this.fonts.bold.widthOfTextAtSize(label2, 10)
      const val2X = colMid + 10 + label2Width + 5
      const endX2 = this.width - MARGIN - 20
      
      this.text(label2, colMid + 10, this.currentY, 10, this.fonts.bold)
      this.text(
        fitText(val2, this.fonts.regular, 10, endX2 - val2X),
        val2X,
        this.currentY,
        10,
        this.fonts.regular
      )
      this.line(val2X, this.currentY - 2, endX2, this.currentY - 2)
    }
    this.currentY -= ROW_HEIGHT
  }

  /** Draws a grid of cells given column widths and row heights, anchored at currentY. */
  drawGrid(colWidths: number[], rowHeights: number[]) {
    const startX = MARGIN
    const startY = this.currentY
    const totalWidth = colWidths.reduce((a, b) => a + b, 0)
    let y = startY

    this.line(startX, y, startX + totalWidth, y)
    for (const rh of rowHeights) {
      y -= rh
      this.line(startX, y, startX + totalWidth, y)
    }

    let x = startX
    this.line(x, startY, x, y)
    for (const cw of colWidths) {
      x += cw
      this.line(x, startY, x, y)
    }
    return { startX, startY, totalWidth }
  }

  drawCommentRow(label: string, value: string, labelColWidth: number, tableWidth: number, rowHeight = 28) {
    // Vertically align label near center of the row.
    this.text(label, MARGIN + 5, this.currentY - (rowHeight / 2 + 4), 9, this.fonts.bold)
    const maxWidth = tableWidth - labelColWidth - 10
    const lines = wrapText(String(value || ''), this.fonts.regular, 9, maxWidth, 2)
    const startY = lines.length > 1 ? this.currentY - (rowHeight / 2 - 3) : this.currentY - (rowHeight / 2 + 4)
    lines.forEach((line, i) => {
      this.text(line, MARGIN + labelColWidth + 5, startY - i * 12, 9, this.fonts.regular)
    })
  }

  drawFooter() {
    this.line(MARGIN, FOOTER_HEIGHT, this.width - MARGIN, FOOTER_HEIGHT, 1)
    this.text(
      FOOTER_LINE_1,
      this.width / 2 - this.fonts.bold.widthOfTextAtSize(FOOTER_LINE_1, 8) / 2,
      FOOTER_HEIGHT - 15,
      8,
      this.fonts.bold
    )
    this.text(
      FOOTER_LINE_2,
      this.width / 2 - this.fonts.regular.widthOfTextAtSize(FOOTER_LINE_2, 8) / 2,
      FOOTER_HEIGHT - 30,
      8,
      this.fonts.regular
    )
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateStudentPDF(
  student: StudentData,
  logo1Bytes: ArrayBuffer,
  logo2Bytes: ArrayBuffer,
  signatureBytes?: ArrayBuffer
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage(PAGE_SIZE)
  const { width, height } = page.getSize()

  const [regular, bold, boldItalic] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
    pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  ])
  const fonts: Fonts = { regular, bold, boldItalic }

  const r = new FormRenderer(pdfDoc, page, fonts)

  // --- Logos -----------------------------------------------------------
  const logoTop = height - 40
  try {
    await r.drawImageFit(logo1Bytes, 'png', MARGIN + 10, logoTop, 90, 60)
  } catch {
    try {
      await r.drawImageFit(logo1Bytes, 'jpg', MARGIN + 10, logoTop, 90, 60)
    } catch {
      console.warn('Failed to embed logo 1 (tried PNG and JPG)')
    }
  }

  try {
    await r.drawImageFit(logo2Bytes, 'jpg', width - MARGIN - 70, logoTop, 60, 60)
  } catch {
    try {
      await r.drawImageFit(logo2Bytes, 'png', width - MARGIN - 70, logoTop, 60, 60)
    } catch {
      console.warn('Failed to embed logo 2 (tried JPG and PNG)')
    }
  }

  // --- Outer border --------------------------------------------------------
  // Draws a border around the entire page content
  r.rect(MARGIN, MARGIN, width - 2 * MARGIN, height - 2 * MARGIN, { border: true })

  // --- Title box ---------------------------------------------------------
  const titleCenterY = height - 70
  const subtitleText = 'AHANA School Health Programme • AssistHealth'
  const titleText = 'Health Assessment Form'
  
  // Make the box bordered, vertically aligned with logos
  r.rect(MARGIN + 110, titleCenterY - 22.5, width - 2 * MARGIN - 220, 45, { border: true })
  
  // Draw Title (bold)
  r.text(titleText, width / 2 - fonts.bold.widthOfTextAtSize(titleText, 14) / 2, titleCenterY + 4, 14, fonts.bold)
  // Draw Subtitle (smaller, italic) below title
  r.text(subtitleText, width / 2 - fonts.boldItalic.widthOfTextAtSize(subtitleText, 9) / 2, titleCenterY - 10, 9, fonts.boldItalic)

  r.currentY = height - 110
  r.line(MARGIN, r.currentY, width - MARGIN, r.currentY, 1)
  r.currentY -= 10

  // --- Student details -----------------------------------------------------
  r.ensureSpacePublic(25)
  r.text('Student Details', MARGIN + 10, r.currentY, 11, fonts.bold)
  r.currentY -= 5
  r.line(MARGIN + 10, r.currentY, width - MARGIN - 10, r.currentY, 1)
  r.currentY -= 15

  const classSec =
    student['Class'] && student['Section']
      ? `${student['Class']} - ${student['Section']}`
      : student['Class'] || student['Section'] || ''
  const dob = parseExcelDate(student['Date of Birth'])

  r.drawRow('Student Name:', String(student['Student Name'] || ''), 'Class & Section:', classSec)
  r.drawRow('Date of Birth:', dob, 'Age:', String(student['Age'] || ''))
  r.drawRow('Gender (Male / Female):', String(student['Gender'] || ''), 'Parent Contact Number:', String(student['Parent Contact Number'] || ''))
  r.drawRow('Parent / Guardian Name:', String(student['Parent / Guardian Name'] || ''), '', '')

  r.currentY -= 5
  r.line(MARGIN, r.currentY, width - MARGIN, r.currentY, 1)
  r.currentY -= 10

  // --- Health assessment summary -------------------------------------------
  r.ensureSpacePublic(25)
  r.text('Health Assessment Summary', MARGIN + 10, r.currentY, 11, fonts.bold)
  r.currentY -= 5
  r.line(MARGIN + 10, r.currentY, width - MARGIN - 10, r.currentY, 1)
  r.currentY -= 15

  const tableWidth = width - 2 * MARGIN
  const cw2 = [tableWidth * 0.25, tableWidth * 0.25, tableWidth * 0.25, tableWidth * 0.25]

  // Physical assessment
  r.currentY -= 5
  r.text('Physical Assessment', MARGIN + 10, r.currentY, 10, fonts.boldItalic)
  r.currentY -= 6

  const gridTop = r.currentY
  r.drawGrid(cw2, [20, 20, 20, 20])

  const drawCellTxt = (txt: string, col: number, row: number, rh = 20) => {
    r.text(fitText(txt, fonts.regular, 9, cw2[col] - 10), MARGIN + col * cw2[0] + 5, gridTop - row * rh + 6, 9, fonts.regular)
  }

  const bmiStr = computeBMI(student['Height'], student['Weight'])

  drawCellTxt('Height', 0, 1)
  drawCellTxt(student['Height'] ? `${student['Height']} cm` : '', 1, 1)
  drawCellTxt('Weight', 2, 1)
  drawCellTxt(student['Weight'] ? `${student['Weight']} kg` : '', 3, 1)
  
  drawCellTxt('BMI', 0, 2)
  drawCellTxt(bmiStr, 1, 2)
  drawCellTxt('Temperature', 2, 2)
  drawCellTxt(student['Temperature'] ? `${student['Temperature']} °F` : '', 3, 2)
  
  drawCellTxt('SpO2', 0, 3)
  drawCellTxt(student['SpO2'] ? `${student['SpO2']}%` : '', 1, 3)
  drawCellTxt('Pulse', 2, 3)
  drawCellTxt(student['Pulse'] ? `${student['Pulse']} bpm` : '', 3, 3)
  
  // Blood Pressure spans across 2, 3, 4
  drawCellTxt('Blood Pressure (BP)', 0, 4)
  // clear the vertical lines inside the BP cell span (since drawGrid drew them)
  r.rect(MARGIN + cw2[0] + 1, gridTop - 80 + 1, cw2[1] + cw2[2] + cw2[3] - 2, 18, { border: false, fill: rgb(1,1,1) })
  r.text(fitText(String(student['Blood Pressure'] || ''), fonts.regular, 9, cw2[1] + cw2[2] + cw2[3] - 10), MARGIN + cw2[0] + 5, gridTop - 80 + 6, 9, fonts.regular)

  r.currentY -= 80

  // Vision
  r.currentY -= 12
  r.text('Vision', MARGIN + 10, r.currentY, 10, fonts.boldItalic)
  r.currentY -= 4
  const visionCols = [cw2[0] * 1.25, cw2[0] * 0.75, cw2[0] * 1.25, cw2[0] * 0.75]
  
  // Top row (4 columns)
  r.drawGrid(visionCols, [20])
  r.text('Right Eye Vision', MARGIN + 5, r.currentY - 14, 9, fonts.regular)
  r.text(String(student['Right Eye Vision'] || ''), MARGIN + visionCols[0] + 5, r.currentY - 14, 9, fonts.regular)
  r.text('Left Eye Vision', MARGIN + visionCols[0] + visionCols[1] + 5, r.currentY - 14, 9, fonts.regular)
  r.text(String(student['Left Eye Vision'] || ''), MARGIN + visionCols[0] + visionCols[1] + visionCols[2] + 5, r.currentY - 14, 9, fonts.regular)
  
  // Comments row (2 columns, 28px height for wrapping)
  r.currentY -= 20
  r.drawGrid([visionCols[0], tableWidth - visionCols[0]], [28])
  r.drawCommentRow('Comments', String(student['Vision Comments'] || ''), visionCols[0], tableWidth)
  r.currentY -= 28

  // Dental
  r.currentY -= 12
  r.text('Dental', MARGIN + 10, r.currentY, 10, fonts.boldItalic)
  r.currentY -= 4
  r.drawGrid([cw2[0], tableWidth - cw2[0]], [20])
  r.text('Findings', MARGIN + 5, r.currentY - 13, 9, fonts.bold)

  const dentalVals = String(student['Dental Findings'] || '').toLowerCase()
  const cbOpts = ['Normal', 'Decayed', 'Cross Bite', 'Dental Stains', 'Calculus', 'Other']
  const cbAreaWidth = tableWidth - cw2[0]
  const cbSpacing = cbAreaWidth / cbOpts.length
  const cbY = r.currentY - 13
  let cbX = MARGIN + cw2[0] + 5

  for (const opt of cbOpts) {
    r.rect(cbX, cbY - 1, 8, 8, { border: true })
    if (dentalVals.includes(opt.toLowerCase())) {
      r.line(cbX + 1, cbY + 3, cbX + 3, cbY + 1, 1)
      r.line(cbX + 3, cbY + 1, cbX + 7, cbY + 7, 1)
    }
    r.text(fitText(opt, fonts.regular, 8, cbSpacing - 15), cbX + 12, cbY, 8, fonts.regular)
    cbX += cbSpacing
  }

  r.currentY -= 20
  r.drawGrid([cw2[0], tableWidth - cw2[0]], [28])
  r.drawCommentRow('Comments', String(student['Dental Comments'] || ''), cw2[0], tableWidth)
  r.currentY -= 28

  // ENT
  r.currentY -= 12
  r.text('ENT', MARGIN + 10, r.currentY, 10, fonts.boldItalic)
  r.currentY -= 4
  r.drawGrid([cw2[0], tableWidth - cw2[0]], [28])
  r.drawCommentRow('Comments', String(student['ENT Comments'] || ''), cw2[0], tableWidth)
  r.currentY -= 28

  // General Health
  r.currentY -= 12
  r.text('General Health', MARGIN + 10, r.currentY, 10, fonts.boldItalic)
  r.currentY -= 4
  r.drawGrid([cw2[0], tableWidth - cw2[0]], [40])
  r.drawCommentRow('Comments', String(student['General Health Comments'] || ''), cw2[0], tableWidth, 40)
  r.currentY -= 40

  // --- Sign-off box --------------------------------------------------------
  r.currentY -= 5
  r.ensureSpacePublic(60)
  const signBoxY = r.currentY
  const signBoxH = 55
  
  // Row 1: Doctor name + Reg number
  r.text('School Nurse / Doctor Name:', MARGIN + 8, signBoxY - 15, 9, fonts.bold)
  r.line(MARGIN + 155, signBoxY - 17, width / 2 - 20, signBoxY - 17, 0.5)
  r.text(
    String(student['School Nurse / Doctor Name'] || ''),
    MARGIN + 160,
    signBoxY - 15,
    9,
    fonts.regular
  )
  
  r.text('Medical Reg. Number:', width / 2 + 10, signBoxY - 15, 9, fonts.bold)
  r.line(width / 2 + 120, signBoxY - 17, width - MARGIN - 10, signBoxY - 17, 0.5)
  r.text(
    String(student['Medical Reg. Number'] || ''),
    width / 2 + 125,
    signBoxY - 15,
    9,
    fonts.regular
  )

  // Signature Image (if provided) — position it so it sits just above the Signature line
  if (signatureBytes) {
    try {
      await r.drawImageFit(signatureBytes, 'png', MARGIN + 65, signBoxY - 18, 140, 25)
    } catch {
      try {
        await r.drawImageFit(signatureBytes, 'jpg', MARGIN + 65, signBoxY - 18, 140, 25)
      } catch {
        console.warn('[PDF] Failed to embed signature image')
      }
    }
  }

  // Row 2: Signature + Date
  r.text('Signature:', MARGIN + 8, signBoxY - 40, 9, fonts.bold)
  r.line(MARGIN + 65, signBoxY - 42, width / 2 - 20, signBoxY - 42, 0.5)
  
  const examDate = parseExcelDate(student['Date'])
  r.text('Date:', width / 2 + 10, signBoxY - 40, 9, fonts.bold)
  r.text(examDate, width / 2 + 45, signBoxY - 40, 9, fonts.regular)
  r.line(width / 2 + 40, signBoxY - 42, width - MARGIN - 10, signBoxY - 42, 0.5)

  r.currentY = signBoxY - signBoxH - 5
  
  // Footer separator
  r.line(MARGIN, r.currentY, width - MARGIN, r.currentY, 1)

  // --- Footer ------------------------------------------------------------
  r.drawFooter()

  return await pdfDoc.save()
}
