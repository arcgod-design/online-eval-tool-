// ── Auth guard ───────────────────────────────────────────
const user = JSON.parse(localStorage.getItem("user") || "null");
if (!user || user.role !== "teacher") window.location.href = "index.html";

document.getElementById("headerSub").textContent =
    `Teacher Dashboard  –  ${user.name}`;

function logout() {
    localStorage.removeItem("user");
    window.location.href = "index.html";
}

// ── State ────────────────────────────────────────────────
let selectedSubject    = null;
let selectedAssignment = null;
let allProjects        = [];
let currentProjectId   = null;

const COLS_PER_ROW = 6;  // 6 cards per row
const ROWS_PER_PAGE = 3; // 3 rows per page = 18 cards per page
const PAGE_SIZE = COLS_PER_ROW * ROWS_PER_PAGE;
let currentPage = 1;

// ── Helpers ──────────────────────────────────────────────
function show(id)  { document.getElementById(id).classList.remove("hidden"); }
function hide(id)  { document.getElementById(id).classList.add("hidden"); }

function setBreadcrumb(parts) {
    document.getElementById("breadcrumb").innerHTML =
        parts.map((p, i) =>
            i < parts.length - 1
                ? `<span class="bc-link" onclick="bcNav(${i})">${p}</span>`
                : `<span>${p}</span>`
        ).join(" › ");
}

function bcNav(level) {
    if (level === 0) {
        // Back to subjects
        hide("secAssignments");
        hide("secProjects");
        show("secSubjects");
        setBreadcrumb(["Home"]);
    } else if (level === 1) {
        // Back to assignments
        hide("secProjects");
        show("secAssignments");
        setBreadcrumb(["Home", selectedSubject.subject_name]);
    }
}

// ── Load Subjects ────────────────────────────────────────
async function loadSubjects() {
    const res  = await fetch(`/api/subjects/teacher/${user.user_id}`);
    const data = await res.json();
    const grid = document.getElementById("subjectGrid");
    grid.innerHTML = "";

    data.forEach(sub => {
        const card = document.createElement("div");
        card.className = "card fade-in";
        card.innerHTML = `
            <div class="card-code">${sub.subject_code}</div>
            <div class="card-title">${sub.subject_name}</div>
        `;
        card.onclick = () => loadAssignments(sub);
        grid.appendChild(card);
    });
}

// ── Load Assignments ─────────────────────────────────────
let allAssignments = [];

async function loadAssignments(sub) {
    selectedSubject = sub;
    const res  = await fetch(`/api/assignments/${sub.subject_id}`);
    allAssignments = await res.json();

    document.getElementById("assignHeading").textContent =
        `Assignments – ${sub.subject_name} (${sub.subject_code})`;
    document.getElementById("assignSearch").value = "";
    document.getElementById("viewSelectedBtn").classList.add("hidden");

    renderAssignmentCards(allAssignments);

    document.getElementById("newAssignForm").classList.add("hidden");
    hide("secSubjects");
    hide("secProjects");
    show("secAssignments");
    setBreadcrumb(["Home", sub.subject_name]);
}

function filterAssignmentCards() {
    const q = document.getElementById("assignSearch").value.trim().toLowerCase();
    const filtered = allAssignments.filter(a => a.assignment_name.toLowerCase().includes(q));
    renderAssignmentCards(filtered);
}

function renderAssignmentCards(list) {
    const grid = document.getElementById("assignmentGrid");
    grid.innerHTML = "";

    // Close any open menus when clicking elsewhere
    document.onclick = (e) => {
        if (!e.target.closest(".card-menu")) {
            document.querySelectorAll(".card-menu-dropdown.open")
                .forEach(d => d.classList.remove("open"));
        }
    };

    list.forEach(a => {
        const card = document.createElement("div");
        card.className = "card fade-in";
        card.style.position = "relative";

        const isOpen    = a.is_open;
        const allowLate = a.allow_late;
        const deadline  = a.deadline ? new Date(a.deadline).toLocaleString() : "No deadline";
        const openDate  = a.open_date ? new Date(a.open_date).toLocaleString() : "—";
        const menuId    = `menu-${a.assignment_id}`;

        card.innerHTML = `
            <!-- Checkbox for multi-select -->
            <label class="assign-check-label" onclick="event.stopPropagation()">
                <input type="checkbox" class="assign-checkbox" value="${a.assignment_id}"
                    onchange="onAssignCheckChange()">
            </label>

            <!-- 3-dot menu -->
            <div class="card-menu" onclick="event.stopPropagation()">
                <button class="card-menu-btn" onclick="toggleMenu('${menuId}')">&#8942;</button>
                <div class="card-menu-dropdown" id="${menuId}">
                    <button class="menu-item" onclick="closeMenuAndRun('${menuId}', () => openEditModal(${a.assignment_id}))">
                        ✏️ Edit Assignment
                    </button>
                    <div class="menu-divider"></div>
                    <button class="menu-item" onclick="closeMenuAndRun('${menuId}', () => toggleAssignment(${a.assignment_id}, ${isOpen}))">
                        ${isOpen ? '🔒 Close Submissions' : '🔓 Open Submissions'}
                    </button>
                    <button class="menu-item" onclick="closeMenuAndRun('${menuId}', () => toggleLate(${a.assignment_id}, ${allowLate}))">
                        ${allowLate ? '⛔ Block Late Submissions' : '⏰ Allow Late Submissions'}
                    </button>
                    <div class="menu-divider"></div>
                    <button class="menu-item danger" onclick="closeMenuAndRun('${menuId}', () => confirmDeleteAssignment(${a.assignment_id}, '${a.assignment_name.replace(/'/g, "\\'")}'))">
                        🗑️ Delete Assignment
                    </button>
                </div>
            </div>

            <div class="card-title" style="padding-left:28px;padding-right:36px;">${a.assignment_name}</div>
            <div class="card-meta">Opens: ${openDate}</div>
            <div class="card-meta">Deadline: ${deadline}</div>
            <div style="margin-top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="status-badge ${isOpen ? 'badge-open' : 'badge-closed'}">
                    ${isOpen ? 'Open' : 'Closed'}
                </span>
                ${allowLate ? `<span class="status-badge" style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;">Late OK</span>` : ""}
            </div>
        `;
        card.onclick = () => loadProjects(a);
        grid.appendChild(card);
    });
}

function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    const wasOpen = menu.classList.contains("open");
    // Close all first
    document.querySelectorAll(".card-menu-dropdown.open").forEach(d => d.classList.remove("open"));
    if (!wasOpen) menu.classList.add("open");
}

function closeMenuAndRun(menuId, fn) {
    document.getElementById(menuId).classList.remove("open");
    fn();
}

function onAssignCheckChange() {
    const checked = document.querySelectorAll(".assign-checkbox:checked");
    const btn = document.getElementById("viewSelectedBtn");
    if (checked.length > 0) {
        btn.textContent = `View Submissions for ${checked.length} Assignment${checked.length > 1 ? 's' : ''}`;
        btn.classList.remove("hidden");
    } else {
        btn.classList.add("hidden");
    }
}

async function viewSelectedSubmissions() {
    const checked = Array.from(document.querySelectorAll(".assign-checkbox:checked"));
    const ids = checked.map(c => c.value);
    if (!ids.length) return;

    // Fetch all subject submissions then filter to selected assignment IDs
    const res = await fetch(`/api/projects/subject/${selectedSubject.subject_id}`);
    allSubjectProjects = await res.json();
    allProjects = allSubjectProjects.filter(p => ids.includes(String(p.assignment_id)));

    // Populate assignment dropdown on submissions page
    const sel = document.getElementById("filterAssignment");
    sel.innerHTML = `<option value="">All Selected Assignments</option>`;
    ids.forEach(id => {
        const a = allAssignments.find(x => String(x.assignment_id) === id);
        if (a) {
            const opt = document.createElement("option");
            opt.value = a.assignment_id;
            opt.textContent = a.assignment_name;
            sel.appendChild(opt);
        }
    });

    currentPage = 1;
    const names = checked.map(c => {
        const a = allAssignments.find(x => String(x.assignment_id) === c.value);
        return a ? a.assignment_name : c.value;
    });
    document.getElementById("projectHeading").textContent =
        `Submissions – ${names.join(", ")}`;
    document.getElementById("exportBtn").onclick = () => alert("Export works per assignment. Select a single assignment to export.");
    document.getElementById("filterRoll").value = "";
    document.getElementById("filterName").value = "";

    hide("secAssignments");
    show("secProjects");
    setBreadcrumb(["Home", selectedSubject.subject_name, "Selected Assignments"]);
    renderPage();
}

// ── Delete assignment ─────────────────────────────────────
function confirmDeleteAssignment(assignmentId, name) {
    document.getElementById("deleteAssignName").textContent = name;
    document.getElementById("deleteAssignId").value = assignmentId;
    document.getElementById("deleteDataCheck").checked = false;
    document.getElementById("deleteAssignModal").classList.remove("hidden");
}

function closeDeleteModal() {
    document.getElementById("deleteAssignModal").classList.add("hidden");
}

async function doDeleteAssignment() {
    const id         = document.getElementById("deleteAssignId").value;
    const deleteData = document.getElementById("deleteDataCheck").checked;

    const res = await fetch(`/api/assignments/${id}?deleteData=${deleteData}`, { method: "DELETE" });
    if (res.ok) {
        closeDeleteModal();
        loadAssignments(selectedSubject);
    } else {
        const d = await res.json();
        alert("Delete failed: " + (d.error || "Unknown error"));
    }
}

// ── New assignment form toggle ────────────────────────────
function toggleNewForm() {
    document.getElementById("newAssignForm").classList.toggle("hidden");
}

// ── Create assignment ─────────────────────────────────────
async function createAssignment() {
    const name     = document.getElementById("newAssignName").value.trim();
    const openDate = document.getElementById("newAssignOpen").value;
    const deadline = document.getElementById("newAssignDeadline").value;
    const errEl    = document.getElementById("newAssignError");
    errEl.textContent = "";

    if (!name) { errEl.textContent = "Assignment name is required."; return; }

    const res = await fetch("/api/assignments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
            subject_id:      selectedSubject.subject_id,
            assignment_name: name,
            open_date:       openDate || null,
            deadline:        deadline || null
        })
    });

    if (res.ok) {
        document.getElementById("newAssignName").value     = "";
        document.getElementById("newAssignOpen").value     = "";
        document.getElementById("newAssignDeadline").value = "";
        loadAssignments(selectedSubject); // refresh list
    } else {
        const d = await res.json();
        errEl.textContent = d.error || "Failed to create assignment.";
    }
}

// ── Toggle open/close ─────────────────────────────────────
async function toggleAssignment(assignmentId, currentlyOpen) {
    await fetch(`/api/assignments/${assignmentId}/toggle`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ is_open: !currentlyOpen })
    });
    loadAssignments(selectedSubject);
}

// ── Toggle allow late ─────────────────────────────────────
async function toggleLate(assignmentId, currentlyAllowed) {
    await fetch(`/api/assignments/${assignmentId}/late`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ allow_late: !currentlyAllowed })
    });
    loadAssignments(selectedSubject);
}

// ── Load Projects (Phase 1) ──────────────────────────────
let allSubjectProjects = []; // all submissions across subject for cross-assignment filter

async function loadProjects(assignment) {
    selectedAssignment = assignment;

    // Load this assignment's submissions
    const res = await fetch(`/api/projects/${assignment.assignment_id}`);
    allProjects = await res.json();

    // Load ALL submissions in subject for cross-assignment filter
    const res2 = await fetch(`/api/projects/subject/${selectedSubject.subject_id}`);
    allSubjectProjects = await res2.json();

    // Populate assignment dropdown
    const sel = document.getElementById("filterAssignment");
    sel.innerHTML = `<option value="">All Assignments (this subject)</option>`;
    const seen = new Set();
    allSubjectProjects.forEach(p => {
        if (!seen.has(p.assignment_id)) {
            seen.add(p.assignment_id);
            const opt = document.createElement("option");
            opt.value = p.assignment_id;
            opt.textContent = p.assignment_name;
            if (p.assignment_id === assignment.assignment_id) opt.selected = true;
            sel.appendChild(opt);
        }
    });

    currentPage = 1;
    document.getElementById("projectHeading").textContent =
        `Submissions – ${assignment.assignment_name}`;
    document.getElementById("exportBtn").onclick = () =>
        window.location.href = `/api/export/${assignment.assignment_id}`;

    document.getElementById("filterRoll").value = "";
    document.getElementById("filterName").value = "";

    hide("secAssignments");
    show("secProjects");
    setBreadcrumb(["Home", selectedSubject.subject_name, assignment.assignment_name]);
    renderPage();
}

// ── Filter helpers ────────────────────────────────────────
function getFilteredProjects() {
    const roll       = document.getElementById("filterRoll").value.trim().toLowerCase();
    const name       = document.getElementById("filterName").value.trim().toLowerCase();
    const assignId   = document.getElementById("filterAssignment").value;

    // If a specific assignment is selected use allSubjectProjects, else use allProjects
    const pool = assignId ? allSubjectProjects : allProjects;

    return pool.filter(p =>
        (!assignId || String(p.assignment_id) === String(assignId)) &&
        (!roll     || p.roll_no.toLowerCase().includes(roll)) &&
        (!name     || p.student_name.toLowerCase().includes(name))
    );
}

function applyFilter() { currentPage = 1; renderPage(); }

function clearFilters() {
    document.getElementById("filterRoll").value = "";
    document.getElementById("filterName").value = "";
    document.getElementById("filterAssignment").value = selectedAssignment ? selectedAssignment.assignment_id : "";
    applyFilter();
}

// ── Render paginated thumbnails ──────────────────────────
function renderPage() {
    const filtered = getFilteredProjects();
    const grid  = document.getElementById("projectGrid");
    const total = filtered.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    grid.innerHTML = "";

    // forEach loop to display thumbnails
    slice.forEach((p, idx) => {
        const card = document.createElement("div");
        card.className = "project-card fade-in";
        card.style.animationDelay = `${idx * 0.07}s`;

        const thumb = p.thumbnail
            ? `<img src="${p.thumbnail}" alt="Thumbnail of ${p.project_name}">`
            : `<div class="no-thumb">No Screenshot</div>`;

        card.innerHTML = `
            ${thumb}
            <div class="project-info">
                <b>${p.roll_no}</b>
                <span class="pname">${p.project_name}</span>
                <span class="sname">${p.student_name}</span>
                ${p.is_late ? `<span class="late-badge">Late</span>` : ""}
                ${p.marks !== null ? `<span class="marks-badge">Marks: ${p.marks}</span>` : ""}
            </div>
        `;
        card.onclick = () => openModal(p.project_id);
        grid.appendChild(card);
    });

    document.getElementById("pageInfo").textContent =
        total === 0
            ? "No submissions match the filter."
            : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} submissions`;

    const pag = document.getElementById("pagination");
    pag.innerHTML = "";
    for (let i = 1; i <= pages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className   = "page-btn" + (i === currentPage ? " active" : "");
        btn.onclick     = () => { currentPage = i; renderPage(); };
        pag.appendChild(btn);
    }
}

// ════════════════════════════════════════════════════════
//  MODAL  (Phase 2)
// ════════════════════════════════════════════════════════

async function openModal(projectId) {
    currentProjectId = projectId;
    const res  = await fetch(`/api/project/${projectId}`);
    const data = await res.json();

    const { project, screenshots, files } = data;

    document.getElementById("modalTitle").textContent =
        `${project.project_name}`;
    document.getElementById("modalMeta").textContent =
        `${project.roll_no}  ·  ${project.student_name}`;

    document.getElementById("marksInput").value = project.marks ?? "";
    document.getElementById("saveStatus").textContent = "";

    // Screenshots gallery
    const gallery = document.getElementById("ssGallery");
    gallery.innerHTML = "";
    screenshots.forEach(ss => {
        const img = document.createElement("img");
        img.src   = ss.screenshot_path;
        img.alt   = "Project screenshot";
        img.className = "ss-img";
        img.onclick   = () => openLightbox(ss.screenshot_path);
        gallery.appendChild(img);
    });

    // File list
    const fileList = document.getElementById("fileList");
    fileList.innerHTML = "";
    hide("fileViewer");

    files.forEach(f => {
        const item = document.createElement("div");
        item.className = "file-item";
        item.innerHTML = `
            <span class="file-icon">${fileIcon(f.file_type)}</span>
            <span class="file-name">${f.file_name}</span>
            <button class="btn-view" onclick="viewFile('${f.file_path}','${f.file_type}','${f.file_name}')">View</button>
            <a class="btn-dl" href="${f.file_path}" download="${f.file_name}">⬇</a>
        `;
        fileList.appendChild(item);
    });

    showTab("ss");
    show("evalModal");
    document.getElementById("evalModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("evalModal").classList.add("hidden");
    hide("fileViewer");
}

// ── Tabs ─────────────────────────────────────────────────
function showTab(tab) {
    document.getElementById("tabSS").classList.toggle("active",   tab === "ss");
    document.getElementById("tabCode").classList.toggle("active", tab === "code");

    if (tab === "ss") {
        show("paneScreenshots");
        hide("paneCode");
    } else {
        hide("paneScreenshots");
        show("paneCode");
    }
}

// ── Inline file viewer ───────────────────────────────────
function viewFile(path, type, name) {
    const viewer = document.getElementById("fileViewer");
    viewer.innerHTML = "";
    show("fileViewer");

    const textTypes = ["html", "js", "css", "txt", "json", "py", "java", "c", "cpp"];
    const imgTypes  = ["png", "jpg", "jpeg", "gif", "webp"];

    if (imgTypes.includes(type)) {
        viewer.innerHTML = `<img src="${path}" style="max-width:100%;border-radius:8px;">`;
    } else if (textTypes.includes(type)) {
        fetch(path)
            .then(r => r.text())
            .then(text => {
                viewer.innerHTML = `<pre class="code-preview">${escHtml(text)}</pre>`;
            });
    } else if (type === "pdf") {
        viewer.innerHTML = `<iframe src="${path}" width="100%" height="500px"></iframe>`;
    } else {
        viewer.innerHTML = `
            <p style="padding:16px;color:#555;">
                Preview not available for <b>.${type}</b> files.
                <a href="${path}" download="${name}" class="btn-dl">Download</a>
            </p>`;
    }
}

function escHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function fileIcon(type) {
    const map = { html:"🌐", js:"📜", css:"🎨", pdf:"📄",
                  doc:"📝", docx:"📝", zip:"🗜️", png:"🖼️",
                  jpg:"🖼️", jpeg:"🖼️" };
    return map[type] || "📁";
}

// ── Lightbox for screenshots ─────────────────────────────
function openLightbox(src) {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `<img src="${src}"><span onclick="this.parentElement.remove()">✕</span>`;
    lb.onclick = (e) => { if (e.target === lb) lb.remove(); };
    document.body.appendChild(lb);
}

// ════════════════════════════════════════════════════════
//  MARKS  (Phase 3)
// ════════════════════════════════════════════════════════

async function saveMarks() {
    const marks  = document.getElementById("marksInput").value;
    const status = document.getElementById("saveStatus");

    if (marks === "" || isNaN(marks)) {
        status.textContent = "Enter valid marks.";
        status.style.color = "#ef4444";
        return;
    }

    const res = await fetch("/api/marks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ project_id: currentProjectId, marks })
    });

    if (res.ok) {
        status.textContent = "✓ Saved";
        status.style.color = "#22c55e";

        // Update local array so badge refreshes on grid
        const proj = allProjects.find(p => p.project_id === currentProjectId);
        if (proj) proj.marks = marks;
        renderPage();
    } else {
        status.textContent = "Save failed.";
        status.style.color = "#ef4444";
    }
}

// ════════════════════════════════════════════════════════
//  EDIT ASSIGNMENT MODAL
// ════════════════════════════════════════════════════════

let editingAssignmentId = null;

async function openEditModal(assignmentId) {
    editingAssignmentId = assignmentId;
    const res  = await fetch(`/api/assignments/${assignmentId}/detail`);
    const data = await res.json();
    const { assignment, questions, attachments } = data;

    document.getElementById("editAssignTitle").textContent = `Edit: ${assignment.assignment_name}`;
    document.getElementById("editAssignName").value     = assignment.assignment_name;
    document.getElementById("editAssignOpen").value     = assignment.open_date
        ? new Date(assignment.open_date).toISOString().slice(0,16) : "";
    document.getElementById("editAssignDeadline").value = assignment.deadline
        ? new Date(assignment.deadline).toISOString().slice(0,16) : "";
    document.getElementById("editAssignError").textContent = "";

    renderQuestions(questions);
    renderAttachments(attachments);

    document.getElementById("editAssignModal").classList.remove("hidden");
}

function closeEditModal() {
    document.getElementById("editAssignModal").classList.add("hidden");
    editingAssignmentId = null;
}

async function saveAssignmentEdit() {
    const name     = document.getElementById("editAssignName").value.trim();
    const openDate = document.getElementById("editAssignOpen").value;
    const deadline = document.getElementById("editAssignDeadline").value;
    if (!name) { document.getElementById("editAssignError").textContent = "Name required."; return; }

    await fetch(`/api/assignments/${editingAssignmentId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ assignment_name: name, open_date: openDate || null, deadline: deadline || null })
    });
    closeEditModal();
    loadAssignments(selectedSubject);
}

// ── Questions ─────────────────────────────────────────────
function renderQuestions(questions) {
    const list = document.getElementById("questionList");
    list.innerHTML = "";
    questions.forEach((q, i) => {
        const row = document.createElement("div");
        row.className = "file-item";
        row.innerHTML = `
            <span class="file-icon" style="font-size:14px;font-weight:700;color:#0d9488;">Q${i+1}</span>
            <span class="file-name">${q.question_text}</span>
            <button class="btn-toggle" style="background:#ef4444;" onclick="deleteQuestion(${q.question_id})">Delete</button>
        `;
        list.appendChild(row);
    });
}

async function addQuestion() {
    const text = document.getElementById("newQuestionText").value.trim();
    if (!text) return;
    const res = await fetch(`/api/assignments/${editingAssignmentId}/questions`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question_text: text, question_order: 0 })
    });
    if (res.ok) {
        document.getElementById("newQuestionText").value = "";
        refreshEditModal();
    }
}

async function deleteQuestion(questionId) {
    await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
    refreshEditModal();
}

// ── Attachments ───────────────────────────────────────────
function renderAttachments(attachments) {
    const list = document.getElementById("attachmentList");
    list.innerHTML = "";
    attachments.forEach(f => {
        const row = document.createElement("div");
        row.className = "file-item";
        row.innerHTML = `
            <span class="file-icon">${fileIcon(f.file_type)}</span>
            <span class="file-name">${f.file_name}</span>
            <a class="btn-dl" href="${f.file_path}" download="${f.file_name}">Download</a>
            <button class="btn-toggle" style="background:#ef4444;" onclick="deleteAttachment(${f.id})">Delete</button>
        `;
        list.appendChild(row);
    });
}

async function uploadAttachment() {
    const fileInput = document.getElementById("newAttachFile");
    if (!fileInput.files.length) return;
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    const res = await fetch(`/api/assignments/${editingAssignmentId}/attachments`, {
        method: "POST", body: formData
    });
    if (res.ok) { fileInput.value = ""; refreshEditModal(); }
}

async function deleteAttachment(id) {
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    refreshEditModal();
}

async function refreshEditModal() {
    const res  = await fetch(`/api/assignments/${editingAssignmentId}/detail`);
    const data = await res.json();
    renderQuestions(data.questions);
    renderAttachments(data.attachments);
}

// ── Init ─────────────────────────────────────────────────
loadSubjects();
