import { db, auth } from "../firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { type StudentData } from "./validation"

export async function saveUploadData(
  file: File, 
  _zipBlob: Blob, 
  validData: StudentData[],
  className = "Unknown Class"
) {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const uploadDoc = await addDoc(collection(db, "uploads"), {
    className,
    uploadName: file.name,
    totalStudents: validData.length,
    successfulReports: validData.length,
    failedReports: 0,
    uploadStatus: "completed",
    uploadedBy: user.uid,
    uploadedAt: serverTimestamp(),
    studentsData: JSON.stringify(validData) // Store JSON for future ZIP generation
  })

  // Save student records for individual querying if needed
  for (const student of validData) {
    await addDoc(collection(db, "students"), {
      uploadId: uploadDoc.id,
      className,
      ...student,
      createdAt: serverTimestamp()
    })
  }

  return uploadDoc.id
}

export async function updateStudentInUpload(uploadId: string, studentIndex: number, newStudentData: StudentData) {
  const { doc, getDoc, updateDoc } = await import("firebase/firestore")
  const uploadRef = doc(db, "uploads", uploadId)
  
  const uploadSnap = await getDoc(uploadRef)
  if (!uploadSnap.exists()) throw new Error("Upload not found")
  
  const data = uploadSnap.data()
  if (!data.studentsData) throw new Error("No students data in this upload")
  
  const students = JSON.parse(data.studentsData)
  if (studentIndex < 0 || studentIndex >= students.length) throw new Error("Invalid student index")
  
  students[studentIndex] = newStudentData
  
  await updateDoc(uploadRef, {
    studentsData: JSON.stringify(students)
  })
}
