-- Adds an optional overall date window directly on the Exam umbrella,
-- independent of each class's own ExamSchedule dates. Nullable so existing
-- exam rows are unaffected.
ALTER TABLE `exams` ADD COLUMN `startDate` DATE NULL;
ALTER TABLE `exams` ADD COLUMN `endDate` DATE NULL;
