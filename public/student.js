// ── Auth guard ───────────────────────────────────────────
const user = JSON.parse(localStorage.getItem("user") || "null");
if (!user || user.role !== "student") window.location.href = "index.html";

document.getElementById("headerSub").textContent =
    `Student Dashboard  –  ${user.name}`;

function logout() {
    localStorage.removeItem("user");
    window.location.href = "index.html";
}

// ── State ────────────────────────────────────────────────
let selectedSubject    = null;
let selectedAssignment = null;

// ── Helpers ──────────────────────────────────────────────
function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

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
        hide("secAssignments");
        hide("secSubmit");
        show("secSubjects");
        setBreadcrumb(["Home"]);
    } else if (level === 1) {
        hide("secSubmit");
        show("secAssignments");
        setBreadcrumb(["Home", selectedSubject.subject_name]);
    }
}

// ── Load Subjects ────────────────────────────────────────
async function loadSubjects() {
    const res  = await fetch(`/api/subjects/student/${user.user_id}`);
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
async function loadAssignments(sub) {
    selectedSubject = sub;
    const res  = await fetch(`/api/assignments/${sub.subject_id}`);
    const data = await res.json();

    const grid = document.getElementById("assignmentGrid");
    grid.innerHTML = "";
    document.getElementById("assignHeading").textContent =
        `Assignments – ${sub.subject_name}`;

    // Filter input for assignments
    let filterVal = "";
    const filterRow = document.createElement("div");
    filterRow.className = "filter-bar";
    filterRow.innerHTML = `<input type="text" id="assignFilter" placeholder="Search assignments..." oninput="filterAssignments()" style="max-width:320px;">`;
    grid.before(filterRow);

    window._assignData = data; // store for filtering

    renderAssignments(data);

    hide("secSubjects");
    hide("secSubmit");
    show("secAssignments");
    setBreadcrumb(["Home", sub.subject_name]);
}

function renderAssignments(data) {
    const grid = document.getElementById("assignmentGrid");
    grid.innerHTML = "";
    data.forEach(a => {
        const card = document.createElement("div");
        card.className = "card fade-in";
        card.innerHTML = `
            <div class="card-title">${a.assignment_name}</div>
            ${a.deadline ? `<div class="card-meta">Due: ${new Date(a.deadline).toLocaleString()}</div>` : ""}
            <div style="margin-top:8px;">
                <span class="status-badge ${a.is_open ? 'badge-open' : 'badge-closed'}">
                    ${a.is_open ? 'Open' : 'Closed'}
                </span>
                ${a.allow_late ? `<span class="status-badge" style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;margin-left:6px;">Late OK</span>` : ""}
            </div>
        `;
        card.onclick = () => openSubmitPage(a);
        grid.appendChild(card);
    });
}

function filterAssignments() {
    const val = document.getElementById("assignFilter").value.trim().toLowerCase();
    const filtered = (window._assignData || []).filter(a =>
        a.assignment_name.toLowerCase().includes(val)
    );
    renderAssignments(filtered);
}

// ── Open Submit Page ─────────────────────────────────────
async function openSubmitPage(assignment) {
    selectedAssignment = assignment;

    const chk = await fetch(
        `/api/submission/check/${user.user_id}/${assignment.assignment_id}`
    );
    const status = await chk.json();

    document.getElementById("submitHeading").textContent =
        `Submit – ${assignment.assignment_name}`;

    const section = document.getElementById("secSubmit");
    let card = document.getElementById("submitCard");
    if (!card) {
        card = document.createElement("div");
        card.id = "submitCard";
        card.className = "submit-card fade-in";
        section.appendChild(card);
    }

    /*
     * Submission rules (clear logic):
     *
     * CASE 1 – Not submitted, deadline not passed, assignment open
     *   → Show submit form (normal)
     *
     * CASE 2 – Already submitted, deadline not passed, assignment open
     *   → Show edit form ("Update Submission")
     *
     * CASE 3 – Deadline passed, allow_late = true, not yet submitted
     *   → Show submit form with LATE warning
     *
     * CASE 4 – Deadline passed, allow_late = true, already submitted
     *   → Show "already submitted" (no re-edit after deadline)
     *
     * CASE 5 – Assignment closed (is_open = false) AND allow_late = false
     *   → Show "closed" message
     *
     * CASE 6 – Deadline passed, allow_late = false
     *   → Show "deadline passed" message
     */

    const open        = status.is_open;
    const submitted   = status.submitted;
    const pastDL      = status.past_deadline;
    const allowLate   = status.allow_late;

    // Determine what to show
    const showEdit        = submitted && open && !pastDL;
    const showLateSubmit  = !submitted && pastDL && allowLate && open;
    const showNormal      = !submitted && open && !pastDL;
    const showForm        = showNormal || showEdit || showLateSubmit;

    if (!open && !allowLate) {
        card.innerHTML = `
            <div class="already-submitted" style="background:#fee2e2;color:#991b1b;border-color:#fca5a5;">
                Submissions are currently closed for this assignment.
            </div>`;
    } else if (pastDL && !allowLate) {
        card.innerHTML = `
            <div class="already-submitted" style="background:#fee2e2;color:#991b1b;border-color:#fca5a5;">
                The deadline has passed. Late submissions are not allowed for this assignment.
            </div>`;
    } else if (submitted && !showEdit) {
        // submitted + past deadline (regardless of allow_late)
        card.innerHTML = `
            <div class="already-submitted">
                You have already submitted this assignment.
                ${pastDL ? " The deadline has passed so no further edits are allowed." : ""}
            </div>`;
    } else if (showForm) {
        const isEdit      = showEdit;
        const lateWarning = showLateSubmit
            ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#854d0e;font-size:13px;font-weight:600;">
                   Warning: The deadline has passed. This submission will be marked as LATE.
               </div>` : "";

        // Fetch existing files if editing
        let existingScreenshots = [];
        let existingCodeFiles   = [];
        if (isEdit && status.project_id) {
            const projRes  = await fetch(`/api/project/${status.project_id}`);
            const projData = await projRes.json();
            existingScreenshots = projData.screenshots || [];
            existingCodeFiles   = projData.files       || [];
        }

        const existingSSHtml = existingScreenshots.length > 0
            ? `<div style="margin-top:8px;">
                <p style="font-size:12px;color:#64748b;margin-bottom:6px;">Current screenshots — click X to remove:</p>
                <div id="existingSSList" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
               </div>` : `<div id="existingSSList"></div>`;

        const existingFilesHtml = existingCodeFiles.length > 0
            ? `<div style="margin-top:8px;">
                <p style="font-size:12px;color:#64748b;margin-bottom:6px;">Current files — click X to remove:</p>
                <div id="existingFileList" style="display:flex;flex-direction:column;gap:6px;"></div>
               </div>` : `<div id="existingFileList"></div>`;

        card.innerHTML = `
            ${lateWarning}
            <form id="submitForm" enctype="multipart/form-data">
                <div class="input-group">
                    <label>Project Name</label>
                    <input type="text" id="projectName" placeholder="e.g. Online Evaluation Tool" required
                        value="${isEdit && status.project_name ? status.project_name : ''}"
                        style="background:#fff;color:#1e293b;border:1px solid #e2e8f0;">
                </div>
                <div class="input-group">
                    <label>Roll Number</label>
                    <input type="text" id="rollNo" placeholder="e.g. 21CS101" required
                        value="${isEdit && status.roll_no ? status.roll_no : ''}"
                        style="background:#fff;color:#1e293b;border:1px solid #e2e8f0;">
                </div>
                <div class="input-group">
                    <label>Screenshots <span class="hint">(PNG / JPG)</span></label>
                    ${existingSSHtml}
                    <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <input type="file" id="screenshots" accept=".png,.jpg,.jpeg" multiple
                            ${isEdit ? "" : "required"}
                            style="background:#fff;color:#1e293b;border:1px solid #e2e8f0;flex:1;">
                        ${isEdit ? `<button type="button" class="btn-save" onclick="addScreenshots()">Add</button>` : ""}
                    </div>
                    <div class="preview-row" id="ssPreview"></div>
                </div>
                <div class="input-group">
                    <label>Code / Document Files <span class="hint">(.html .js .css .doc .docx .zip etc.)</span></label>
                    ${existingFilesHtml}
                    <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <input type="file" id="codefiles" multiple
                            ${isEdit ? "" : "required"}
                            style="background:#fff;color:#1e293b;border:1px solid #e2e8f0;flex:1;">
                        ${isEdit ? `<button type="button" class="btn-save" onclick="addCodeFiles()">Add</button>` : ""}
                    </div>
                    <div class="file-chips" id="codeChips"></div>
                </div>
                <div id="submitError" class="error-msg"></div>
                <div id="submitSuccess" class="success-msg hidden"></div>
                <button type="submit" class="btn-primary" style="width:auto;padding:11px 28px;">
                    ${isEdit ? 'Save Changes' : showLateSubmit ? 'Submit Late' : 'Submit Project'}
                </button>
            </form>`;

        // Render existing screenshots with delete buttons
        if (isEdit) {
            renderExistingScreenshots(existingScreenshots, status.project_id);
            renderExistingFiles(existingCodeFiles, status.project_id);
        }

        document.getElementById("screenshots").addEventListener("change", function () {
            const preview = document.getElementById("ssPreview");
            preview.innerHTML = "";
            Array.from(this.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.className = "ss-thumb-preview";
                    preview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });

        document.getElementById("codefiles").addEventListener("change", function () {
            const chips = document.getElementById("codeChips");
            chips.innerHTML = "";
            Array.from(this.files).forEach(file => {
                const chip = document.createElement("span");
                chip.className = "chip";
                chip.textContent = file.name;
                chips.appendChild(chip);
            });
        });

        document.getElementById("submitForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const errEl     = document.getElementById("submitError");
            const successEl = document.getElementById("submitSuccess");
            errEl.textContent = "";
            successEl.classList.add("hidden");

            const submitBtn = document.querySelector("#submitForm button[type='submit']");
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";

            const formData = new FormData();
            formData.append("student_id",    user.user_id);
            formData.append("student_name",  user.name);
            formData.append("roll_no",       document.getElementById("rollNo").value.trim());
            formData.append("project_name",  document.getElementById("projectName").value.trim());
            formData.append("assignment_id", selectedAssignment.assignment_id);

            Array.from(document.getElementById("screenshots").files).forEach(f => formData.append("screenshots", f));
            Array.from(document.getElementById("codefiles").files).forEach(f => formData.append("codefiles", f));

            try {
                const url    = isEdit ? `/api/submit/${status.project_id}` : "/api/submit";
                const method = isEdit ? "PUT" : "POST";
                const res    = await fetch(url, { method, body: formData });
                const data   = await res.json();

                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? "Update Submission" : showLateSubmit ? "Submit Late" : "Submit Project";

                if (!res.ok) { errEl.textContent = data.error || "Submission failed."; return; }

                // After successful save, refresh the page to show updated files
                successEl.textContent = data.is_late
                    ? "Submitted successfully (marked as LATE). Refreshing..."
                    : (isEdit ? "Submission updated successfully. Refreshing..." : "Project submitted successfully.");
                successEl.classList.remove("hidden");

                // Reload the submit page after a short delay to show updated files
                setTimeout(() => openSubmitPage(selectedAssignment), 1200);

            } catch {
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? "Update Submission" : "Submit Project";
                errEl.textContent = "Server error. Please try again.";
            }
        });
    }

    hide("secAssignments");
    show("secSubmit");
    setBreadcrumb(["Home", selectedSubject.subject_name, assignment.assignment_name]);
}

// ── Per-file edit helpers ─────────────────────────────────

function renderExistingScreenshots(screenshots, projectId) {
    const container = document.getElementById("existingSSList");
    if (!container) return;
    container.innerHTML = "";
    screenshots.forEach(ss => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;display:inline-block;";
        wrap.innerHTML = `
            <img src="${ss.screenshot_path}"
                style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:2px solid #14b8a6;">
            ${ss.is_thumbnail ? `<span style="position:absolute;bottom:2px;left:2px;background:#0d9488;color:#fff;font-size:9px;padding:1px 4px;border-radius:4px;">Thumb</span>` : ""}
            <button type="button" onclick="deleteScreenshot(${ss.id}, ${projectId})"
                style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;padding:0;">✕</button>
        `;
        container.appendChild(wrap);
    });
}

function renderExistingFiles(files, projectId) {
    const container = document.getElementById("existingFileList");
    if (!container) return;
    container.innerHTML = "";
    files.forEach(f => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f1f5f9;border-radius:8px;border:1px solid #e2e8f0;";
        row.innerHTML = `
            <span style="font-size:13px;flex:1;color:#1e293b;">${f.file_name}</span>
            <button type="button" onclick="deleteProjectFile(${f.id}, ${projectId})"
                style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;">Remove</button>
        `;
        container.appendChild(row);
    });
}

async function deleteScreenshot(ssId, projectId) {
    if (!confirm("Remove this screenshot?")) return;
    const res = await fetch(`/api/screenshot/${ssId}`, { method: "DELETE" });
    if (res.ok) {
        // Refresh just the screenshot list
        const projRes  = await fetch(`/api/project/${projectId}`);
        const projData = await projRes.json();
        renderExistingScreenshots(projData.screenshots || [], projectId);
    }
}

async function deleteProjectFile(fileId, projectId) {
    if (!confirm("Remove this file?")) return;
    const res = await fetch(`/api/projectfile/${fileId}`, { method: "DELETE" });
    if (res.ok) {
        const projRes  = await fetch(`/api/project/${projectId}`);
        const projData = await projRes.json();
        renderExistingFiles(projData.files || [], projectId);
    }
}

async function addScreenshots() {
    const input = document.getElementById("screenshots");
    if (!input.files.length) return;
    const projectId = (await (await fetch(`/api/submission/check/${user.user_id}/${selectedAssignment.assignment_id}`)).json()).project_id;
    if (!projectId) return;

    for (const file of Array.from(input.files)) {
        const fd = new FormData();
        fd.append("screenshot", file);
        await fetch(`/api/project/${projectId}/addscreenshot`, { method: "POST", body: fd });
    }
    input.value = "";
    document.getElementById("ssPreview").innerHTML = "";

    const projRes  = await fetch(`/api/project/${projectId}`);
    const projData = await projRes.json();
    renderExistingScreenshots(projData.screenshots || [], projectId);
}

async function addCodeFiles() {
    const input = document.getElementById("codefiles");
    if (!input.files.length) return;
    const projectId = (await (await fetch(`/api/submission/check/${user.user_id}/${selectedAssignment.assignment_id}`)).json()).project_id;
    if (!projectId) return;

    for (const file of Array.from(input.files)) {
        const fd = new FormData();
        fd.append("codefile", file);
        await fetch(`/api/project/${projectId}/addfile`, { method: "POST", body: fd });
    }
    input.value = "";
    document.getElementById("codeChips").innerHTML = "";

    const projRes  = await fetch(`/api/project/${projectId}`);
    const projData = await projRes.json();
    renderExistingFiles(projData.files || [], projectId);
}

// ── Init ─────────────────────────────────────────────────
loadSubjects();
