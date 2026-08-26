-- CreateTable
CREATE TABLE `audit_logins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event` ENUM('LOGIN', 'REFRESH', 'LOGIN_FAILED') NOT NULL,
    `platform` ENUM('WEB', 'MOBILE') NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `failureReason` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logins_userId_idx`(`userId`),
    INDEX `audit_logins_event_idx`(`event`),
    INDEX `audit_logins_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logins` ADD CONSTRAINT `audit_logins_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
