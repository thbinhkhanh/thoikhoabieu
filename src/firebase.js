// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyATL7tikEl0xICXNWRzh66mC2Gi0EP8mbQ",
  authDomain: "thoikhoabieu-50c4d.firebaseapp.com",
  projectId: "thoikhoabieu-50c4d",
  storageBucket: "thoikhoabieu-50c4d.appspot.com", // sửa đúng chuẩn
  messagingSenderId: "824189706648",
  appId: "1:824189706648:web:3069c374b66144195d4bed"
};

// Khởi tạo app Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestore & Auth
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
