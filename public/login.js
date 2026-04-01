// ── Name greeting (localStorage for name, DB for count) ──
const savedName = localStorage.getItem("userName");
const greetEl   = document.getElementById("greetMsg");

if (!savedName) {
    document.getElementById("nameOverlay").style.display = "flex";
} else {
    greetEl.textContent = `Hello, ${savedName}! Please log in.`;
}

function saveName() {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) return;
    localStorage.setItem("userName", name);
    document.getElementById("nameOverlay").style.display = "none";
    greetEl.textContent = `Hello, ${name}! Please log in.`;
}

document.getElementById("nameInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") saveName();
});

// ── Login form ────────────────────────────────────────────
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passInput").value;
    const errEl    = document.getElementById("loginError");
    errEl.textContent = "";

    try {
        const res  = await fetch("/api/login", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent = data.error || "Login failed.";
            return;
        }

        // Store session including login_count
        localStorage.setItem("user", JSON.stringify(data));

        // Update greeting with login count from DB
        const name  = localStorage.getItem("userName") || data.name;
        const count = data.login_count;
        greetEl.textContent = count === 1
            ? `Hello, ${name}! Welcome for the first time!`
            : `Hello, ${name}! You have logged in ${count} times.`;

        // Short delay so user sees the message, then redirect
        setTimeout(() => {
            window.location.href = data.role === "teacher" ? "teacher.html" : "student.html";
        }, 900);

    } catch {
        errEl.textContent = "Server error. Please try again.";
    }
});
