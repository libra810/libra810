import { db } from "./firebase-config.js";
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const userInfo = document.getElementById("userInfo");
const personalDataElement = document.getElementById("personalData");
const qrCodeElement = document.getElementById("qrcode");
const qrError = document.getElementById("qrError");
const logoutButton = document.getElementById("logoutBtn");

const userDocumentId =
    localStorage.getItem("userDocumentId") ||
    sessionStorage.getItem("userDocumentId");

const isLoggedIn =
    localStorage.getItem("userLoggedIn") === "true" ||
    sessionStorage.getItem("userLoggedIn") === "true";

if (!isLoggedIn || !userDocumentId) {
    window.location.replace("login.html");
}

async function loadUserQr() {
    try {
        const userSnapshot = await getDoc(
            doc(db, "registeredCabinets", userDocumentId)
        );

        if (!userSnapshot.exists()) {
            throw new Error("User not found");
        }

        const user = userSnapshot.data();
        if (!user.personalData) {
            throw new Error("PersonalData is missing");
        }

        const personalData =
            user.personalData.replace(/^PD-/, "");

        userInfo.textContent = `${user.owner} - MSSV ${user.mssv}`;
        if (personalDataElement) {
            personalDataElement.textContent = personalData;
        }
        new QRCode(qrCodeElement, {
            text: personalData,
            width: 220,
            height: 220,
            colorDark: "#163b4d",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    } catch (error) {
        console.error("Could not load user QR:", error);
        qrError.textContent = "Không thể tải PersonalData. Vui lòng đăng nhập lại.";
    }
}

logoutButton.addEventListener("click", () => {
    localStorage.removeItem("userLoggedIn");
    localStorage.removeItem("userDocumentId");
    sessionStorage.removeItem("userLoggedIn");
    sessionStorage.removeItem("userDocumentId");
    window.location.replace("login.html");
});

if (isLoggedIn && userDocumentId) {
    loadUserQr();
}