# Online Evaluation Tool – Setup Guide

## Prerequisites
- Node.js (v18+)
- XAMPP (for MySQL)

---

## Step 1 – Start XAMPP

1. Open **XAMPP Control Panel**
2. Click **Start** next to **Apache**
3. Click **Start** next to **MySQL**
4. Both should show green "Running" status

---

## Step 2 – Create the Database

1. Open your browser → go to `http://localhost/phpmyadmin`
2. Click **New** in the left sidebar
3. Name it `evaluation_tool` → click **Create**
4. Click the `evaluation_tool` database in the sidebar
5. Click the **SQL** tab at the top
6. Open the file `db.sql` from this folder, copy all its contents
7. Paste into the SQL box → click **Go**

This creates all tables and inserts sample data (teachers, students, subjects, assignments).

---

## Step 3 – Install Node Dependencies

Open a terminal in the `web project` folder and run:

```
npm install
```

---

## Step 4 – Start the Server

```
node server.js
```

You should see:
```
MySQL connected.
Server running → http://localhost:3000
```

---

## Step 5 – Open the App

Go to `http://localhost:3000` in your browser.

---

## Sample Login Credentials

| Role    | Email                    | Password |
|---------|--------------------------|----------|
| Teacher | teacher1@college.edu     | pass123  |
| Teacher | teacher2@college.edu     | pass123  |
| Student | 21cs101@college.edu      | pass123  |
| Student | 21cs102@college.edu      | pass123  |
| Student | 21cs103@college.edu      | pass123  |

---

## Database Tables Overview

| Table               | Purpose                                      |
|---------------------|----------------------------------------------|
| `users`             | All users (teachers + students) with role    |
| `subjects`          | Subject list with code                       |
| `teacher_subjects`  | Which teacher teaches which subject          |
| `student_subjects`  | Which student is enrolled in which subject   |
| `assignments`       | Assignments per subject with deadline        |
| `projects`          | Student submissions (roll no, name, marks)   |
| `project_screenshots` | Screenshot files per project (first = thumbnail) |
| `project_files`     | Code/document files per project              |
| `visit_log`         | Optional log of page visits with user name   |

---

## How to View Data in phpMyAdmin

1. Go to `http://localhost/phpmyadmin`
2. Click `evaluation_tool` in the left sidebar
3. Click any table name to browse its rows
4. Use the **SQL** tab to run custom queries, e.g.:

```sql
-- See all submissions with marks
SELECT p.roll_no, p.student_name, p.project_name, p.marks,
       a.assignment_name
FROM projects p
JOIN assignments a ON p.assignment_id = a.assignment_id;

-- See which teacher teaches what
SELECT u.name AS teacher, s.subject_name
FROM users u
JOIN teacher_subjects ts ON u.user_id = ts.teacher_id
JOIN subjects s ON ts.subject_id = s.subject_id;
```

---

## Folder Structure

```
web project/
├── server.js          ← Express backend (all APIs)
├── db.sql             ← Database schema + seed data
├── package.json
├── GUIDE.md           ← This file
├── uploads/
│   ├── screenshots/   ← Uploaded screenshot images
│   └── code/          ← Uploaded code/doc files
└── public/
    ├── index.html     ← Login page
    ├── login.js       ← Login logic + visit counter
    ├── teacher.html   ← Teacher dashboard
    ├── teacher.js     ← Teacher logic
    ├── student.html   ← Student dashboard
    ├── student.js     ← Student logic
    └── style.css      ← All styles
```

---

## Troubleshooting

**"DB connection failed" or ECONNREFUSED**
→ MySQL is not running. Open XAMPP and start MySQL.

**"Cannot GET /"**
→ Server is not running. Run `node server.js` in the terminal.

**Login says "Invalid credentials"**
→ Make sure you ran `db.sql` in phpMyAdmin to insert the seed data.

**Files not uploading**
→ The `uploads/` folder is created automatically. Make sure the server is running.
