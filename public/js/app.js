import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAabAYa3Z787Q_nTlMMhghX89ya-JJ8xzQ",
    authDomain: "elesfuerzo-b742d.firebaseapp.com",
    projectId: "elesfuerzo-b742d",
    storageBucket: "elesfuerzo-b742d.appspot.com",   
    messagingSenderId: "29090741191",
    appId: "1:29090741191:web:06cd9d10430d181ade37e2",
    measurementId: "G-151DHE8C9M"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
