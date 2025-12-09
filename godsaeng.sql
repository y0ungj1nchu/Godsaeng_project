-- =====================================================================
-- ⚠ 0. 기존 테이블 삭제 (자식 → 부모 순서)
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Words;
DROP TABLE IF EXISTS WordSets;
DROP TABLE IF EXISTS Inquiries;
DROP TABLE IF EXISTS FAQs;
DROP TABLE IF EXISTS Announcements;
DROP TABLE IF EXISTS Diaries;
DROP TABLE IF EXISTS Todos;
DROP TABLE IF EXISTS StudyLogs;
DROP TABLE IF EXISTS StudyCategories;
DROP TABLE IF EXISTS Notifications;
DROP TABLE IF EXISTS Characters;
DROP TABLE IF EXISTS CharacterTemplates;
DROP TABLE IF EXISTS Users;

SET FOREIGN_KEY_CHECKS = 1;



-- =====================================================================
-- ⚠ 1. 데이터베이스 생성 / 선택
-- =====================================================================

CREATE DATABASE IF NOT EXISTS godsaeng_db
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE godsaeng_db;



-- =====================================================================
-- ⚠ 2. Users (사용자)
-- =====================================================================

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    theme_color VARCHAR(20) DEFAULT '#FFD400',
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resetPasswordToken VARCHAR(255),
    resetPasswordExpires TIMESTAMP
);



-- =====================================================================
-- ⚠ 3. Characters (캐릭터)
-- =====================================================================

CREATE TABLE Characters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL UNIQUE,
    characterName VARCHAR(50) DEFAULT '캐릭터',
    characterImage VARCHAR(100) DEFAULT 'snoopy1',
    level INT DEFAULT 1,
    exp INT DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);



-- =====================================================================
-- ⚠ 4. StudyCategories (공부 카테고리)
-- =====================================================================

CREATE TABLE StudyCategories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    categoryName VARCHAR(100) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);



-- =====================================================================
-- ⚠ 5. StudyLogs (공부 기록)
-- =====================================================================

CREATE TABLE StudyLogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    categoryId INT Not NULL,
    startTime TIMESTAMP NULL,
    endTime TIMESTAMP NULL,
    duration INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES StudyCategories(id)
);



-- =====================================================================
-- ⚠ 6. Todos (할 일 목록)
-- =====================================================================

CREATE TABLE Todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    memo TEXT,
    isCompleted BOOLEAN DEFAULT FALSE,
    dueDate DATE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);



-- =====================================================================
-- ⚠ 7. Diaries (일기)
-- =====================================================================

CREATE TABLE Diaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    diaryDate DATE NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);



-- =====================================================================
-- ⚠ 8. Announcements (공지사항)
-- =====================================================================

CREATE TABLE Announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adminId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (adminId) REFERENCES Users(id) ON DELETE CASCADE
);



-- =====================================================================
-- ⚠ 9. FAQs (자주 묻는 질문)
-- =====================================================================

CREATE TABLE FAQs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adminId INT NOT NULL,
    category VARCHAR(50),
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (adminId) REFERENCES Users(id) ON DELETE CASCADE
);



-- =====================================================================
-- ⚠ 10. Inquiries (1:1 문의)
-- =====================================================================

CREATE TABLE Inquiries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status ENUM('pending', 'answered') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answerAdminId INT,
    answer TEXT,
    answeredAt TIMESTAMP NULL,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (answerAdminId) REFERENCES Users(id) ON DELETE SET NULL
);



-- =====================================================================
-- ⚠ 11. WordSets / Words (단어장)
-- =====================================================================

CREATE TABLE WordSets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    setTitle VARCHAR(100) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE Words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wordSetId INT NOT NULL,
    question VARCHAR(255) NOT NULL,
    answer VARCHAR(255) NOT NULL,
    FOREIGN KEY (wordSetId) REFERENCES WordSets(id) ON DELETE CASCADE
);



-- =====================================================================
-- ⚠ 12. CharacterTemplates (기본 캐릭터 목록)
-- =====================================================================

CREATE TABLE CharacterTemplates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    level INT NOT NULL,
    imagePath VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- =====================================================================
-- ⚠ 13. Notifications (알림)
-- =====================================================================

CREATE TABLE Notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    isRead BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);