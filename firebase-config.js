import {getAuth} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {getFirestore} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const firebaseConfig = {
    apiKey: "AIzaSyBoIyELkRlSUdcIkswBfpG2iSq_fH_LPjw",
    authDomain: "webapp-1b352.firebaseapp.com",
    projectId: "webapp-1b352",
    storageBucket: "webapp-1b352.firebasestorage.app",
    messagingSenderId: "1086406452299",
    appId: "1:1086406452299:web:f41497fe24dd00f28659ce",
    measurementId: "G-JYME509SZ4"
  };

  // Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
export {auth, db};