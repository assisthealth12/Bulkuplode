import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { StudentData } from "../lib/validation"
import { updateStudentInUpload } from "../lib/firebaseUtils"
import { User, Activity, Eye, Stethoscope } from "lucide-react"

interface EditStudentModalProps {
  uploadId: string
  studentIndex: number
  student: StudentData
  onClose: () => void
}

export default function EditStudentModal({ uploadId, studentIndex, student, onClose }: EditStudentModalProps) {
  const [formData, setFormData] = useState<StudentData>({ ...student })
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (field: keyof StudentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateStudentInUpload(uploadId, studentIndex, formData)
      onClose()
    } catch (err) {
      console.error(err)
      alert("Failed to save student data")
    }
    setIsSaving(false)
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] bg-white text-black max-h-[90vh] overflow-hidden flex flex-col border-gray-200 shadow-xl p-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <DialogTitle className="text-xl flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 p-1.5 rounded-md">
              <User className="w-5 h-5" />
            </span>
            Edit Student: <span className="font-bold">{student["Student Name"]}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gray-50/20">
          
          {/* Personal Info */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <User className="w-4 h-4" /> Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Student Name</label>
                <Input value={String(formData["Student Name"] || "")} onChange={(e) => handleChange("Student Name", e.target.value)} disabled={isSaving} className="bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Class</label>
                <Input value={String(formData["Class"] || "")} onChange={(e) => handleChange("Class", e.target.value)} disabled={isSaving} className="bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Section</label>
                <Input value={String(formData["Section"] || "")} onChange={(e) => handleChange("Section", e.target.value)} disabled={isSaving} className="bg-white" />
              </div>
            </div>
          </section>

          {/* Vitals */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Physical & Vitals
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Height</label>
                <Input value={String(formData["Height"] || "")} onChange={(e) => handleChange("Height", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Weight</label>
                <Input value={String(formData["Weight"] || "")} onChange={(e) => handleChange("Weight", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Blood Pressure</label>
                <Input value={String(formData["Blood Pressure"] || "")} onChange={(e) => handleChange("Blood Pressure", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Pulse</label>
                <Input value={String(formData["Pulse"] || "")} onChange={(e) => handleChange("Pulse", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">SpO2</label>
                <Input value={String(formData["SpO2"] || "")} onChange={(e) => handleChange("SpO2", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Temperature</label>
                <Input value={String(formData["Temperature"] || "")} onChange={(e) => handleChange("Temperature", e.target.value)} disabled={isSaving} />
              </div>
            </div>
          </section>

          {/* Vision */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Vision Assessment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Right Eye Vision</label>
                <Input value={String(formData["Right Eye Vision"] || "")} onChange={(e) => handleChange("Right Eye Vision", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Left Eye Vision</label>
                <Input value={String(formData["Left Eye Vision"] || "")} onChange={(e) => handleChange("Left Eye Vision", e.target.value)} disabled={isSaving} />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Vision Comments</label>
                <Input value={String(formData["Vision Comments"] || "")} onChange={(e) => handleChange("Vision Comments", e.target.value)} disabled={isSaving} />
              </div>
            </div>
          </section>

          {/* General Health */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Dental, ENT & General Health
            </h3>
            <div className="grid grid-cols-1 gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Dental Findings (e.g., Normal, Decayed, Cross Bite)</label>
                <Input value={String(formData["Dental Findings"] || "")} onChange={(e) => handleChange("Dental Findings", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Dental Comments</label>
                <Input value={String(formData["Dental Comments"] || "")} onChange={(e) => handleChange("Dental Comments", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">ENT Comments</label>
                <Input value={String(formData["ENT Comments"] || "")} onChange={(e) => handleChange("ENT Comments", e.target.value)} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">General Health Comments</label>
                <Input value={String(formData["General Health Comments"] || "")} onChange={(e) => handleChange("General Health Comments", e.target.value)} disabled={isSaving} />
              </div>
            </div>
          </section>

        </div>

        <DialogFooter className="px-6 py-4 bg-white border-t border-gray-100">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-black hover:bg-gray-800 text-white min-w-[120px]">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

