-- AlterTable
ALTER TABLE `teacher_attendance` ADD COLUMN `markedAccuracyM` DOUBLE NULL,
    ADD COLUMN `markedAt` DATETIME(3) NULL,
    ADD COLUMN `markedLat` DOUBLE NULL,
    ADD COLUMN `markedLng` DOUBLE NULL,
    ADD COLUMN `method` ENUM('MANUAL', 'QR', 'ADMIN') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `sourceJti` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `attendance_qr_consumption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jti` VARCHAR(191) NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `consumedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_qr_consumption_consumedAt_idx`(`consumedAt`),
    UNIQUE INDEX `attendance_qr_consumption_jti_teacherId_key`(`jti`, `teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
