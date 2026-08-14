import { z } from "zod"

export const studentSchema = z.object({
  "Student Name": z.string().min(1, "Student Name is required"),
  "Class": z.string().or(z.number()).transform(v => String(v)).refine(v => v.trim() !== "", "Class is required"),
  "Section": z.string().or(z.number()).transform(v => String(v)).refine(v => v.trim() !== "", "Section is required"),
  "Date of Birth": z.any().optional(), // Will handle date parsing logic carefully
  "Age": z.number().or(z.string().regex(/^\d+$/).transform(Number)).optional().or(z.literal("")),
  "Gender": z.enum(["Male", "Female", "Other"]).optional().or(z.literal("")),
  "Parent / Guardian Name": z.string().optional(),
  "Parent Contact Number": z.string().or(z.number().transform(v => String(v))).refine(v => !v || /^\d{10}$/.test(v.trim()), "Must be 10 digits").optional().or(z.literal("")),
  "Height": z.number().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().or(z.literal("")),
  "Weight": z.number().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().or(z.literal("")),
  "Temperature": z.number().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().or(z.literal("")),
  "SpO2": z.number().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().or(z.literal("")),
  "Pulse": z.number().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)).optional().or(z.literal("")),
  "Blood Pressure": z.string().refine(v => !v || /^\d{2,3}\/\d{2,3}$/.test(v.trim()), "Format must be XXX/YY").optional().or(z.literal("")),
  "Right Eye Vision": z.string().optional(),
  "Left Eye Vision": z.string().optional(),
  "Vision Comments": z.string().optional(),
  "Dental Findings": z.string().optional(),
  "Dental Comments": z.string().optional(),
  "ENT Comments": z.string().optional(),
  "General Health Comments": z.string().optional(),
  "School Nurse / Doctor Name": z.string().optional(),
  "Medical Reg. Number": z.string().or(z.number().transform(v => String(v))).optional().or(z.literal("")),
  "Date": z.any().optional(),
  "Mother's Email": z.string().email("Invalid email format").optional().or(z.literal(""))
})

export type StudentData = z.infer<typeof studentSchema>
