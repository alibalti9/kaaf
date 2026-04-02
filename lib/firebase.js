// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAbUIxRqeYv35pxg8Ee9nOnwo2fUdjOrB0",
  authDomain: "kebajirestaurantdata.firebaseapp.com",
  projectId: "kebajirestaurantdata",
  storageBucket: "kebajirestaurantdata.appspot.com", // fixed typo
  messagingSenderId: "840036966886",
  appId: "1:840036966886:web:fa80206d8f762d3e7e3627",
  measurementId: "G-N7XX2H3D2N"
};

// Initialize Firebase (prevent duplicate app error)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
let analytics;
// Only initialize analytics in the browser (prevents SSR/Next.js errors)
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
const db = getFirestore(app);

export { app, db };
// Note: Only use analytics in client-side code
