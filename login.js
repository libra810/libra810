import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    limit,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const mssvInput = document.getElementById("mssv");
const pinInput = document.getElementById("pin");
const loginButton = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const togglePassword = document.getElementById("togglePassword");
const rememberCheckbox = document.getElementById("remember");
const adminModeButton = document.getElementById("adminModeBtn");
const loginTitle = document.querySelector(".login-card h2");
const loginDescription = document.querySelector(".login-description");
const mssvLabel = document.querySelector('label[for="mssv"]');
const pinLabel = document.querySelector('label[for="pin"]');

let isAdminMode = false;

function showError(message) {
    loginError.textContent = message;
}

function clearError() {
    loginError.textContent = "";
}

togglePassword.addEventListener("click", () => {
    const isHidden = pinInput.type === "password";
    pinInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "🙈" : "👁";
});

async function loginUser() {
    clearError();

    const mssv = mssvInput.value.trim();
    const pin = pinInput.value.trim();

    if (!mssv || !pin) {
        showError("Vui lòng nhập đầy đủ MSSV và PIN.");
        return;
    }

    if (isAdminMode) {
        loginButton.disabled = true;
        loginButton.textContent = "Đang đăng nhập...";

        try {
            const adminQuery = query(
                collection(db, "admin"),
                where("email", "==", mssv),
                limit(1)
            );
            const snapshot = await getDocs(adminQuery);
            const admin = snapshot.docs.find(
                (candidate) => candidate.data().password === pin
            );

            if (!admin) {
                showError("Email hoặc mật khẩu Admin không đúng.");
                return;
            }

            localStorage.setItem("adminLoggedIn", "true");
            localStorage.setItem("adminEmail", mssv);
            localStorage.setItem("adminDocumentId", admin.id);
            window.location.href = "index.html";
        } catch (error) {
            console.error("Admin login failed:", error);
            showError("Không thể đăng nhập Admin lúc này.");
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Đăng nhập";
        }

        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Đang đăng nhập...";

    try {
        const usersQuery = query(
            collection(db, "registeredCabinets"),
            where("mssv", "==", mssv),
            limit(10)
        );
        const snapshot = await getDocs(usersQuery);

        const user = snapshot.docs.find(
            (candidate) => candidate.data().pin === pin
        );

        if (!user) {
            showError("MSSV hoặc PIN không đúng.");
            return;
        }

        const userData = user.data();
        const storage = rememberCheckbox.checked
            ? localStorage
            : sessionStorage;

        storage.setItem("userLoggedIn", "true");
        storage.setItem("userDocumentId", user.id);
        storage.setItem("userMssv", userData.mssv);
        window.location.href = "qruser.html";
    } catch (error) {
        console.error("User login failed:", error);
        showError("Không thể đăng nhập lúc này. Vui lòng thử lại.");
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Đăng nhập";
    }
}

loginButton.addEventListener("click", loginUser);

adminModeButton.addEventListener("click", () => {
    isAdminMode = !isAdminMode;
    loginTitle.textContent = isAdminMode
        ? "Đăng nhập Admin"
        : "Đăng nhập người dùng";
    loginDescription.textContent = isAdminMode
        ? "Đăng nhập để quản lý hệ thống"
        : "Nhập thông tin do quản trị viên cung cấp";
    mssvLabel.textContent = isAdminMode ? "Email" : "MSSV";
    pinLabel.textContent = isAdminMode ? "Mật khẩu" : "PIN";
    mssvInput.placeholder = isAdminMode ? "Nhập email Admin" : "Nhập MSSV";
    pinInput.placeholder = isAdminMode ? "Nhập mật khẩu" : "Nhập PIN";
    mssvInput.inputMode = isAdminMode ? "email" : "numeric";
    pinInput.inputMode = isAdminMode ? "text" : "numeric";

    if (isAdminMode) {
        pinInput.removeAttribute("maxlength");
    } else {
        pinInput.maxLength = 10;
    }

    adminModeButton.textContent = isAdminMode
        ? "Đăng nhập người dùng"
        : "Đăng nhập quản trị viên";
    clearError();
});

[mssvInput, pinInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            loginUser();
        }
    });
});

const savedMssv = localStorage.getItem("userMssv");
if (savedMssv) {
    mssvInput.value = savedMssv;
    rememberCheckbox.checked = true;
}