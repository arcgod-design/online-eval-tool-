-- ============================================================
--  Online Evaluation Tool  –  Full Database Schema
--  Run this in phpMyAdmin or MySQL CLI after starting XAMPP
-- ============================================================

CREATE DATABASE IF NOT EXISTS evaluation_tool;
USE evaluation_tool;

-- ── Users (teachers + students) ───────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('teacher','student') NOT NULL,
    login_count INT DEFAULT 0
);

-- ── Subjects ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
    subject_id   INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(20)  NOT NULL UNIQUE
);

-- ── Teacher ↔ Subject mapping ─────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    FOREIGN KEY (teacher_id) REFERENCES users(user_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

-- ── Student ↔ Subject mapping ─────────────────────────────
CREATE TABLE IF NOT EXISTS student_subjects (
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES users(user_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

-- ── Assignments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id        INT AUTO_INCREMENT PRIMARY KEY,
    subject_id           INT NOT NULL,
    assignment_name      VARCHAR(150) NOT NULL,
    open_date            DATETIME DEFAULT NULL,
    deadline             DATETIME DEFAULT NULL,
    is_open              BOOLEAN DEFAULT TRUE,
    allow_late           BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

-- ── Projects (one per student per assignment) ─────────────
CREATE TABLE IF NOT EXISTS projects (
    project_id    INT AUTO_INCREMENT PRIMARY KEY,
    roll_no       VARCHAR(30)  NOT NULL,
    student_id    INT          NOT NULL,
    student_name  VARCHAR(100) NOT NULL,
    project_name  VARCHAR(200) NOT NULL,
    assignment_id INT          NOT NULL,
    marks         DECIMAL(5,2) DEFAULT NULL,
    is_late       BOOLEAN      DEFAULT FALSE,
    submitted_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id)    REFERENCES users(user_id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id)
);

-- ── Assignment Questions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS assignment_questions (
    question_id   INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_order INT DEFAULT 0,
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE
);

-- ── Assignment Attachments (files added by teacher) ───────
CREATE TABLE IF NOT EXISTS assignment_attachments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_path     VARCHAR(300) NOT NULL,
    file_type     VARCHAR(50),
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS project_screenshots (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    project_id      INT          NOT NULL,
    roll_no         VARCHAR(30)  NOT NULL,
    screenshot_path VARCHAR(300) NOT NULL,
    is_thumbnail    BOOLEAN      DEFAULT FALSE,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- ── Project Code / Document Files ─────────────────────────
CREATE TABLE IF NOT EXISTS project_files (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT          NOT NULL,
    roll_no     VARCHAR(30)  NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(300) NOT NULL,
    file_type   VARCHAR(50),
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);



-- ============================================================
--  Sample Seed Data
-- ============================================================

INSERT INTO users (name, email, password, role) VALUES
('Dr. A. Kumar',   'teacher1@college.edu', 'pass123', 'teacher'),
('Prof. B. Singh',  'teacher2@college.edu', 'pass123', 'teacher'),
('Rahul Sharma',   '21cs101@college.edu',  'pass123', 'student'),
('Anita Verma',    '21cs102@college.edu',  'pass123', 'student'),
('Karan Mehta',    '21cs103@college.edu',  'pass123', 'student');

INSERT INTO subjects (subject_name, subject_code) VALUES
('Web Technologies',      'CS301'),
('Software Engineering',  'CS302'),
('Database Management',   'CS303');

-- teacher1 → CS301, CS302 | teacher2 → CS303
INSERT INTO teacher_subjects VALUES (1,1),(1,2),(2,3);

-- student mappings
INSERT INTO student_subjects VALUES (3,1),(3,2),(4,1),(5,1),(5,3);

INSERT INTO assignments (subject_id, assignment_name, open_date, deadline, is_open, allow_late) VALUES
(1, 'Mini Project – Online Evaluation Tool', '2025-06-01 00:00:00', '2025-06-30 23:59:59', TRUE,  TRUE),
(1, 'Assignment 2 – Responsive Portfolio',   '2025-06-10 00:00:00', '2025-07-15 23:59:59', TRUE,  FALSE),
(2, 'Assignment 1 – UML Diagrams',           '2025-06-01 00:00:00', '2025-06-25 23:59:59', FALSE, FALSE);
