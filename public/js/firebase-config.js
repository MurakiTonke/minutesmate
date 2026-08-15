import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  projectId: "minutesmate-app",
  appId: "1:485273839783:web:4d5c0e0e723a679c319382",
  storageBucket: "minutesmate-app.firebasestorage.app",
  apiKey: "AIzaSyCKNOzjuYTXncHr-6l-O3f8hcDm6tOuNzs",
  authDomain: "minutesmate-app.firebaseapp.com",
  messagingSenderId: "485273839783",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
