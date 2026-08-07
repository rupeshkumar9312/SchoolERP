-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEAVE');

-- CreateTable
CREATE TABLE "student_attendance" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "classId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "markedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_studentId_date_key" ON "student_attendance"("studentId", "date");

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
