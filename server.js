const express  = require("express");
const mysql    = require("mysql2");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const ExcelJS  = require("exceljs");

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ── DB connection ────────────────────────────────────────
const db = mysql.createConnection({
    host:     "localhost",
    user:     "root",
    password: "",           // XAMPP default
    database: "evaluation_tool"
});

db.connect(err => {
    if (err) { console.error("DB connection failed:", err.message); return; }
    console.log("MySQL connected.");
});

// ── Multer storage ───────────────────────────────────────
function makeStorage(folder) {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join("uploads", folder);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
            cb(null, unique + path.extname(file.originalname));
        }
    });
}

const uploadScreenshots = multer({ storage: makeStorage("screenshots") });
const uploadCode        = multer({ storage: makeStorage("code") });
const uploadMixed       = multer({ storage: makeStorage("submissions") });

// ════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════

// POST /api/login
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    db.query(
        "SELECT user_id, name, role, login_count FROM users WHERE email=? AND password=?",
        [email, password],
        (err, rows) => {
            if (err || rows.length === 0)
                return res.status(401).json({ error: "Invalid credentials" });

            const user = rows[0];
            const newCount = (user.login_count || 0) + 1;

            db.query(
                "UPDATE users SET login_count = ? WHERE user_id = ?",
                [newCount, user.user_id],
                () => {
                    res.json({ ...user, login_count: newCount });
                }
            );
        }
    );
});

// ════════════════════════════════════════════════════════
//  SUBJECTS
// ════════════════════════════════════════════════════════

// Teacher subjects
app.get("/api/subjects/teacher/:userId", (req, res) => {
    const q = `
        SELECT s.subject_id, s.subject_name, s.subject_code
        FROM subjects s
        JOIN teacher_subjects ts ON s.subject_id = ts.subject_id
        WHERE ts.teacher_id = ?
    `;
    db.query(q, [req.params.userId], (err, rows) => res.json(rows || []));
});

// Student subjects
app.get("/api/subjects/student/:userId", (req, res) => {
    const q = `
        SELECT s.subject_id, s.subject_name, s.subject_code
        FROM subjects s
        JOIN student_subjects ss ON s.subject_id = ss.subject_id
        WHERE ss.student_id = ?
    `;
    db.query(q, [req.params.userId], (err, rows) => res.json(rows || []));
});

// ════════════════════════════════════════════════════════
//  ASSIGNMENTS
// ════════════════════════════════════════════════════════

app.get("/api/assignments/:subjectId", (req, res) => {
    db.query(
        "SELECT * FROM assignments WHERE subject_id = ?",
        [req.params.subjectId],
        (err, rows) => res.json(rows || [])
    );
});

// POST /api/assignments  – teacher creates a new assignment
app.post("/api/assignments", (req, res) => {
    const { subject_id, assignment_name, open_date, deadline } = req.body;
    db.query(
        "INSERT INTO assignments (subject_id, assignment_name, open_date, deadline, is_open) VALUES (?,?,?,?,TRUE)",
        [subject_id, assignment_name, open_date || null, deadline || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, assignment_id: result.insertId });
        }
    );
});

// PATCH /api/assignments/:id/toggle  – open or close submissions
app.patch("/api/assignments/:id/toggle", (req, res) => {
    const { is_open } = req.body;
    db.query("UPDATE assignments SET is_open = ? WHERE assignment_id = ?",
        [is_open, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// PATCH /api/assignments/:id/late
app.patch("/api/assignments/:id/late", (req, res) => {
    const { allow_late } = req.body;
    db.query("UPDATE assignments SET allow_late = ? WHERE assignment_id = ?",
        [allow_late, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// DELETE /api/assignments/:id  – delete assignment (optionally with all submission data)
app.delete("/api/assignments/:id", (req, res) => {
    const id         = req.params.id;
    const deleteData = req.query.deleteData === "true";

    const doDelete = () => {
        db.query("DELETE FROM assignments WHERE assignment_id=?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    };

    // Helper: delete a file from disk safely
    const deleteFile = (filePath) => {
        try {
            const abs = path.join(__dirname, filePath);
            if (fs.existsSync(abs)) fs.unlinkSync(abs);
        } catch (_) {}
    };

    if (!deleteData) {
        doDelete();
    } else {
        // Collect all file paths before deleting DB rows
        db.query("SELECT project_id FROM projects WHERE assignment_id=?", [id], (err, projects) => {
            const projectIds = (projects || []).map(p => p.project_id);

            const cleanup = () => {
                // Delete assignment-level files
                db.query("SELECT file_path FROM assignment_attachments WHERE assignment_id=?", [id], (e, attachments) => {
                    (attachments || []).forEach(a => deleteFile(a.file_path));
                    db.query("DELETE FROM assignment_questions WHERE assignment_id=?",   [id]);
                    db.query("DELETE FROM assignment_attachments WHERE assignment_id=?", [id]);
                    db.query("DELETE FROM projects WHERE assignment_id=?", [id], () => doDelete());
                });
            };

            if (projectIds.length === 0) return cleanup();

            const idList = projectIds.join(",");

            // Get screenshot + code file paths, delete from disk, then delete DB rows
            db.query(`SELECT screenshot_path FROM project_screenshots WHERE project_id IN (${idList})`, (e1, ss) => {
                (ss || []).forEach(s => deleteFile(s.screenshot_path));

                db.query(`SELECT file_path FROM project_files WHERE project_id IN (${idList})`, (e2, files) => {
                    (files || []).forEach(f => deleteFile(f.file_path));

                    db.query(`DELETE FROM project_screenshots WHERE project_id IN (${idList})`, () => {
                        db.query(`DELETE FROM project_files WHERE project_id IN (${idList})`, () => cleanup());
                    });
                });
            });
        });
    }
});

// PUT /api/assignments/:id  – edit assignment name/dates
app.put("/api/assignments/:id", (req, res) => {
    const { assignment_name, open_date, deadline } = req.body;
    db.query(
        "UPDATE assignments SET assignment_name=?, open_date=?, deadline=? WHERE assignment_id=?",
        [assignment_name, open_date || null, deadline || null, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// GET /api/assignments/:id/detail  – full assignment with questions + attachments
app.get("/api/assignments/:id/detail", (req, res) => {
    const id = req.params.id;
    db.query("SELECT * FROM assignments WHERE assignment_id=?", [id], (err, rows) => {
        if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
        db.query("SELECT * FROM assignment_questions WHERE assignment_id=? ORDER BY question_order", [id], (e2, questions) => {
            db.query("SELECT * FROM assignment_attachments WHERE assignment_id=?", [id], (e3, attachments) => {
                res.json({ assignment: rows[0], questions: questions || [], attachments: attachments || [] });
            });
        });
    });
});

// POST /api/assignments/:id/questions  – add a question
app.post("/api/assignments/:id/questions", (req, res) => {
    const { question_text, question_order } = req.body;
    db.query(
        "INSERT INTO assignment_questions (assignment_id, question_text, question_order) VALUES (?,?,?)",
        [req.params.id, question_text, question_order || 0],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, question_id: result.insertId });
        }
    );
});

// DELETE /api/questions/:id
app.delete("/api/questions/:id", (req, res) => {
    db.query("DELETE FROM assignment_questions WHERE question_id=?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// POST /api/assignments/:id/attachments  – upload file attachment
const attachUpload = multer({ storage: makeStorage("assignment_files") }).single("file");
app.post("/api/assignments/:id/attachments", (req, res) => {
    attachUpload(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const filePath = "/" + req.file.path.replace(/\\/g, "/");
        const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");
        db.query(
            "INSERT INTO assignment_attachments (assignment_id, file_name, file_path, file_type) VALUES (?,?,?,?)",
            [req.params.id, req.file.originalname, filePath, ext],
            (err2, result) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json({ success: true, id: result.insertId, file_name: req.file.originalname, file_path: filePath, file_type: ext });
            }
        );
    });
});

// DELETE /api/attachments/:id
app.delete("/api/attachments/:id", (req, res) => {
    db.query("DELETE FROM assignment_attachments WHERE id=?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// GET /api/projects/subject/:subjectId  – all submissions across all assignments in a subject
app.get("/api/projects/subject/:subjectId", (req, res) => {
    const q = `
        SELECT p.project_id, p.roll_no, p.student_name, p.project_name, p.marks, p.is_late,
               a.assignment_name, a.assignment_id,
               ps.screenshot_path AS thumbnail
        FROM projects p
        JOIN assignments a ON p.assignment_id = a.assignment_id
        LEFT JOIN project_screenshots ps ON p.project_id = ps.project_id AND ps.is_thumbnail = TRUE
        WHERE a.subject_id = ?
        ORDER BY p.roll_no, a.assignment_id
    `;
    db.query(q, [req.params.subjectId], (err, rows) => res.json(rows || []));
});

// ════════════════════════════════════════════════════════
//  PROJECTS  (Phase 1 – thumbnail list)
// ════════════════════════════════════════════════════════

app.get("/api/projects/:assignmentId", (req, res) => {
    const q = `
        SELECT p.project_id, p.roll_no, p.student_name, p.project_name, p.marks, p.is_late,
               ps.screenshot_path AS thumbnail
        FROM projects p
        LEFT JOIN project_screenshots ps
            ON p.project_id = ps.project_id AND ps.is_thumbnail = TRUE
        WHERE p.assignment_id = ?
        ORDER BY p.roll_no
    `;
    db.query(q, [req.params.assignmentId], (err, rows) => res.json(rows || []));
});

// ════════════════════════════════════════════════════════
//  PROJECT DETAIL  (Phase 2 – modal data)
// ════════════════════════════════════════════════════════

app.get("/api/project/:projectId", (req, res) => {
    const pid = req.params.projectId;

    db.query("SELECT * FROM projects WHERE project_id = ?", [pid], (err, proj) => {
        if (!proj || proj.length === 0) return res.status(404).json({ error: "Not found" });

        db.query(
            "SELECT * FROM project_screenshots WHERE project_id = ? ORDER BY is_thumbnail DESC",
            [pid],
            (err2, screenshots) => {
                db.query(
                    "SELECT * FROM project_files WHERE project_id = ?",
                    [pid],
                    (err3, files) => {
                        res.json({ project: proj[0], screenshots, files });
                    }
                );
            }
        );
    });
});

// ════════════════════════════════════════════════════════
//  MARKS  (Phase 3)
// ════════════════════════════════════════════════════════

app.post("/api/marks", (req, res) => {
    const { project_id, marks } = req.body;
    db.query(
        "UPDATE projects SET marks = ? WHERE project_id = ?",
        [marks, project_id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// GET /api/export/:assignmentId  → Excel download
app.get("/api/export/:assignmentId", async (req, res) => {
    const q = `
        SELECT p.roll_no, p.student_name, p.project_name, p.marks,
               a.assignment_name, s.subject_name
        FROM projects p
        JOIN assignments a ON p.assignment_id = a.assignment_id
        JOIN subjects s    ON a.subject_id    = s.subject_id
        WHERE p.assignment_id = ?
        ORDER BY p.roll_no
    `;
    db.query(q, [req.params.assignmentId], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Marks");

        ws.columns = [
            { header: "Roll No",        key: "roll_no",         width: 15 },
            { header: "Student Name",   key: "student_name",    width: 25 },
            { header: "Subject",        key: "subject_name",    width: 25 },
            { header: "Assignment",     key: "assignment_name", width: 30 },
            { header: "Project Name",   key: "project_name",    width: 30 },
            { header: "Marks",          key: "marks",           width: 10 }
        ];

        // Style header row
        ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        ws.getRow(1).fill = {
            type: "pattern", pattern: "solid",
            fgColor: { argb: "FF4F46E5" }
        };

        rows.forEach(r => ws.addRow(r));

        res.setHeader("Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition",
            `attachment; filename="marks_assignment_${req.params.assignmentId}.xlsx"`);

        await wb.xlsx.write(res);
        res.end();
    });
});

// ════════════════════════════════════════════════════════
//  STUDENT SUBMISSION
// ════════════════════════════════════════════════════════

// DELETE /api/screenshot/:id  – delete a single screenshot
app.delete("/api/screenshot/:id", (req, res) => {
    db.query("SELECT screenshot_path, project_id FROM project_screenshots WHERE id=?", [req.params.id], (err, rows) => {
        if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
        const filePath = rows[0].screenshot_path;
        try { const abs = path.join(__dirname, filePath); if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch(_) {}
        db.query("DELETE FROM project_screenshots WHERE id=?", [req.params.id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            // If this was thumbnail, promote next screenshot
            db.query(
                "UPDATE project_screenshots SET is_thumbnail=TRUE WHERE project_id=? ORDER BY id LIMIT 1",
                [rows[0].project_id]
            );
            res.json({ success: true });
        });
    });
});

// DELETE /api/projectfile/:id  – delete a single code/doc file
app.delete("/api/projectfile/:id", (req, res) => {
    db.query("SELECT file_path FROM project_files WHERE id=?", [req.params.id], (err, rows) => {
        if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
        try { const abs = path.join(__dirname, rows[0].file_path); if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch(_) {}
        db.query("DELETE FROM project_files WHERE id=?", [req.params.id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true });
        });
    });
});

// POST /api/project/:projectId/addscreenshot  – add a single screenshot
const singleSSUpload = multer({ storage: makeStorage("screenshots") }).single("screenshot");
app.post("/api/project/:projectId/addscreenshot", (req, res) => {
    singleSSUpload(req, res, (err) => {
        if (err || !req.file) return res.status(400).json({ error: "No file" });
        const projectId = req.params.projectId;
        const filePath  = "/" + req.file.path.replace(/\\/g, "/");
        // Check if any screenshot exists — if not, this becomes thumbnail
        db.query("SELECT COUNT(*) AS cnt FROM project_screenshots WHERE project_id=?", [projectId], (e, rows) => {
            const isThumbnail = rows[0].cnt === 0;
            db.query(
                "SELECT roll_no FROM projects WHERE project_id=?", [projectId], (e2, proj) => {
                    const roll_no = proj && proj[0] ? proj[0].roll_no : "";
                    db.query(
                        "INSERT INTO project_screenshots (project_id, roll_no, screenshot_path, is_thumbnail) VALUES (?,?,?,?)",
                        [projectId, roll_no, filePath, isThumbnail],
                        (e3, result) => {
                            res.json({ success: true, id: result.insertId, screenshot_path: filePath, is_thumbnail: isThumbnail });
                        }
                    );
                }
            );
        });
    });
});

// POST /api/project/:projectId/addfile  – add a single code/doc file
const singleFileUpload = multer({ storage: makeStorage("code") }).single("codefile");
app.post("/api/project/:projectId/addfile", (req, res) => {
    singleFileUpload(req, res, (err) => {
        if (err || !req.file) return res.status(400).json({ error: "No file" });
        const projectId = req.params.projectId;
        const filePath  = "/" + req.file.path.replace(/\\/g, "/");
        const ext       = path.extname(req.file.originalname).toLowerCase().replace(".", "");
        db.query("SELECT roll_no FROM projects WHERE project_id=?", [projectId], (e, proj) => {
            const roll_no = proj && proj[0] ? proj[0].roll_no : "";
            db.query(
                "INSERT INTO project_files (project_id, roll_no, file_name, file_path, file_type) VALUES (?,?,?,?,?)",
                [projectId, roll_no, req.file.originalname, filePath, ext],
                (e2, result) => {
                    res.json({ success: true, id: result.insertId, file_name: req.file.originalname, file_path: filePath, file_type: ext });
                }
            );
        });
    });
});

// Check if student already submitted + assignment status
app.get("/api/submission/check/:studentId/:assignmentId", (req, res) => {
    db.query(
        "SELECT project_id, roll_no, project_name FROM projects WHERE student_id=? AND assignment_id=?",
        [req.params.studentId, req.params.assignmentId],
        (err, rows) => {
            db.query(
                "SELECT is_open, deadline, allow_late FROM assignments WHERE assignment_id=?",
                [req.params.assignmentId],
                (err2, asgn) => {
                    const a    = asgn && asgn[0] ? asgn[0] : {};
                    const proj = rows && rows[0] ? rows[0] : null;
                    const now  = new Date();
                    const pastDeadline = (a.deadline && now > new Date(a.deadline)) ? true : false;
                    res.json({
                        submitted:     !!proj,
                        project_id:    proj ? proj.project_id : null,
                        project_name:  proj ? proj.project_name : null,
                        roll_no:       proj ? proj.roll_no : null,
                        is_open:       !!a.is_open,
                        allow_late:    !!a.allow_late,
                        past_deadline: pastDeadline,
                        deadline:      a.deadline || null
                    });
                }
            );
        }
    );
});

// POST /api/submit  (multipart: screenshots[] + codefiles[])
const submissionUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const folder = file.fieldname === "screenshots"
                ? "uploads/screenshots"
                : "uploads/code";
            fs.mkdirSync(folder, { recursive: true });
            cb(null, folder);
        },
        filename: (req, file, cb) => {
            const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
            cb(null, unique + path.extname(file.originalname));
        }
    })
}).fields([
    { name: "screenshots", maxCount: 10 },
    { name: "codefiles",   maxCount: 20 }
]);

app.post("/api/submit", submissionUpload, (req, res) => {
    const { student_id, student_name, roll_no, project_name, assignment_id } = req.body;

    db.query("SELECT deadline, allow_late, is_open FROM assignments WHERE assignment_id=?", [assignment_id], (err, asgn) => {
        const a = asgn && asgn[0] ? asgn[0] : {};
        const now = new Date();
        // Only mark late if deadline exists AND current time is past it
        const isLate = (a.deadline && now > new Date(a.deadline)) ? true : false;

        db.query(
            "INSERT INTO projects (roll_no, student_id, student_name, project_name, assignment_id, is_late) VALUES (?,?,?,?,?,?)",
            [roll_no, student_id, student_name, project_name, assignment_id, isLate],
            (err2, result) => {
                if (err2) return res.status(500).json({ error: err2.message });
                insertFiles(result.insertId, roll_no, req, res, isLate);
            }
        );
    });
});

// PUT /api/submit/:projectId  – edit/resubmit
app.put("/api/submit/:projectId", submissionUpload, (req, res) => {
    const { project_name, assignment_id } = req.body;
    const projectId = req.params.projectId;

    db.query("SELECT deadline FROM assignments WHERE assignment_id=?", [assignment_id], (err, asgn) => {
        const a = asgn && asgn[0] ? asgn[0] : {};
        const now = new Date();
        // Only mark late if deadline exists AND current time is past it
        const isLate = (a.deadline && now > new Date(a.deadline)) ? true : false;

        // Update project name + late flag
        db.query(
            "UPDATE projects SET project_name=?, is_late=?, submitted_at=NOW() WHERE project_id=?",
            [project_name, isLate, projectId],
            (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });

                // Delete old files from disk + DB if new ones uploaded
                const screenshots = req.files["screenshots"] || [];
                const codefiles   = req.files["codefiles"]   || [];

                const afterScreenshots = () => {
                    if (codefiles.length > 0) {
                        db.query("SELECT file_path FROM project_files WHERE project_id=?", [projectId], (e, oldFiles) => {
                            (oldFiles || []).forEach(f => {
                                try { const abs = path.join(__dirname, f.file_path); if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch(_) {}
                            });
                            db.query("DELETE FROM project_files WHERE project_id=?", [projectId], () => {
                                db.query("SELECT roll_no FROM projects WHERE project_id=?", [projectId], (e3, proj) => {
                                    const roll_no = proj && proj[0] ? proj[0].roll_no : "";
                                    insertFiles(projectId, roll_no, req, res, isLate);
                                });
                            });
                        });
                    } else {
                        db.query("SELECT roll_no FROM projects WHERE project_id=?", [projectId], (e3, proj) => {
                            const roll_no = proj && proj[0] ? proj[0].roll_no : "";
                            insertFiles(projectId, roll_no, req, res, isLate);
                        });
                    }
                };

                if (screenshots.length > 0) {
                    db.query("SELECT screenshot_path FROM project_screenshots WHERE project_id=?", [projectId], (e, oldSS) => {
                        (oldSS || []).forEach(s => {
                            try { const abs = path.join(__dirname, s.screenshot_path); if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch(_) {}
                        });
                        db.query("DELETE FROM project_screenshots WHERE project_id=?", [projectId], afterScreenshots);
                    });
                } else {
                    afterScreenshots();
                }
            }
        );
    });
});

function insertFiles(projectId, roll_no, req, res, isLate) {
    const screenshots = req.files["screenshots"] || [];
    const codefiles   = req.files["codefiles"]   || [];

    screenshots.forEach((file, idx) => {
        const filePath = "/" + file.path.replace(/\\/g, "/");
        db.query(
            "INSERT INTO project_screenshots (project_id, roll_no, screenshot_path, is_thumbnail) VALUES (?,?,?,?)",
            [projectId, roll_no, filePath, idx === 0]
        );
    });

    codefiles.forEach(file => {
        const filePath = "/" + file.path.replace(/\\/g, "/");
        const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
        db.query(
            "INSERT INTO project_files (project_id, roll_no, file_name, file_path, file_type) VALUES (?,?,?,?,?)",
            [projectId, roll_no, file.originalname, filePath, ext]
        );
    });

    res.json({ success: true, project_id: projectId, is_late: isLate });
}

// ── Start ────────────────────────────────────────────────
app.listen(3000, () =>
    console.log("Server running → http://localhost:3000")
);
