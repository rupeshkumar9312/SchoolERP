-- Redesign: Exam becomes a name+type-only umbrella; classId/dates/status
-- move to a new per-class ExamSchedule child row. Existing exam rows are
-- preserved by carrying each one's classId/dates/status/createdById into a
-- freshly-created ExamSchedule row (examId = the same id, so the umbrella
-- row keeps today's id and every existing ExamSubject's parent is resolved
-- by that link) rather than dropped and recreated.

-- CreateTable
CREATE TABLE `exam_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `exam_schedules_classId_idx`(`classId`),
    UNIQUE INDEX `exam_schedules_examId_classId_key`(`examId`, `classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one ExamSchedule per existing Exam, carrying its classId/dates/
-- status/createdById, linked back to the same exam id.
INSERT INTO `exam_schedules` (`examId`, `classId`, `startDate`, `endDate`, `status`, `createdById`, `createdAt`, `updatedAt`)
SELECT `id`, `classId`, `startDate`, `endDate`, `status`, `createdById`, `createdAt`, `updatedAt` FROM `exams`;

-- Repoint exam_subjects at the new exam_schedules row instead of exams
-- directly.
ALTER TABLE `exam_subjects` ADD COLUMN `examScheduleId` INTEGER NULL;

UPDATE `exam_subjects` es
JOIN `exam_schedules` sch ON sch.`examId` = es.`examId`
SET es.`examScheduleId` = sch.`id`;

ALTER TABLE `exam_subjects` MODIFY COLUMN `examScheduleId` INTEGER NOT NULL;

ALTER TABLE `exam_subjects` DROP FOREIGN KEY `exam_subjects_examId_fkey`;
ALTER TABLE `exam_subjects` DROP INDEX `exam_subjects_examId_subjectId_key`;
ALTER TABLE `exam_subjects` DROP COLUMN `examId`;

ALTER TABLE `exam_subjects` ADD UNIQUE INDEX `exam_subjects_examScheduleId_subjectId_key`(`examScheduleId`, `subjectId`);
ALTER TABLE `exam_subjects` ADD CONSTRAINT `exam_subjects_examScheduleId_fkey` FOREIGN KEY (`examScheduleId`) REFERENCES `exam_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Exam becomes identity-only: drop the columns that moved to ExamSchedule.
ALTER TABLE `exams` DROP FOREIGN KEY `exams_classId_fkey`;
ALTER TABLE `exams` DROP INDEX `exams_classId_idx`;
ALTER TABLE `exams` DROP COLUMN `classId`;
ALTER TABLE `exams` DROP COLUMN `startDate`;
ALTER TABLE `exams` DROP COLUMN `endDate`;
ALTER TABLE `exams` DROP COLUMN `status`;
