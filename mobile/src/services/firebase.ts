import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your web app configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBoymxE4a_ajWw3is20CpvJPqw8Px8Tw5w",
  authDomain: "courtwatch-a4135.firebaseapp.com",
  projectId: "courtwatch-a4135",
  storageBucket: "courtwatch-a4135.firebasestorage.app",
  messagingSenderId: "542775745789",
  appId: "1:542775745789:web:your-web-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Export Google Sign-In provider
export const googleProvider = new GoogleAuthProvider();

export default app;