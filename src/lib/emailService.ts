import type { StudentData } from "./validation"

/**
 * Email Service — sends student health report PDFs via the /api/send-email endpoint.
 *
 * Key design:
 *  - PDFs are generated in the browser (pdf-lib), converted to base64
 *  - Sent to a Vercel serverless function which forwards to MSG91
 *  - No PDFs are stored in any cloud storage
 *  - Sends in batches of 5 with 1.5s delay to avoid rate limits
 */

export interface EmailResult {
  studentName: string
  email: string
  status: "sent" | "failed" | "skipped"
  error?: string
}

export interface EmailProgress {
  total: number
  sent: number
  failed: number
  skipped: number
  currentStudent: string
  results: EmailResult[]
  isComplete: boolean
}

type ProgressCallback = (progress: EmailProgress) => void

/**
 * Converts a Uint8Array (PDF bytes) to a base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ""
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Sends a single email via the serverless endpoint.
 */
async function sendSingleEmail(
  to: string,
  studentName: string,
  className: string,
  pdfBase64: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        studentName,
        className,
        pdfBase64,
        fileName,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" }
  }
}

/**
 * Delays execution for the given milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sends emails for an entire batch of students.
 *
 * Flow:
 *  1. For each student, generates the PDF in-memory using pdf-lib
 *  2. Converts PDF bytes to base64
 *  3. Sends to /api/send-email (which forwards to MSG91)
 *  4. Processes in batches of 5 with a 1.5s delay between batches
 *  5. Reports progress via callback after each email
 *
 * Students without a "Mother's Email" are skipped.
 */
export async function sendBatchEmails(
  students: StudentData[],
  className: string,
  logo1Bytes: ArrayBuffer,
  logo2Bytes: ArrayBuffer,
  signatureBytes: ArrayBuffer | undefined,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<EmailProgress> {
  const progress: EmailProgress = {
    total: students.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    currentStudent: "",
    results: [],
    isComplete: false,
  }

  const { generateStudentPDF } = await import("./pdfGenerator")

  // MSG91 free plan: 500 emails/hour limit
  // Send 8 emails per batch, then wait 60 seconds = ~480/hr (safe margin)
  const BATCH_SIZE = 8
  const BATCH_DELAY_MS = 60000 // 60 seconds between batches

  for (let i = 0; i < students.length; i++) {
    // Check for abort
    if (abortSignal?.aborted) {
      break
    }

    const student = students[i]
    const studentName = String(student["Student Name"] || "Student")
    const email = String(student["Mother's Email"] || "").trim()

    progress.currentStudent = studentName
    onProgress({ ...progress })

    // Skip if no email
    if (!email) {
      progress.skipped++
      progress.results.push({
        studentName,
        email: "(none)",
        status: "skipped",
        error: "No email provided",
      })
      onProgress({ ...progress })
      continue
    }

    try {
      // Generate PDF in-memory
      const pdfBytes = await generateStudentPDF(student, logo1Bytes, logo2Bytes, signatureBytes)
      const pdfBase64 = uint8ArrayToBase64(pdfBytes)

      const safeName = studentName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      const fileName = `${safeName}_health_report.pdf`

      // Send the email
      const result = await sendSingleEmail(email, studentName, className, pdfBase64, fileName)

      if (result.success) {
        progress.sent++
        progress.results.push({ studentName, email, status: "sent" })
      } else {
        progress.failed++
        progress.results.push({
          studentName,
          email,
          status: "failed",
          error: result.error,
        })
      }
    } catch (err: any) {
      progress.failed++
      progress.results.push({
        studentName,
        email,
        status: "failed",
        error: err.message || "PDF generation failed",
      })
    }

    onProgress({ ...progress })

    // Batch delay to respect rate limits
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < students.length) {
      await delay(BATCH_DELAY_MS)
    }
  }

  progress.isComplete = true
  progress.currentStudent = ""
  onProgress({ ...progress })

  return progress
}
