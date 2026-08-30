-- AlterTable
ALTER TABLE `students` ADD COLUMN `aadharNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `students_aadharNumber_key` ON `students`(`aadharNumber`);
