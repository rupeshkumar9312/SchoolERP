-- AlterTable
ALTER TABLE `users` ADD COLUMN `edvanceId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `id_sequences` (
    `prefix` VARCHAR(191) NOT NULL,
    `lastValue` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`prefix`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_edvanceId_key` ON `users`(`edvanceId`);

