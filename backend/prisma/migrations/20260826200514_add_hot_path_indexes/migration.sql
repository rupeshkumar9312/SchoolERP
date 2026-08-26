-- CreateIndex
CREATE INDEX `student_attendance_classId_sectionId_date_idx` ON `student_attendance`(`classId`, `sectionId`, `date`);

-- CreateIndex
CREATE INDEX `student_attendance_date_idx` ON `student_attendance`(`date`);

-- CreateIndex
CREATE INDEX `students_classId_sectionId_isActive_idx` ON `students`(`classId`, `sectionId`, `isActive`);

-- CreateIndex
CREATE INDEX `teacher_attendance_date_idx` ON `teacher_attendance`(`date`);
