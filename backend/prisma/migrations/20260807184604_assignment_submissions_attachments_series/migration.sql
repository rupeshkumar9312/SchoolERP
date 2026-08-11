-- AlterTable
ALTER TABLE `assignments` ADD COLUMN `attachmentFileName` VARCHAR(191) NULL,
    ADD COLUMN `attachmentMimeType` VARCHAR(191) NULL,
    ADD COLUMN `attachmentPath` VARCHAR(191) NULL,
    ADD COLUMN `attachmentSize` INTEGER NULL,
    ADD COLUMN `seriesId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `assignment_submissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignmentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `submitted` BOOLEAN NOT NULL DEFAULT false,
    `submittedAt` DATETIME(3) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assignment_submissions_assignmentId_studentId_key`(`assignmentId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assignment_submissions` ADD CONSTRAINT `assignment_submissions_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_submissions` ADD CONSTRAINT `assignment_submissions_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
