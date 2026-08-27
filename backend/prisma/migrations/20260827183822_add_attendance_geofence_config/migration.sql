-- CreateTable
CREATE TABLE `attendance_geofence_config` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `radiusM` INTEGER NOT NULL DEFAULT 150,
    `maxAccuracyM` INTEGER NOT NULL DEFAULT 75,
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
