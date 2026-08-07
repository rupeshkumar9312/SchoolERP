-- CreateTable
CREATE TABLE "teacher_attendance" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_attendance_teacherId_date_key" ON "teacher_attendance"("teacherId", "date");

-- AddForeignKey
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
