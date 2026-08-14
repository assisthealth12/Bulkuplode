import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import * as XLSX from "xlsx"
import { studentSchema, type StudentData } from "../lib/validation"
import { AlertCircle, CheckCircle2, FileUp, Download } from "lucide-react"

interface UploadModalProps {
  onClose: () => void
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [className, setClassName] = useState("")
  const [assessmentDate, setAssessmentDate] = useState("")
  const [validData, setValidData] = useState<StudentData[]>([])
  const [errors, setErrors] = useState<{ row: number; issues: string[] }[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Progress states
  const [progressState, setProgressState] = useState<"upload" | "validating" | "ready" | "generating" | "done">("upload")
  const [generationProgress, setGenerationProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const downloadTemplate = () => {
    const headers = [
      "Student Name", "Class", "Section", "Date of Birth", "Age", "Gender", 
      "Parent / Guardian Name", "Parent Contact Number", "Height", "Weight", 
      "Temperature", "SpO2", "Pulse", "Blood Pressure", "Right Eye Vision", 
      "Left Eye Vision", "Vision Comments", "Dental Findings", "Dental Comments", 
      "ENT Comments", "General Health Comments", "School Nurse / Doctor Name", 
      "Medical Reg. Number", "Date", "Mother's Email"
    ]
    
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers])
    
    const wscols = headers.map(() => ({ wch: 20 }))
    ws['!cols'] = wscols

    XLSX.utils.book_append_sheet(wb, ws, "Health Assessment")
    XLSX.writeFile(wb, "Health_Assessment_Template.xlsx")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setErrors([])
      setValidData([])
      setProgressState("upload")
    }
  }

  const processFile = async () => {
    if (!file) return
    setIsProcessing(true)
    setProgressState("validating")
    
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      
      const parsedData: StudentData[] = []
      const foundErrors: { row: number; issues: string[] }[] = []

      if (jsonData.length > 250) {
        foundErrors.push({ row: 0, issues: ["Maximum 250 students allowed per upload."] })
      } else {
        jsonData.forEach((row: any, index) => {
          const rowNum = index + 2 // +2 because header is row 1, and array is 0-indexed
          
          // Apply modal date to row if not present
          if (assessmentDate && (!row["Date"] || String(row["Date"]).trim() === '')) {
            const parts = assessmentDate.split('-')
            if (parts.length === 3) {
              row["Date"] = `${parts[2]}-${parts[1]}-${parts[0]}` // DD-MM-YYYY
            } else {
              row["Date"] = assessmentDate
            }
          }

          // Format strings to avoid undefined errors in zod regex
          Object.keys(row).forEach(key => {
            if (typeof row[key] === 'string') {
              row[key] = row[key].trim()
            }
          })
          
          const result = studentSchema.safeParse(row)
          if (!result.success) {
            const issues = (result.error as any).issues.map((err: any) => `${err.path.join(".")}: ${err.message}`)
            foundErrors.push({ row: rowNum, issues })
          } else {
            parsedData.push(result.data)
          }
        })
      }

      setErrors(foundErrors)
      setValidData(parsedData)
      
      if (foundErrors.length === 0 && parsedData.length > 0) {
        setProgressState("ready")
      } else {
        setProgressState("upload")
      }
    } catch (err) {
      setErrors([{ row: 0, issues: ["Failed to read or parse the Excel file. Please ensure it matches the template."] }])
      setProgressState("upload")
    }
    
    setIsProcessing(false)
  }

  const generateReports = async () => {
    setProgressState("generating")
    try {
      // Fetch logos
      const logo1Res = await fetch("/Images/LOGO1.png")
      const logo1Bytes = await logo1Res.arrayBuffer()
      
      const logo2Res = await fetch("/Images/LOGO2.png")
      const logo2Bytes = await logo2Res.arrayBuffer()

      let signatureBytes: ArrayBuffer | undefined = undefined
      const signatureNames = ['Singature.png', 'signature.png', 'Signature.png', 'singature.png']
      for (const name of signatureNames) {
        try {
          const sigRes = await fetch(`/Images/${name}`)
          const ct = sigRes.headers.get('content-type') || ''
          console.log(`[Signature] Trying /Images/${name}: status=${sigRes.status}, content-type=${ct}`)
          if (sigRes.ok && ct.startsWith('image/')) {
            signatureBytes = await sigRes.arrayBuffer()
            console.log(`[Signature] Loaded ${name}, ${signatureBytes.byteLength} bytes`)
            break
          }
        } catch (e) {
          console.warn(`[Signature] Error fetching ${name}:`, e)
        }
      }
      if (!signatureBytes) {
        console.warn('[Signature] No signature image found in /Images/')
      }

      const { generateStudentPDF } = await import("../lib/pdfGenerator")
      const JSZip = (await import("jszip")).default
      
      const zip = new JSZip()
      
      for (let i = 0; i < validData.length; i++) {
        const student = validData[i]
        const pdfBytes = await generateStudentPDF(student, logo1Bytes, logo2Bytes, signatureBytes)
        
        // Sanitize name for filename and append index to handle duplicate names
        const safeName = student["Student Name"].replace(/[^a-z0-9]/gi, '_').toLowerCase()
        zip.file(`${safeName}_${i + 1}_report.pdf`, pdfBytes)
        
        setGenerationProgress(i + 1)
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      
      try {
        const { saveUploadData } = await import("../lib/firebaseUtils")
        await saveUploadData(file!, zipBlob, validData, className)
      } catch (dbErr) {
        console.error("Firebase sync failed, but files were generated", dbErr)
      }

      const url = URL.createObjectURL(zipBlob)
      setDownloadUrl(url)
      setProgressState("done")
      
    } catch (err) {
      console.error(err)
      alert("An error occurred while generating reports.")
      setProgressState("ready")
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] bg-white text-black border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-xl">Upload Health Assessment Data</DialogTitle>
          <DialogDescription className="text-gray-500">
            Select the filled Excel template to validate and generate reports.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2">
          {progressState === "upload" || progressState === "validating" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Class Name / Batch Label</label>
                  <Input 
                    type="text" 
                    placeholder="e.g., Class 10A" 
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Assessment Date (Optional)</label>
                  <Input 
                    type="date" 
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange} 
                  disabled={isProcessing}
                  className="cursor-pointer"
                />
                <Button 
                  onClick={processFile} 
                  disabled={!file || isProcessing || !className.trim()}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  {isProcessing ? "Validating..." : "Validate"}
                </Button>
              </div>
              
              <div className="flex justify-start pt-2 border-t border-gray-100">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadTemplate} 
                  className="h-8 text-xs text-gray-500 hover:text-gray-700" 
                  disabled={isProcessing}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Need the Excel template? Download it here
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowGuide(!showGuide)} 
                  className="h-8 text-xs text-blue-500 hover:text-blue-700 ml-2" 
                >
                  {showGuide ? "Hide Data Guide" : "View Data Guide"}
                </Button>
              </div>

              {showGuide && (
                <div className="mt-4 border border-blue-200 rounded-md bg-white overflow-hidden text-sm">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-blue-900">Comprehensive Data Format Guide</h4>
                      <p className="text-blue-700 text-xs mt-0.5">Please ensure your Excel data matches these exact formats. Avoid using a single "Tick" (✔️) in text fields; write proper sentences instead.</p>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-1/3 text-xs uppercase font-semibold">Column Name</TableHead>
                          <TableHead className="w-1/6 text-xs uppercase font-semibold text-center">Required?</TableHead>
                          <TableHead className="w-1/2 text-xs uppercase font-semibold">Validation & Example</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Student Name</TableCell>
                          <TableCell className="text-center text-red-600 font-semibold">Yes</TableCell>
                          <TableCell className="text-gray-600">Text e.g., "John Doe"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Class & Section</TableCell>
                          <TableCell className="text-center text-red-600 font-semibold">Yes</TableCell>
                          <TableCell className="text-gray-600">Text or Number e.g., "10", "A"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Date of Birth & Date</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Standard date format e.g., "14-05-2010"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Age</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Whole number only e.g., "14"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Gender</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Must be "Male", "Female", or "Other"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Parent Contact Number</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Exactly 10 digits e.g., "9876543210"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Vitals (Height, Weight, Temp, SpO2, Pulse)</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Numeric values only e.g., "165.5", "98.6"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Blood Pressure</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Must be format XXX/YY e.g., "120/80"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Vision (Right/Left Eye)</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Text e.g., "6/6"</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Dental Findings (Checkboxes)</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">
                            Must include one or more of exactly these words to tick the boxes on the PDF: 
                            <span className="font-semibold text-gray-900"> Normal, Decayed, Cross Bite, Dental Stains, Other</span>
                            <br/><span className="text-xs text-gray-400">e.g., "Normal" or "Decayed, Dental Stains"</span>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">All Comments (Vision, Dental, ENT, General Health)</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Write proper sentences e.g., "Healthy gums. Continue brushing twice a day."</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">Other Text Fields (Parent Name, Nurse/Doctor Name, Medical Reg. No.)</TableCell>
                          <TableCell className="text-center text-gray-400">No</TableCell>
                          <TableCell className="text-gray-600">Standard text/names.</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {errors.length > 0 && (
                <div className="mt-4 border border-red-200 rounded-md overflow-hidden bg-red-50">
                  <div className="bg-red-100 p-2 font-semibold text-red-800 flex items-center px-4">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Validation Errors ({errors.length})
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Issues</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errors.map((error, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-red-600">{error.row || "-"}</TableCell>
                            <TableCell>
                              <ul className="list-disc pl-4 text-sm text-red-600">
                                {error.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : progressState === "ready" ? (
            <div className="space-y-6 text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium">Data Validated Successfully</h3>
              <p className="text-gray-500">Found {validData.length} valid student records.</p>
              
              <Button onClick={generateReports} className="w-full bg-black hover:bg-gray-800 text-white mt-4" size="lg">
                Generate Reports
              </Button>
            </div>
          ) : progressState === "generating" ? (
            <div className="space-y-6 text-center py-8">
              <h3 className="text-lg font-medium animate-pulse">Generating PDFs & ZIP...</h3>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
                <div className="bg-black h-2.5 rounded-full transition-all duration-300" style={{ width: `${(generationProgress / Math.max(validData.length, 1)) * 100}%` }}></div>
              </div>
              <p className="text-gray-500">{generationProgress} / {validData.length} Completed</p>
            </div>
          ) : (
            <div className="space-y-6 text-center py-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FileUp className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium">Reports Ready!</h3>
              <p className="text-gray-500">ZIP file has been created successfully.</p>
              
              <Button onClick={() => downloadUrl && window.open(downloadUrl)} className="w-full bg-black hover:bg-gray-800 text-white mt-4" size="lg">
                Download ZIP
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {progressState !== "generating" && (
            <Button variant="outline" onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
