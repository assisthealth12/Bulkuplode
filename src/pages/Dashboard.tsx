import { useState, useEffect } from "react"
import { auth, db } from "../firebase"
import { signOut } from "firebase/auth"
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore"
import { deleteUploadAndStudents } from "../lib/firebaseUtils"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Upload, LogOut, Trash2, ChevronRight } from "lucide-react"
import * as XLSX from "xlsx"
import UploadModal from "@/components/UploadModal"
import BatchStudentsView from "@/components/BatchStudentsView"

export default function Dashboard() {
  const [uploads, setUploads] = useState<any[]>([])
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  
  // View states
  const [activeTab, setActiveTab] = useState<"uploads" | "batch">("uploads")
  const [selectedBatch, setSelectedBatch] = useState<any>(null)

  useEffect(() => {
    const q = query(collection(db, "uploads"), orderBy("uploadedAt", "desc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setUploads(data)
    })
    return () => unsubscribe()
  }, [])

  const handleLogout = () => {
    signOut(auth)
  }

  const downloadTemplate = () => {
    const headers = [
      "Student Name", "Class", "Section", "Date of Birth", "Age", "Gender", 
      "Parent / Guardian Name", "Parent Contact Number", "Height", "Weight", 
      "Temperature", "SpO2", "Pulse", "Blood Pressure", "Right Eye Vision", 
      "Left Eye Vision", "Vision Comments", "Dental Findings", "Dental Comments", 
      "ENT Comments", "General Health Comments", "School Nurse / Doctor Name", 
      "Medical Reg. Number", "Date"
    ]
    
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers])
    
    const wscols = headers.map(() => ({ wch: 20 }))
    ws['!cols'] = wscols

    XLSX.utils.book_append_sheet(wb, ws, "Health Assessment")
    XLSX.writeFile(wb, "Health_Assessment_Template.xlsx")
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (confirm("Are you sure you want to delete this upload? This will also delete all students in this batch from the database.")) {
      try {
        await deleteUploadAndStudents(id)
        if (selectedBatch?.id === id) {
          setActiveTab("uploads")
          setSelectedBatch(null)
        }
      } catch (err) {
        console.error("Error deleting document: ", err)
      }
    }
  }

  const regenerateZip = async (upload: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!upload.studentsData) {
      alert("No data available for this upload.")
      return
    }

    setGeneratingId(upload.id)
    try {
      const validData = JSON.parse(upload.studentsData)
      
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
        const safeName = student["Student Name"].replace(/[^a-z0-9]/gi, '_').toLowerCase()
        zip.file(`${safeName}_${i + 1}_report.pdf`, pdfBytes)
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      
      const a = document.createElement("a")
      a.href = url
      a.download = `${upload.className || "reports"}_${upload.id.slice(0,6)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
    } catch (err) {
      console.error(err)
      alert("Failed to regenerate ZIP.")
    }
    setGeneratingId(null)
  }
  
  const viewBatch = (upload: any) => {
    setSelectedBatch(upload)
    setActiveTab("batch")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img src="/Images/LOGO1.png" alt="AssistHealth" className="h-7 object-contain" />
          <span className="text-sm font-semibold text-gray-700 tracking-tight hidden sm:block">School Health Portal</span>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — compact */}
        <aside className="w-56 bg-white border-r border-gray-100 flex flex-col pt-4">
          <nav className="px-3 space-y-0.5">
            <button 
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                activeTab === "uploads" 
                  ? "bg-gray-900 text-white font-medium" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab("uploads")}
            >
              <Upload className="w-4 h-4" />
              Uploads
            </button>
            {selectedBatch && (
              <button 
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors truncate ${
                  activeTab === "batch" 
                    ? "bg-gray-900 text-white font-medium" 
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setActiveTab("batch")}
              >
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{selectedBatch.className || "Class"}</span>
              </button>
            )}
          </nav>

          {/* Sidebar footer actions */}
          <div className="mt-auto p-3 border-t border-gray-100 space-y-1">
            <button 
              onClick={downloadTemplate} 
              className="w-full text-left px-3 py-2 rounded-md text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            
            {activeTab === "uploads" && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Uploads</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Click a batch to view & edit students</p>
                  </div>
                  <Button 
                    className="bg-gray-900 hover:bg-black text-white text-sm h-9" 
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Excel
                  </Button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-b border-gray-200">
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Class</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">File</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Students</TableHead>
                        <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-gray-400 text-sm">
                            No uploads yet. Upload your first Excel file to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        uploads.map((upload) => (
                          <TableRow 
                            key={upload.id} 
                            className="border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors"
                            onClick={() => viewBatch(upload)}
                          >
                            <TableCell className="text-sm text-gray-500">
                              {upload.uploadedAt?.toDate ? new Date(upload.uploadedAt.toDate()).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-gray-900">{upload.className || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-400">{upload.uploadName}</TableCell>
                            <TableCell className="text-sm text-gray-600">{upload.totalStudents}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={(e) => regenerateZip(upload, e)}
                                  disabled={generatingId === upload.id || !upload.studentsData}
                                  className="h-7 text-xs"
                                >
                                  {generatingId === upload.id ? "..." : "ZIP"}
                                </Button>
                                <button 
                                  onClick={(e) => handleDelete(upload.id, e)} 
                                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {activeTab === "batch" && selectedBatch && (() => {
              const currentBatch = uploads.find(u => u.id === selectedBatch.id) || selectedBatch
              return (
                <BatchStudentsView 
                  upload={currentBatch} 
                  onBack={() => setActiveTab("uploads")}
                  onDownload={(u) => regenerateZip(u)}
                  isDownloading={generatingId === currentBatch.id}
                />
              )
            })()}

          </div>
        </main>
      </div>

      {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} />}
    </div>
  )
}
