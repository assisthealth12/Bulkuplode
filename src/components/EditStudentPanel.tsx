import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import type { StudentData } from "../lib/validation"
import { updateStudentInUpload, deleteStudentFromUpload } from "../lib/firebaseUtils"
import { parseExcelDate } from "../lib/utils"
import { X, Check, Loader2, Trash2 } from "lucide-react"

interface EditStudentPanelProps {
  uploadId: string
  studentIndex: number
  student: StudentData
  onClose: () => void
}

const Field = ({ 
  label, 
  field, 
  formData, 
  handleChange, 
  isSaving 
}: { 
  label: string; 
  field: keyof StudentData; 
  formData: StudentData;
  handleChange: (field: keyof StudentData, value: string) => void;
  isSaving: boolean;
}) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
    <Input
      value={String(formData[field] || "")}
      onChange={(e) => handleChange(field, e.target.value)}
      disabled={isSaving}
      className="h-8 text-sm bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-black/10"
    />
  </div>
)

export default function EditStudentPanel({ uploadId, studentIndex, student, onClose }: EditStudentPanelProps) {
  const [formData, setFormData] = useState<StudentData>({ 
    ...student,
    "Date of Birth": parseExcelDate(student["Date of Birth"]),
    "Date": parseExcelDate(student["Date"])
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Reset form when student changes
  useEffect(() => {
    setFormData({ 
      ...student,
      "Date of Birth": parseExcelDate(student["Date of Birth"]),
      "Date": parseExcelDate(student["Date"])
    })
    setSaved(false)
  }, [student, studentIndex])

  const handleChange = (field: keyof StudentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateStudentInUpload(uploadId, studentIndex, formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      alert("Failed to save")
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this student from the batch and the database?")) {
      try {
        await deleteStudentFromUpload(uploadId, studentIndex)
        onClose() // Close panel after deletion
      } catch (err) {
        console.error(err)
        alert("Failed to delete")
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[420px] max-w-full bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{String(student["Student Name"])}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Class {String(student["Class"])} &middot; Section {String(student["Section"])}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleDelete} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete Student">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          
          {/* Personal */}
          <section>
            <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Personal</h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Name" field="Student Name" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Class" field="Class" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Section" field="Section" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Date of Birth" field="Date of Birth" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Age" field="Age" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Gender" field="Gender" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Parent Name" field="Parent / Guardian Name" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Parent Contact" field="Parent Contact Number" formData={formData} handleChange={handleChange} isSaving={isSaving} />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Vitals */}
          <section>
            <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Vitals</h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Height" field="Height" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Weight" field="Weight" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Temperature" field="Temperature" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="SpO2" field="SpO2" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Pulse" field="Pulse" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Blood Pressure" field="Blood Pressure" formData={formData} handleChange={handleChange} isSaving={isSaving} />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Vision */}
          <section>
            <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Vision</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Right Eye" field="Right Eye Vision" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Left Eye" field="Left Eye Vision" formData={formData} handleChange={handleChange} isSaving={isSaving} />
            </div>
            <div className="mt-3">
              <Field label="Vision Comments" field="Vision Comments" formData={formData} handleChange={handleChange} isSaving={isSaving} />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Dental / ENT / General */}
          <section>
            <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Assessments</h4>
            <div className="space-y-3">
              <Field label="Dental Findings" field="Dental Findings" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Dental Comments" field="Dental Comments" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="ENT Comments" field="ENT Comments" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="General Health" field="General Health Comments" formData={formData} handleChange={handleChange} isSaving={isSaving} />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Sign-off Details */}
          <section>
            <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Sign-off Details</h4>
            <div className="space-y-3">
              <Field label="School Nurse / Doctor" field="School Nurse / Doctor Name" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Medical Reg. Number" field="Medical Reg. Number" formData={formData} handleChange={handleChange} isSaving={isSaving} />
              <Field label="Date" field="Date" formData={formData} handleChange={handleChange} isSaving={isSaving} />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-900 text-white hover:bg-black'
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</>
            ) : saved ? (
              <><Check className="w-3.5 h-3.5" /> Saved</>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
