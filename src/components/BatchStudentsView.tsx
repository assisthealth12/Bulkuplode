import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Edit2, Search, ChevronLeft, ChevronRight, Download, Users, Mail } from "lucide-react"
import type { StudentData } from "../lib/validation"
import EditStudentPanel from "./EditStudentPanel"
import SendEmailsDialog from "./SendEmailsDialog"

interface BatchStudentsViewProps {
  upload: any
  onBack: () => void
  onDownload: (upload: any) => void
  isDownloading: boolean
}

export default function BatchStudentsView({ upload, onBack, onDownload, isDownloading }: BatchStudentsViewProps) {
  const [editingStudentIdx, setEditingStudentIdx] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const itemsPerPage = 15

  const allStudents: StudentData[] = useMemo(() => {
    if (!upload?.studentsData) return []
    try {
      return JSON.parse(upload.studentsData)
    } catch (e) {
      console.error("Failed to parse student data", e)
      return []
    }
  }, [upload])

  const filteredWithIndex = useMemo(() => {
    return allStudents
      .map((student, idx) => ({ student, originalIdx: idx }))
      .filter(({ student }) => {
        if (!searchTerm.trim()) return true
        const lower = searchTerm.toLowerCase()
        return String(student["Student Name"] || "").toLowerCase().includes(lower) ||
               String(student["Class"] || "").toLowerCase().includes(lower) ||
               String(student["Section"] || "").toLowerCase().includes(lower)
      })
  }, [allStudents, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredWithIndex.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  
  const currentStudentsWithIndex = filteredWithIndex.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  )

  const uploadDate = upload.uploadedAt?.toDate ? new Date(upload.uploadedAt.toDate()).toLocaleDateString() : ""

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="text-gray-400 hover:text-black transition-colors p-1"
            title="Back to uploads"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              {upload.className || "Unknown Class"}
              <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                <Users className="w-3 h-3 inline -mt-0.5 mr-1" />{allStudents.length}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {upload.uploadName} &middot; {uploadDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              className="h-8 pl-8 pr-3 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 w-52 transition-all placeholder:text-gray-300"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowEmailDialog(true)}
            className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <Mail className="w-3 h-3 mr-1.5" />
            Send Emails
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDownload(upload)}
            disabled={isDownloading}
            className="h-8 text-xs"
          >
            <Download className="w-3 h-3 mr-1.5" />
            {isDownloading ? "Generating..." : "Download ZIP"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider w-8">#</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Class</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Section</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Height</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">BP</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentStudentsWithIndex.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16 text-gray-400 text-sm">
                  {searchTerm ? "No students match your search." : "No students in this batch."}
                </TableCell>
              </TableRow>
            ) : (
              currentStudentsWithIndex.map(({ student, originalIdx }) => (
                <TableRow 
                  key={originalIdx} 
                  className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${editingStudentIdx === originalIdx ? 'bg-blue-50/50' : ''}`}
                  onClick={() => setEditingStudentIdx(originalIdx)}
                >
                  <TableCell className="text-xs text-gray-300 tabular-nums">{originalIdx + 1}</TableCell>
                  <TableCell className="font-medium text-gray-900 text-sm">{student["Student Name"]}</TableCell>
                  <TableCell className="text-sm text-gray-600">{student["Class"]}</TableCell>
                  <TableCell className="text-sm text-gray-600">{student["Section"]}</TableCell>
                  <TableCell className="text-sm text-gray-500">{student["Gender"] || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500 tabular-nums">{student["Height"] || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500 tabular-nums">{student["Weight"] || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500 tabular-nums">{student["Blood Pressure"] || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-400 truncate max-w-[140px]" title={String(student["Mother's Email"] || "")}>{student["Mother's Email"] || <span className="text-gray-300">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <button 
                      className="text-gray-300 hover:text-blue-600 transition-colors p-1"
                      onClick={(e) => { e.stopPropagation(); setEditingStudentIdx(originalIdx) }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-xs text-gray-400">
              {((safeCurrentPage - 1) * itemsPerPage) + 1}–{Math.min(safeCurrentPage * itemsPerPage, filteredWithIndex.length)} of {filteredWithIndex.length}
            </span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs text-gray-500 min-w-[40px] text-center tabular-nums">
                {safeCurrentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over edit panel */}
      {editingStudentIdx !== null && (
        <EditStudentPanel
          uploadId={upload.id}
          studentIndex={editingStudentIdx}
          student={allStudents[editingStudentIdx]}
          onClose={() => setEditingStudentIdx(null)}
        />
      )}

      {/* Send Emails Dialog */}
      {showEmailDialog && (
        <SendEmailsDialog
          open={showEmailDialog}
          onClose={() => setShowEmailDialog(false)}
          students={allStudents}
          className={upload.className || "Class"}
        />
      )}
    </div>
  )
}
