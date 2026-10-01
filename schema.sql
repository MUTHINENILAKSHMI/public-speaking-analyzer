-- ================================================================
-- Database Schema for Public Speaking Analyzer (Student Project)
-- Database Engine: MySQL 8.0+
-- ================================================================

CREATE DATABASE IF NOT EXISTS `public_speaking_db`
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `public_speaking_db`;

-- ----------------------------------------------------------------
-- 1. USERS TABLE
-- Stores student accounts with securely hashed passwords
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 2. SPEAKING_SESSIONS TABLE
-- Stores speaking practice sessions with performance scores & feedback
-- Foreign key linked to users.id with cascading delete
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `speaking_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `topic` VARCHAR(255) NOT NULL,
    `duration` INT NOT NULL COMMENT 'Actual duration in seconds (e.g. 45, 155, 310)',
    `audience` VARCHAR(100) NOT NULL,
    `confidence_score` DECIMAL(4, 2) NOT NULL COMMENT 'Score between 1.00 and 10.00',
    `clarity_score` DECIMAL(4, 2) NOT NULL COMMENT 'Score between 1.00 and 10.00',
    `vocabulary_score` DECIMAL(4, 2) NOT NULL COMMENT 'Score between 1.00 and 10.00',
    `overall_score` DECIMAL(4, 2) NOT NULL COMMENT 'Formula: (Confidence + Clarity + Vocabulary) / 3',
    `feedback` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_created` (`user_id`, `created_at`),
    CONSTRAINT `fk_speaking_sessions_user` 
        FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
