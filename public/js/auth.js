import {auth} from "./app.js";
import {signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    db
} from "./app.js";
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- LOGIN ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);


            // Lee su rol en Firestore
            const uid = cred.user.uid;
            const ref = doc(db, "usuarios", uid);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                await signOut(auth);
                alert("Tu perfil no está completo. Contacta al administrador.");
                return;
            }

            const {
                rol
            } = snap.data() || {};

            // Guarda el rol por si lo necesitas en UI
            localStorage.setItem("rol", rol || "");

            if (rol === "admin") {
                window.location.href = "dashboard.html"; // panel administrador
            } else if (rol === "cajero") {
                window.location.href = "cajero.html"; // vista cajero
            } else {
                alert("Rol desconocido, contacta al administrador.");
                await signOut(auth);
            }

        } catch (error) {
            document.getElementById("mensaje").textContent = "❌ " + (error.code || error.message);
        }
    });
}


// --- REGISTRO ---
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            // regla simple para asignar rol:
            const rol = (email.toLowerCase() === "admin@elesfuerzo.com") ? "admin" : "cajero";

            // guarda perfil
            await setDoc(doc(db, "usuarios", cred.user.uid), {
                correo: email,
                rol,
                creado: new Date()
            });

            // enviar verificación
            await sendEmailVerification(cred.user);

            alert(`Cuenta creada. Rol asignado: ${rol}. Verifica tu correo e inicia sesión.`);
            window.location.href = "index.html";
        } catch (error) {
            document.getElementById("mensaje").textContent = "❌ " + error.message;
        }
    });
}

const ADMIN_PAGES = [
    "dashboard.html",
    "/productos/"
];

if (ADMIN_PAGES.some(p => window.location.pathname.includes(p))) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "/index.html";
        }
    });
}

// --- PROTEGER DASHBOARD SOLO PARA ADMIN ---
if (window.location.pathname.includes("dashboard.html")) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }
        try {
            const ref = doc(db, "usuarios", user.uid);
            const snap = await getDoc(ref);
            const rol = snap.exists() ? snap.data().rol : "";

            if (rol !== "admin") {
                alert("Acceso restringido al panel de administrador.");
                 window.location.href = "cajero.html"; // cuando exista
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });
}

// ============================
// Recuperar contraseña (Reset Password)
// ============================
document.getElementById("btnResetPass") ?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
        alert("Por favor, ingresa tu correo arriba primero.");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert("✅ Te hemos enviado un correo para restablecer tu contraseña.");
    } catch (err) {
        alert("❌ No se pudo enviar el correo: " + err.message);
    }
});

// Ocultar enlaces de admin en el cajero
const rolActual = localStorage.getItem("rol");
if (rolActual !== "admin") {
    document.querySelectorAll(".solo-admin").forEach(el => el.style.display = "none");
}


// --- LOGOUT ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });
}

