import { db } from "./firebase-config.js";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MQTT_CONFIG = {
    host: "1a85a5ce64c04c998b01fe92b1f946f6.s1.eu.hivemq.cloud",
    port: 8884,
    path: "/mqtt",
    topic: "esp32/lock",
    historyTopic: "locker/history",
    statusTopic: "esp32/status",
    username: "xuanphuc",
    password: "tnxp2004108"
};

let mqttClient = null;

const recentlyPublishedCommands = [];

/* =====================================================
   SMART CABINET
   SCRIPT.JS
===================================================== */


/* =====================================================
   DATA
===================================================== */

let registeredCards = [];

let historyData = [];

let pendingAction = null;

let selectedCardIndex = null;

let selectedCabinet = null;

let selectedHistoryId = null;

const registeredCabinetsCollection =
    collection(db, "registeredCabinets");

const historyCollection =
    collection(db, "history");

/* =====================================================
   ADMIN LOGIN CHECK
===================================================== */

const isLoggedIn =
    localStorage.getItem("adminLoggedIn") === "true"
    ||
    sessionStorage.getItem("adminLoggedIn") === "true";


if (!isLoggedIn) {

    window.location.replace(
        "login.html"
    );

}
/* =====================================================
   DOM
===================================================== */

const registerModal =
    document.getElementById("registerModal");

const adminPinModal =
    document.getElementById("adminPinModal");

const editModal =
    document.getElementById("editModal");

const renewModal =
    document.getElementById("renewModal");

const updatePinModal =
    document.getElementById("updatePinModal");

const deleteModal =
    document.getElementById("deleteModal");

const changeAdminPasswordModal =
    document.getElementById("changeAdminPasswordModal");

const changeAdminPinModal =
    document.getElementById("changeAdminPinModal");


/* =====================================================
   CLOCK
===================================================== */

function updateClock() {

    const clock =
        document.getElementById("clock");


    if (!clock) {
        return;
    }


    const now =
        new Date();


    const hours =
        String(now.getHours())
            .padStart(2, "0");


    const minutes =
        String(now.getMinutes())
            .padStart(2, "0");


    const seconds =
        String(now.getSeconds())
            .padStart(2, "0");


    clock.textContent =
        `${hours}:${minutes}:${seconds}`;
}


updateClock();


setInterval(
    updateClock,
    1000
);


/* =====================================================
   DATE
===================================================== */

function getTodayInputDate() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(now.getMonth() + 1)
            .padStart(2, "0");


    const day =
        String(now.getDate())
            .padStart(2, "0");


    return `${year}-${month}-${day}`;
}


/* =====================================================
   FORMAT DATE
===================================================== */

function formatDate(date) {

    const d =
        new Date(date);


    const day =
        String(d.getDate())
            .padStart(2, "0");


    const month =
        String(d.getMonth() + 1)
            .padStart(2, "0");


    const year =
        d.getFullYear();


    return `${day}/${month}/${year}`;
}


/* =====================================================
   FORMAT DATE INPUT
===================================================== */

function formatDateFromInput(value) {

    if (!value) {
        return "";
    }


    const parts =
        value.split("-");


    if (parts.length !== 3) {
        return value;
    }


    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


/* =====================================================
   FORMAT TIME
===================================================== */

function formatTime(date) {

    return new Date(date)
        .toLocaleTimeString(
            "vi-VN",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );
}


/* =====================================================
   INITIAL DATE
===================================================== */

const historyDate =
    document.getElementById(
        "historyDate"
    );


if (historyDate) {

    historyDate.value =
        getTodayInputDate();

}


/* =====================================================
   UID
===================================================== */

function generateUID() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";

    let uid = "";

    for (let i = 0; i < 26; i++) {

        const randomIndex =
            Math.floor(
                Math.random() * chars.length
            );

        uid += chars[randomIndex];

    }

    return uid;

}

function generatePersonalData() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let personalData = "";

    for (let i = 0; i < 32; i++) {

        const randomIndex =
            Math.floor(Math.random() * chars.length);

        personalData += chars[randomIndex];

    }

    return personalData;

}


/* =====================================================
   CABINET AVAILABILITY
===================================================== */

function isCabinetRegistered(cabinetName) {

    return registeredCards.some(
        card => card.cabinet === cabinetName
    );

}

function syncCabinetAvailability() {

    const cabinetSelect =
        document.getElementById("cabinetSelect");

    const registerBtn =
        document.getElementById("openRegisterBtn");

    if (!cabinetSelect) {
        return;
    }

    const options =
        [...cabinetSelect.options];

    let hasAvailableCabinet = false;

    options.forEach(option => {

        const occupied =
            isCabinetRegistered(option.value);

        option.disabled = occupied;

        if (!occupied) {
            hasAvailableCabinet = true;
        }

    });

    const selectedValue =
        cabinetSelect.value;

    if (
        selectedValue &&
        !options.some(
            option =>
                option.value === selectedValue &&
                !option.disabled
        )
    ) {

        const firstAvailable =
            options.find(
                option => !option.disabled
            );

        if (firstAvailable) {
            cabinetSelect.value =
                firstAvailable.value;
        }

    }

    if (registerBtn) {
        registerBtn.disabled = !hasAvailableCabinet;
    }

}

/* =====================================================
   MODAL OPEN
===================================================== */

function openModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.add(
        "show"
    );

}


/* =====================================================
   MODAL CLOSE
===================================================== */

function closeModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );

}


/* =====================================================
   CLOSE ALL MODALS
===================================================== */

function closeAllModals() {

    document.querySelectorAll(
        ".modal-overlay"
    ).forEach(
        modal => {

            modal.classList.remove(
                "show"
            );

        }
    );

}


/* =====================================================
   TOAST
===================================================== */

function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.classList.remove(
        "error"
    );


    if (type === "error") {

        toast.classList.add(
            "error"
        );

    }


    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        2500
    );

}

function showFirestoreError(action, error) {

    console.error(`Firestore ${action} error:`, error);

    showToast(
        `${action} thất bại. Vui lòng thử lại.`,
        "error"
    );

}


/* =====================================================
   CLOSE BUTTONS
===================================================== */

document.querySelectorAll(
    "[data-close]"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const modalId =
                    button.dataset.close;


                const modal =
                    document.getElementById(
                        modalId
                    );


                closeModal(
                    modal
                );

            }
        );

    }
);


/* =====================================================
   CLICK OUTSIDE MODAL
===================================================== */

document.querySelectorAll(
    ".modal-overlay"
).forEach(
    modal => {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeModal(
                        modal
                    );

                }

            }
        );

    }
);


/* =====================================================
   ADMIN AUTHENTICATION
===================================================== */

function requireAdmin(
    action,
    index = null
) {

    pendingAction =
        action;


    selectedCardIndex =
        index;


    const pinInput =
        document.getElementById(
            "adminPinInput"
        );


    const error =
        document.getElementById(
            "adminPinError"
        );


    if (pinInput) {

        pinInput.value = "";

    }


    if (error) {

        error.classList.remove(
            "show"
        );

    }


    openModal(
        adminPinModal
    );


    setTimeout(
        () => {

            pinInput?.focus();

        },
        100
    );

}


/* =====================================================
   ADMIN PIN CONFIRM
===================================================== */

async function confirmAdminPin() {

    const pinInput =
        document.getElementById(
            "adminPinInput"
        );


    const error =
        document.getElementById(
            "adminPinError"
        );


    const pin =
        pinInput?.value.trim();


    const adminDocumentId =
        localStorage.getItem("adminDocumentId");


    let isValidAdminPassword = false;


    if (adminDocumentId && pin) {

        try {

            const adminSnapshot = await getDoc(
                doc(db, "admin", adminDocumentId)
            );

            isValidAdminPassword =
                adminSnapshot.exists() &&
                adminSnapshot.data().pin === pin;

        } catch (error) {

            console.error("Không thể xác thực Admin:", error);

        }

    }


    if (!isValidAdminPassword) {

        error.textContent =
            "PIN ADMIN không chính xác.";


        error.classList.add(
            "show"
        );


        return;

    }


    error.classList.remove(
        "show"
    );


    closeModal(
        adminPinModal
    );


    await executeAdminAction();

}


document.getElementById(
    "confirmAdminPin"
)?.addEventListener(
    "click",
    confirmAdminPin
);


/* =====================================================
   ENTER ADMIN PIN
===================================================== */

document.getElementById(
    "adminPinInput"
)?.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            confirmAdminPin();

        }

    }
);


/* =====================================================
   CHANGE ADMIN PASSWORD
===================================================== */

document.getElementById(
    "changeAdminPasswordBtn"
)?.addEventListener(
    "click",
    () => {

        document.getElementById(
            "currentAdminPassword"
        ).value = "";

        document.getElementById(
            "newAdminPassword"
        ).value = "";

        document.getElementById(
            "confirmAdminPassword"
        ).value = "";

        document.getElementById(
            "adminPasswordError"
        ).textContent = "";

        openModal(changeAdminPasswordModal);

    }
);


document.getElementById(
    "saveAdminPasswordBtn"
)?.addEventListener(
    "click",
    async () => {

        const currentPassword = document.getElementById(
            "currentAdminPassword"
        ).value.trim();

        const newPassword = document.getElementById(
            "newAdminPassword"
        ).value.trim();

        const confirmPassword = document.getElementById(
            "confirmAdminPassword"
        ).value.trim();

        const error = document.getElementById(
            "adminPasswordError"
        );

        const adminDocumentId =
            localStorage.getItem("adminDocumentId");


        if (!adminDocumentId) {
            error.textContent =
                "Phiên đăng nhập cũ. Vui lòng đăng xuất và đăng nhập lại.";
            return;
        }


        if (!currentPassword || !newPassword || !confirmPassword) {
            error.textContent = "Vui lòng nhập đầy đủ mật khẩu.";
            return;
        }


        if (newPassword.length < 4) {
            error.textContent = "Mật khẩu mới phải có ít nhất 4 ký tự.";
            return;
        }


        if (newPassword !== confirmPassword) {
            error.textContent = "Xác nhận mật khẩu mới không khớp.";
            return;
        }


        try {

            const adminReference = doc(
                db,
                "admin",
                adminDocumentId
            );
            const adminSnapshot =
                await getDoc(adminReference);


            if (
                !adminSnapshot.exists() ||
                adminSnapshot.data().password !== currentPassword
            ) {
                error.textContent = "Mật khẩu hiện tại không đúng.";
                return;
            }


            await updateDoc(
                adminReference,
                { password: newPassword }
            );

            closeModal(changeAdminPasswordModal);
            showToast("Đổi mật khẩu Admin thành công");

        } catch (changePasswordError) {

            console.error(
                "Không thể đổi mật khẩu Admin:",
                changePasswordError
            );
            error.textContent = "Không thể đổi mật khẩu lúc này.";

        }

    }
);


/* =====================================================
   CHANGE ADMIN PIN
===================================================== */

document.getElementById(
    "changeAdminPinBtn"
)?.addEventListener(
    "click",
    () => {

        document.getElementById(
            "currentAdminPin"
        ).value = "";

        document.getElementById(
            "newAdminPin"
        ).value = "";

        document.getElementById(
            "confirmNewAdminPin"
        ).value = "";

        document.getElementById(
            "adminPinChangeError"
        ).textContent = "";

        openModal(changeAdminPinModal);

    }
);


document.getElementById(
    "saveAdminPinBtn"
)?.addEventListener(
    "click",
    async () => {

        const currentPin = document.getElementById(
            "currentAdminPin"
        ).value.trim();

        const newPin = document.getElementById(
            "newAdminPin"
        ).value.trim();

        const confirmPin = document.getElementById(
            "confirmNewAdminPin"
        ).value.trim();

        const error = document.getElementById(
            "adminPinChangeError"
        );

        const adminDocumentId =
            localStorage.getItem("adminDocumentId");


        if (!adminDocumentId) {
            error.textContent =
                "Phiên đăng nhập cũ. Vui lòng đăng xuất và đăng nhập lại.";
            return;
        }


        if (!/^\d{4,10}$/.test(newPin)) {
            error.textContent = "PIN mới phải gồm 4-10 chữ số.";
            return;
        }


        if (newPin !== confirmPin) {
            error.textContent = "Xác nhận PIN mới không khớp.";
            return;
        }


        try {

            const adminReference = doc(
                db,
                "admin",
                adminDocumentId
            );
            const adminSnapshot =
                await getDoc(adminReference);


            if (
                !adminSnapshot.exists() ||
                adminSnapshot.data().pin !== currentPin
            ) {
                error.textContent = "PIN hiện tại không đúng.";
                return;
            }


            await updateDoc(
                adminReference,
                { pin: newPin }
            );

            closeModal(changeAdminPinModal);
            showToast("Đổi PIN Admin thành công");

        } catch (changePinError) {

            console.error(
                "Không thể đổi PIN Admin:",
                changePinError
            );
            error.textContent = "Không thể đổi PIN lúc này.";

        }

    }
);


/* =====================================================
   EXECUTE ADMIN ACTION
===================================================== */

async function executeAdminAction() {

    switch (pendingAction) {

        case "register":

            await finishRegister();

            break;


        case "edit":

            await finishEdit();

            break;


        case "renew":

            await finishRenew();

            break;


        case "pin":

            await finishUpdatePin();

            break;


        case "delete":

            await finishDelete();

            break;


        case "deleteHistory":

            await finishDeleteHistory();

            break;


        default:

            break;

    }


    pendingAction =
        null;

}


/* =====================================================
   REGISTER - OPEN
===================================================== */

document.getElementById(
    "openRegisterBtn"
)?.addEventListener(
    "click",
    openRegisterModal
);


function openRegisterModal() {

    const cabinetSelect =
        document.getElementById(
            "cabinetSelect"
        );

    if (!cabinetSelect) {
        return;
    }

    const cabinet =
        cabinetSelect.value;

    if (isCabinetRegistered(cabinet)) {

        showToast(
            `Cabinet ${cabinet} đã có người đăng ký`,
            "error"
        );

        syncCabinetAvailability();

        return;

    }

    document.getElementById(
        "modalCabinet"
    ).textContent =
        cabinet;


    document.getElementById(
        "modalUID"
    ).textContent =
        generateUID();


    document.getElementById(
        "ownerInput"
    ).value = "";

document.getElementById(
        "mssvInput"
    ).value = "";

    document.getElementById(
        "phoneInput"
    ).value = "";

    document.getElementById(
        "userPinInput"
    ).value = "";


    openModal(
        registerModal
    );

}


/* =====================================================
   REGISTER - SAVE
===================================================== */

document.getElementById(
    "registerSaveBtn"
)?.addEventListener(
    "click",
    function () {

        const owner =
            document.getElementById(
                "ownerInput"
            ).value.trim();
        const mssv =
            document.getElementById(
                "mssvInput"
            ).value.trim();

        const phone =
            document.getElementById(
                "phoneInput"
            ).value.trim();

        const userPin =
            document.getElementById(
                "userPinInput"
            ).value.trim();

        const cabinet =
            document.getElementById(
                "cabinetSelect"
            )?.value;


        if (cabinet && isCabinetRegistered(cabinet)) {

            showToast(
                `Cabinet ${cabinet} đã có người đăng ký`,
                "error"
            );

            syncCabinetAvailability();

            return;

        }


        if (!owner) {

            alert(
                "Vui lòng nhập Owner."
            );

            return;

        }
        if (!mssv) {

            alert(
                "Vui lòng nhập MSSV."
            );

            return;

        }

        if (!phone) {

            alert(
                "Vui lòng nhập Phone."
            );

            return;

        }

        if (!/^\d{4,10}$/.test(userPin)) {

            alert(
                "PIN người dùng phải gồm 4-10 chữ số."
            );

            return;

        }


        closeModal(
            registerModal
        );


        /*
            Đăng ký cần xác nhận Admin.
        */

        requireAdmin(
            "register"
        );

    }
);


/* =====================================================
   REGISTER - FINISH
===================================================== */

async function finishRegister() {

    const cabinet =
        document.getElementById(
            "modalCabinet"
        ).textContent;


    const owner =
        document.getElementById(
            "ownerInput"
        ).value.trim();
    const mssv =
        document.getElementById(
            "mssvInput"
        ).value.trim();

    const phone =
        document.getElementById(
            "phoneInput"
        ).value.trim();

    const userPin =
        document.getElementById(
            "userPinInput"
        ).value.trim();


    const uid =
        document.getElementById(
            "modalUID"
        ).textContent;


    const now =
        new Date();


    const expiration =
        new Date(now);


    expiration.setMonth(
        expiration.getMonth() + 1
    );


    const card = {

        id:
            Date.now(),

        cabinet,

        owner,
        mssv,
        phone,

        uid,

        pin:
            userPin,

        signupDate:
            formatDate(now),

        expirationDate:
            formatDate(expiration),

        personalData:
            generatePersonalData()

    };


    try {

        const firestoreData = {
            cabinet,
            owner,
            expirationDate: card.expirationDate,
            mssv,
            personalData: card.personalData,
            phone,
            pin: card.pin,
            signupDate: card.signupDate
        };

        await setDoc(
            doc(
                db,
                "registeredCabinets",
                uid
            ),
            firestoreData
        );

        card.firestoreId = uid;
        registeredCards.push(card);

    } catch (error) {

        showFirestoreError("Đăng ký", error);
        return;

    }


    addHistory(
        cabinet,
        "REGISTER",
        "SUCCESS",
        "ADMIN",
        ""
    );

    syncCabinetAvailability();

    renderCards();

    renderHistory();


    showToast(
        "Đăng ký Cabinet thành công"
    );

}


/* =====================================================
   RENDER CARDS
===================================================== */

function renderCards() {

    const tbody =
        document.getElementById(
            "registeredTableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (
        registeredCards.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    class="empty"
                >
                    Không có thẻ nào trong hệ thống.
                </td>

            </tr>

        `;


        return;

    }


    registeredCards.forEach(
        (card, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        card.cabinet
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        card.mssv
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        card.owner
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        card.phone
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        card.uid
                    )}
                </td>

                <td>
                    ••••
                </td>

                <td>
                    ${card.signupDate}
                </td>

                <td>
                    ${card.expirationDate}
                </td>

                <td>
                    ${escapeHTML(
                        card.personalData
                    )}
                </td>

                <td>

                    <button
                        class="table-btn edit-btn"
                        data-action="edit"
                        data-index="${index}"
                    >
                        Edit
                    </button>


                    <button
                        class="table-btn renew-btn"
                        data-action="renew"
                        data-index="${index}"
                    >
                        Gia hạn
                    </button>


                    <button
                        class="table-btn pin-btn"
                        data-action="pin"
                        data-index="${index}"
                    >
                        PIN
                    </button>

                </td>


                <td>

                    <button
                        class="table-btn delete-table-btn"
                        data-action="delete"
                        data-index="${index}"
                    >
                        Delete
                    </button>

                </td>

            `;


            tbody.appendChild(
                row
            );

        }
    );

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


document.getElementById(
    "registeredTableBody"
)?.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const index =
            Number(button.dataset.index);

        switch (button.dataset.action) {

            case "edit":
                editCard(index);
                break;

            case "renew":
                renewCard(index);
                break;

            case "pin":
                updatePin(index);
                break;

            case "delete":
                deleteCard(index);
                break;

            default:
                break;

        }

    }
);


/* =====================================================
   EDIT
===================================================== */

function editCard(index) {

    const card =
        registeredCards[index];


    if (!card) {
        return;
    }


    selectedCardIndex =
        index;


    document.getElementById(
        "editOwner"
    ).value =
        card.owner;

document.getElementById(
        "editmssv"
    ).value =
        card.mssv;
    document.getElementById(
        "editPhone"
    ).value =
        card.phone;


    document.getElementById(
        "editPersonalData"
    ).value =
        card.personalData;


    openModal(
        editModal
    );

}


/* =====================================================
   EDIT - SAVE
===================================================== */

document.getElementById(
    "saveEditBtn"
)?.addEventListener(
    "click",
    function () {

        const owner =
            document.getElementById(
                "editOwner"
            ).value.trim();
        const mssv =
            document.getElementById(
                "editmssv"
            ).value.trim();    

        const phone =
            document.getElementById(
                "editPhone"
            ).value.trim();


        if (!owner || !mssv || !phone) {

            alert(
                "Owner,mssv và Phone không được để trống."
            );

            return;

        }


        closeModal(
            editModal
        );


        requireAdmin(
            "edit",
            selectedCardIndex
        );

    }
);


/* =====================================================
   EDIT - FINISH
===================================================== */

async function finishEdit() {

    const card =
        registeredCards[
            selectedCardIndex
        ];


    if (!card) {
        return;
    }


    const owner =
        document.getElementById(
            "editOwner"
        ).value.trim();
    const mssv =
        document.getElementById(
            "editmssv"
        ).value.trim();
    const phone =
        document.getElementById(
            "editPhone"
        ).value.trim();

    const personalData =
        document.getElementById(
            "editPersonalData"
        ).value.trim();

    try {

        await updateDoc(
            doc(db, "registeredCabinets", card.firestoreId),
            {
                owner,
                mssv,
                phone,
                personalData
            }
        );

    } catch (error) {

        showFirestoreError("Cập nhật thông tin", error);
        return;

    }

    card.owner = owner;
    card.mssv = mssv;
    card.phone = phone;
    card.personalData = personalData;


    addHistory(
        card.cabinet,
        "EDIT",
        "SUCCESS",
        "ADMIN",
        `Chỉnh sửa ${card.owner}`
    );


    renderCards();

    renderHistory();


    showToast(
        "Đã cập nhật thông tin"
    );

}


/* =====================================================
   RENEW
===================================================== */

function renewCard(index) {

    const card =
        registeredCards[index];


    if (!card) {
        return;
    }


    selectedCardIndex =
        index;


    document.getElementById(
        "renewMonth"
    ).value =
        "1";


    openModal(
        renewModal
    );

}


/* =====================================================
   RENEW - CONFIRM
===================================================== */

document.getElementById(
    "renewConfirmBtn"
)?.addEventListener(
    "click",
    function () {

        closeModal(
            renewModal
        );


        requireAdmin(
            "renew",
            selectedCardIndex
        );

    }
);


/* =====================================================
   RENEW - FINISH
===================================================== */

async function finishRenew() {

    const card =
        registeredCards[
            selectedCardIndex
        ];


    if (!card) {
        return;
    }


    const months =
        Number(
            document.getElementById(
                "renewMonth"
            ).value
        );


    const parts =
        card.expirationDate.split(
            "/"
        );


    const expiration =
        new Date(
            Number(parts[2]),
            Number(parts[1]) - 1,
            Number(parts[0])
        );


    expiration.setMonth(
        expiration.getMonth() + months
    );


    const expirationDate =
        formatDate(
            expiration
        );

    try {

        await updateDoc(
            doc(db, "registeredCabinets", card.firestoreId),
            { expirationDate }
        );

    } catch (error) {

        showFirestoreError("Gia hạn", error);
        return;

    }

    card.expirationDate = expirationDate;


    addHistory(
        card.cabinet,
        "RENEW",
        "SUCCESS",
        "ADMIN",
        `Gia hạn ${months} tháng`
    );


    renderCards();

    renderHistory();


    showToast(
        `Đã gia hạn ${months} tháng`
    );

}


/* =====================================================
   UPDATE PIN
===================================================== */

function updatePin(index) {

    const card =
        registeredCards[index];


    if (!card) {
        return;
    }


    selectedCardIndex =
        index;


    document.getElementById(
        "newPinInput"
    ).value = "";


    document.getElementById(
        "confirmNewPinInput"
    ).value = "";


    document.getElementById(
        "newPinError"
    ).classList.remove(
        "show"
    );


    openModal(
        updatePinModal
    );

}


/* =====================================================
   UPDATE PIN - CHECK
===================================================== */

document.getElementById(
    "updatePinBtn"
)?.addEventListener(
    "click",
    function () {

        const newPin =
            document.getElementById(
                "newPinInput"
            ).value.trim();


        const confirmPin =
            document.getElementById(
                "confirmNewPinInput"
            ).value.trim();


        const error =
            document.getElementById(
                "newPinError"
            );


        if (
            !/^\d{4,10}$/.test(
                newPin
            )
        ) {

            error.textContent =
                "PIN phải gồm 4-10 chữ số.";


            error.classList.add(
                "show"
            );


            return;

        }


        if (
            newPin !== confirmPin
        ) {

            error.textContent =
                "PIN xác nhận không giống nhau.";


            error.classList.add(
                "show"
            );


            return;

        }


        error.classList.remove(
            "show"
        );


        closeModal(
            updatePinModal
        );


        requireAdmin(
            "pin",
            selectedCardIndex
        );

    }
);


/* =====================================================
   UPDATE PIN - FINISH
===================================================== */

async function finishUpdatePin() {

    const card =
        registeredCards[
            selectedCardIndex
        ];


    if (!card) {
        return;
    }


    const pin =
        document.getElementById(
            "newPinInput"
        ).value.trim();

    try {

        await updateDoc(
            doc(db, "registeredCabinets", card.firestoreId),
            { pin }
        );

    } catch (error) {

        showFirestoreError("Đổi PIN", error);
        return;

    }

    card.pin = pin;


    addHistory(
        card.cabinet,
        "UPDATE PIN",
        "SUCCESS",
        "ADMIN",
        "Thay đổi PIN Cabinet"
    );


    renderCards();

    renderHistory();


    showToast(
        "Cập nhật PIN thành công"
    );

}


/* =====================================================
   DELETE
===================================================== */

function deleteCard(index) {

    const card =
        registeredCards[index];


    if (!card) {
        return;
    }


    selectedCardIndex =
        index;


    document.getElementById(
        "deleteCabinetName"
    ).textContent =
        `${card.cabinet} - ${card.owner}`;


    openModal(
        deleteModal
    );

}


/* =====================================================
   DELETE - CONFIRM
===================================================== */

document.getElementById(
    "confirmDeleteBtn"
)?.addEventListener(
    "click",
    function () {

        closeModal(
            deleteModal
        );


        requireAdmin(
            "delete",
            selectedCardIndex
        );

    }
);


/* =====================================================
   DELETE - FINISH
===================================================== */

async function finishDelete() {

    const card =
        registeredCards[
            selectedCardIndex
        ];


    if (!card) {
        return;
    }


    try {

        await deleteDoc(
            doc(db, "registeredCabinets", card.firestoreId)
        );

    } catch (error) {

        showFirestoreError("Xóa đăng ký", error);
        return;

    }

    addHistory(
        card.cabinet,
        "DELETE",
        "SUCCESS",
        "ADMIN",
        `Xóa ${card.owner}`
    );


    registeredCards.splice(
        selectedCardIndex,
        1
    );

    syncCabinetAvailability();

    renderCards();

    renderHistory();


    showToast(
        "Đã xóa đăng ký Cabinet"
    );

}


/* =====================================================
   CABINET SWITCH 1
   KHÔNG CẦN ADMIN PIN
===================================================== */

function isCabinetCommand(command) {

    return [
        "OPEN1",
        "OPEN2",
        "CLOSE1",
        "CLOSE2"
    ].includes(command);

}


function publishCabinetCommand(command) {

    if (!mqttClient || !mqttClient.connected) {
        console.warn("HiveMQ chưa kết nối, không gửi được", command);
        return;
    }


    recentlyPublishedCommands.push({
        command,
        expiresAt: Date.now() + 10000
    });


    mqttClient.publish(
        MQTT_CONFIG.topic,
        command,
        { qos: 0 },
        error => {

            if (error) {
                console.error("Không thể gửi lệnh MQTT:", error);
            }

        }
    );

}


function updateCabinetState(cabinetNumber, isOpen) {

    const switchElement =
        document.getElementById(`switch${cabinetNumber}`);

    const statusText =
        document.getElementById(`statusText${cabinetNumber}`);

    const statusDot =
        document.getElementById(`statusDot${cabinetNumber}`);

    const cabinetImage =
        document.getElementById(`cabinetImage${cabinetNumber}`);


    if (
        !switchElement ||
        !statusText ||
        !statusDot ||
        !cabinetImage
    ) {
        return;
    }


    switchElement.checked = isOpen;
    statusText.textContent = isOpen ? "OPEN" : "CLOSED";
    statusDot.classList.toggle("open", isOpen);
    cabinetImage.classList.toggle("open", isOpen);

}


function handleMqttMessage(message) {

    const command =
        message.toString().trim().toUpperCase();


    if (!isCabinetCommand(command)) {
        return;
    }


    const now = Date.now();
    const echoedCommand = recentlyPublishedCommands.find(
        item =>
            item.command === command &&
            item.expiresAt > now
    );


    recentlyPublishedCommands.splice(
        0,
        recentlyPublishedCommands.length,
        ...recentlyPublishedCommands.filter(
            item => item.expiresAt > now
        )
    );


    const echoIndex = recentlyPublishedCommands.indexOf(
        echoedCommand
    );


    if (echoIndex !== -1) {
        recentlyPublishedCommands.splice(echoIndex, 1);
        return;
    }


    const cabinetNumber = Number(command.at(-1));
    const isOpen = command.startsWith("OPEN");


    updateCabinetState(cabinetNumber, isOpen);


    addHistory(
        `Cabinet ${cabinetNumber}`,
        isOpen ? "OPEN" : "CLOSE",
        "SUCCESS",
        "USER",
        "MQTT HiveMQ"
    );


    renderHistory();
    showToast(
        `Cabinet ${cabinetNumber} đã ${isOpen ? "mở" : "đóng"} từ HiveMQ`
    );

}


function connectToHiveMQ() {

    if (!window.mqtt) {
        console.error("Không tìm thấy thư viện MQTT");
        return;
    }


    mqttClient = window.mqtt.connect(
        `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`,
        {
            clientId: `smart-cabinet-${Date.now()}`,
            username: MQTT_CONFIG.username,
            password: MQTT_CONFIG.password,
            reconnectPeriod: 5000,
            clean: true
        }
    );


    mqttClient.on("connect", () => {

        mqttClient.subscribe(
            MQTT_CONFIG.topic,
            error => {

                if (error) {
                    console.error("Không thể subscribe HiveMQ:", error);
                    return;
                }

                console.log("Đã kết nối HiveMQ:", MQTT_CONFIG.topic);

            }
        );

    });


    mqttClient.on("message", (_topic, message) => {
        handleMqttMessage(message);
    });


    mqttClient.on("error", error => {
        console.error("Lỗi HiveMQ:", error);
    });

}

document.getElementById(
    "switch1"
)?.addEventListener(
    "change",
    function () {

        selectedCabinet = 1;

        finishToggle();

    }
);


/* =====================================================
   CABINET SWITCH 2
   KHÔNG CẦN ADMIN PIN
===================================================== */

document.getElementById(
    "switch2"
)?.addEventListener(
    "change",
    function () {

        selectedCabinet = 2;

        finishToggle();

    }
);


/* =====================================================
   CABINET TOGGLE
===================================================== */

function finishToggle() {

    const switchElement = document.getElementById(
        `switch${selectedCabinet}`
    );


    if (!switchElement) {
        return;
    }


    const isOpen = switchElement.checked;
    const action = isOpen ? "OPEN" : "CLOSE";
    const command = `${action}${selectedCabinet}`;


    updateCabinetState(selectedCabinet, isOpen);
    publishCabinetCommand(command);


    addHistory(
        `Cabinet ${selectedCabinet}`,
        action,
        "SUCCESS",
        "ADMIN",
        "Web -> HiveMQ"
    );


    showToast(
        `Cabinet ${selectedCabinet} đã ${isOpen ? "mở" : "đóng"}`
    );


    renderHistory();

}


/* =====================================================
   ADD HISTORY
===================================================== */

function addHistory(
    cabinet,
    action,
    result,
    source,
    detail
) {

    const now =
        new Date();


    const historyItem = {

        id:
            Date.now(),

        createdAt:
            now.toISOString(),

        time:
            formatTime(now),

        date:
            getTodayInputDate(),

        cabinet,

        action,

        result,

        source,

        detail

    };


    const historyReference =
        doc(historyCollection);


    historyItem.firestoreId =
        historyReference.id;


    historyData.unshift(historyItem);


    setDoc(
        historyReference,
        historyItem
    ).catch(
        error => {
            console.error("Không thể lưu lịch sử:", error);
        }
    );

}


async function loadHistory() {

    try {

        const snapshot =
            await getDocs(historyCollection);


        historyData = snapshot.docs
            .map(
                documentSnapshot => ({
                    firestoreId: documentSnapshot.id,
                    ...documentSnapshot.data()
                })
            )
            .sort(
                (firstItem, secondItem) =>
                    new Date(secondItem.createdAt || 0) -
                    new Date(firstItem.createdAt || 0)
            );


        renderHistory();

    } catch (error) {

        console.error("Không thể tải lịch sử:", error);
        showToast(
            "Không thể tải lịch sử từ Firestore",
            "error"
        );

    }

}


async function finishDeleteHistory() {

    if (!selectedHistoryId) {
        return;
    }


    try {

        await deleteDoc(
            doc(db, "history", selectedHistoryId)
        );

        historyData = historyData.filter(
            item => item.firestoreId !== selectedHistoryId
        );

        renderHistory();
        showToast("Đã xóa lịch sử");

    } catch (error) {

        console.error("Không thể xóa lịch sử:", error);
        showToast("Xóa lịch sử thất bại", "error");

    } finally {

        selectedHistoryId = null;

    }

}


/* =====================================================
   RENDER HISTORY
===================================================== */

function renderHistory() {

    const tbody =
        document.getElementById(
            "historyTableBody"
        );


    if (!tbody) {
        return;
    }


    const cabinetFilter =
        document.getElementById(
            "historyCabinet"
        )?.value ||
        "all";


    const dateFilter =
        document.getElementById(
            "historyDate"
        )?.value ||
        getTodayInputDate();


    const filtered =
        historyData.filter(
            item => {

                const cabinetMatch =
                    cabinetFilter === "all"
                    ||
                    item.cabinet ===
                        cabinetFilter;


                const dateMatch =
                    item.date ===
                    dateFilter;


                return (
                    cabinetMatch &&
                    dateMatch
                );

            }
        );


    tbody.innerHTML = "";


    if (
        filtered.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty"
                >
                    Không có hoạt động nào
                </td>

            </tr>

        `;


        document.getElementById(
            "historyDescription"
        ).textContent =
            `Không có hoạt động trong ngày ${formatDateFromInput(dateFilter)}.`;


        return;

    }


    document.getElementById(
        "historyDescription"
    ).textContent =
        `${filtered.length} hoạt động trong ngày ${formatDateFromInput(dateFilter)}.`;


    filtered.forEach(
        item => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        item.time
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.cabinet
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.action
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.result
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.source
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.detail
                    )}
                </td>

                <td>
                    <button
                        class="table-btn delete-table-btn"
                        data-history-action="delete"
                        data-history-id="${escapeHTML(
                            item.firestoreId || ""
                        )}"
                    >
                        Xóa
                    </button>
                </td>

            `;


            tbody.appendChild(
                row
            );

        }
    );

}


/* =====================================================
   HISTORY BUTTON
===================================================== */

document.getElementById(
    "historyButton"
)?.addEventListener(
    "click",
    renderHistory
);


document.getElementById(
    "historyTableBody"
)?.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("button[data-history-action]");


        if (!button) {
            return;
        }


        selectedHistoryId =
            button.dataset.historyId;

        requireAdmin("deleteHistory");

    }
);


/* =====================================================
   LOAD REGISTERED CABINETS
===================================================== */

async function loadRegisteredCabinets() {

    try {

        const snapshot =
            await getDocs(
                registeredCabinetsCollection
            );

        registeredCards = snapshot.docs.map(
            documentSnapshot => ({
                firestoreId: documentSnapshot.id,
                ...documentSnapshot.data()
            })
        );

        syncCabinetAvailability();
        renderCards();

    } catch (error) {

        showFirestoreError("Đọc danh sách Cabinet", error);

    }

}


loadRegisteredCabinets();


/* =====================================================
   LOGOUT
===================================================== */

document.getElementById(
    "logoutBtn"
)?.addEventListener(
    "click",
    function () {

        const confirmed =
            confirm(
                "Bạn có muốn đăng xuất không?"
            );


        if (!confirmed) {
            return;
        }


        localStorage.removeItem(
            "adminLoggedIn"
        );


        sessionStorage.removeItem(
            "adminLoggedIn"
        );


        localStorage.removeItem(
            "adminEmail"
        );

        localStorage.removeItem(
            "adminDocumentId"
        );


        window.location.replace(
            "login.html"
        );

    }
);


/* =====================================================
   ESC
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeAllModals();

        }

    }
);


/* =====================================================
   INITIAL
===================================================== */

renderCards();

renderHistory();

loadHistory();

connectToHiveMQ();