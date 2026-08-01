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

export async function deleteUploadAndStudents(uploadId: string) {
  const { doc, collection, query, where, getDocs, deleteDoc, writeBatch } = await import("firebase/firestore")
  
  // First, delete all student documents associated with this upload
  const studentsQuery = query(collection(db, "students"), where("uploadId", "==", uploadId))
  const studentsSnap = await getDocs(studentsQuery)
  
  const batch = writeBatch(db)
  studentsSnap.forEach((studentDoc) => {
    batch.delete(studentDoc.ref)
  })
  
  // Also delete the main upload document
  const uploadRef = doc(db, "uploads", uploadId)
  batch.delete(uploadRef)
  
  await batch.commit()
}

export async function deleteStudentFromUpload(uploadId: string, studentIndex: number) {
  const { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, writeBatch, increment } = await import("firebase/firestore")
  const uploadRef = doc(db, "uploads", uploadId)
  
  const uploadSnap = await getDoc(uploadRef)
  if (!uploadSnap.exists()) throw new Error("Upload not found")
  
  const data = uploadSnap.data()
  if (!data.studentsData) throw new Error("No students data in this upload")
  
  const students = JSON.parse(data.studentsData)
  if (studentIndex < 0 || studentIndex >= students.length) throw new Error("Invalid student index")
  
  const studentToDelete = students[studentIndex]
  const studentName = studentToDelete["Student Name"]
  
  // Remove the student from the array
  students.splice(studentIndex, 1)
  
  const batch = writeBatch(db)
  
  // Update the upload document (new array and decrement totalStudents)
  batch.update(uploadRef, {
    studentsData: JSON.stringify(students),
    totalStudents: increment(-1),
    successfulReports: increment(-1) // Assuming successful reports matches total for now
  })
  
  // Try to find and delete the corresponding document in the "students" collection
  // Since we don't have a unique ID for the student, we'll try to match by name and uploadId
  if (studentName) {
    const studentsQuery = query(
      collection(db, "students"), 
      where("uploadId", "==", uploadId),
      where("Student Name", "==", studentName)
    )
    const studentsSnap = await getDocs(studentsQuery)
    
    // Delete matching student documents (ideally just one, but might be multiple with same name)
    // To be safe, we only delete the first match to avoid wiping out twins if they have exactly the same name somehow
    if (!studentsSnap.empty) {
      batch.delete(studentsSnap.docs[0].ref)
    }
  }
  
  await batch.commit()
}
