-- AlterTable
ALTER TABLE `attendance_geofence_config` ADD COLUMN `allowCheckoutWithoutCheckin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `checkoutAutoSwitchAt` VARCHAR(191) NULL,
    ADD COLUMN `checkoutEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `minSessionMinutes` INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE `teacher_attendance` ADD COLUMN `checkInAt` DATETIME(3) NULL,
    ADD COLUMN `checkOutAccuracyM` DOUBLE NULL,
    ADD COLUMN `checkOutAt` DATETIME(3) NULL,
    ADD COLUMN `checkOutLat` DOUBLE NULL,
    ADD COLUMN `checkOutLng` DOUBLE NULL,
    ADD COLUMN `checkOutSourceJti` VARCHAR(191) NULL;

-- Backfill: a pre-check-out QR row already recorded its check-in time in markedAt.
UPDATE `teacher_attendance` SET `checkInAt` = `markedAt` WHERE `method` = 'QR' AND `markedAt` IS NOT NULL;
