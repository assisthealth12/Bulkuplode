import { useState, useRef, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mail, CheckCircle2, AlertTriangle, Loader2, MinusCircle } from "lucide-react"
import { sendBatchEmails, type EmailProgress } from "../lib/emailService"
import type { StudentData } from "../lib/validation"

interface SendEmailsDialogProps {
  open: boolean
  onClose: () => void
  students: StudentData[]
  className: string
}

type Stage = "confirm" | "sending" | "done"

export default function SendEmailsDialog({ open, onClose, students, className }: SendEmailsDialogProps) {
  const [stage, setStage] = useState<Stage>("confirm")
  const [progress, setProgress] = useState<EmailProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const studentsWithEmail = useMemo(
    () => students.filter((s) => String(s["Mother's Email"] || "").trim() !== ""),
    [students]
  )
  const studentsWithoutEmail = students.length - studentsWithEmail.length

  const handleStart = useCallback(async () => {
    setStage("sending")
    abortRef.current = new AbortController()

    try {
      // Fetch logos (same as existing ZIP generation logic)
      const logo1Res = await fetch("/Images/LOGO1.png")
      const logo1Bytes = await logo1Res.arrayBuffer()

      const logo2Res = await fetch("/Images/LOGO2.png")
      const logo2Bytes = await logo2Res.arrayBuffer()

      let signatureBytes: ArrayBuffer | undefined = undefined
      const signatureNames = ["Singature.png", "signature.png", "Signature.png", "singature.png"]
      for (const name of signatureNames) {
        try {
          const sigRes = await fetch(`/Images/${name}`)
          const ct = sigRes.headers.get("content-type") || ""
          if (sigRes.ok && ct.startsWith("image/")) {
            signatureBytes = await sigRes.arrayBuffer()
            break
          }
        } catch {
          // continue trying
        }
      }

      await sendBatchEmails(
        students,
        className,
        logo1Bytes,
        logo2Bytes,
        signatureBytes,
        (p) => setProgress({ ...p }),
        abortRef.current.signal
      )
    } catch (err) {
      console.error("Email sending failed:", err)
    }
    setStage("done")
  }, [students, className])

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleClose = () => {
    if (stage === "sending") return // prevent closing while sending
    setStage("confirm")
    setProgress(null)
    onClose()
  }

  const processed = progress ? progress.sent + progress.failed + progress.skipped : 0
  const percentage = progress ? Math.round((processed / Math.max(progress.total, 1)) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[560px] bg-white text-black border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email Reports
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {stage === "confirm" && "Review and confirm before sending."}
            {stage === "sending" && "Sending emails... Please keep this tab open."}
            {stage === "done" && "Email sending complete."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {/* CONFIRM Stage */}
          {stage === "confirm" && (
            <div className="space-y-5">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Class / Batch</span>
                  <span className="font-medium text-gray-900">{className || "Unknown"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total students</span>
                  <span className="font-medium text-gray-900">{students.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">With email (will send)</span>
                  <span className="font-medium text-green-600">{studentsWithEmail.length}</span>
                </div>
                {studentsWithoutEmail > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Without email (will skip)</span>
                    <span className="font-medium text-amber-500">{studentsWithoutEmail}</span>
                  </div>
                )}
              </div>

              {studentsWithoutEmail > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    {studentsWithoutEmail} student(s) don't have a "Mother's Email" in the Excel data. They will be skipped.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  ⏱ Estimated time: ~{Math.ceil(studentsWithEmail.length / 500 * 60)} minutes
                  ({studentsWithEmail.length} emails at ~500/hour, MSG91 rate limit).
                  You can keep using other tabs while this runs.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleStart}
                  disabled={studentsWithEmail.length === 0}
                  className="flex-1 bg-gray-900 hover:bg-black text-white"
                >
                  <Mail className="w-4 h-4 mr-1.5" />
                  Send {studentsWithEmail.length} Emails
                </Button>
              </div>
            </div>
          )}

          {/* SENDING Stage */}
          {stage === "sending" && progress && (
            <div className="space-y-5">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Sending to <strong className="text-gray-900">{progress.currentStudent}</strong>...
                </p>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>{processed} / {progress.total}</span>
                  <span>{percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-300 bg-gray-900"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Live stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-green-600">{progress.sent}</p>
                  <p className="text-xs text-green-500">Sent</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-red-500">{progress.failed}</p>
                  <p className="text-xs text-red-400">Failed</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-gray-400">{progress.skipped}</p>
                  <p className="text-xs text-gray-400">Skipped</p>
                </div>
              </div>

              <Button variant="outline" onClick={handleCancel} className="w-full text-red-500 border-red-200 hover:bg-red-50">
                Stop Sending
              </Button>
            </div>
          )}

          {/* DONE Stage */}
          {stage === "done" && progress && (
            <div className="space-y-5">
              <div className="text-center py-2">
                {progress.failed === 0 ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900">All Emails Sent!</h3>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900">Sending Complete (with issues)</h3>
                  </>
                )}
              </div>

              {/* Final stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-green-600">{progress.sent}</p>
                  <p className="text-xs text-green-500">Sent ✓</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-red-500">{progress.failed}</p>
                  <p className="text-xs text-red-400">Failed ✗</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-gray-400">{progress.skipped}</p>
                  <p className="text-xs text-gray-400">Skipped</p>
                </div>
              </div>

              {/* Failed details */}
              {progress.results.filter((r) => r.status === "failed").length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                    <p className="text-xs font-medium text-red-700">Failed Emails</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {progress.results
                      .filter((r) => r.status === "failed")
                      .map((r, idx) => (
                        <div key={idx} className="px-3 py-2 border-b border-red-50 last:border-0 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.studentName}</p>
                            <p className="text-xs text-gray-400">{r.email}</p>
                          </div>
                          <p className="text-xs text-red-500 max-w-[200px] text-right">{r.error}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Skipped details */}
              {progress.results.filter((r) => r.status === "skipped").length > 0 && (
                <details className="border border-gray-200 rounded-lg overflow-hidden">
                  <summary className="bg-gray-50 px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 cursor-pointer">
                    Skipped ({progress.skipped}) — click to expand
                  </summary>
                  <div className="max-h-40 overflow-y-auto">
                    {progress.results
                      .filter((r) => r.status === "skipped")
                      .map((r, idx) => (
                        <div key={idx} className="px-3 py-2 border-b border-gray-50 last:border-0 flex items-center gap-2">
                          <MinusCircle className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          <p className="text-sm text-gray-500">{r.studentName}</p>
                        </div>
                      ))}
                  </div>
                </details>
              )}

              <Button onClick={handleClose} className="w-full bg-gray-900 hover:bg-black text-white">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
