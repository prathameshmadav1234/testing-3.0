// Background Firebase Logging Script (can be used as a module or script)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLAKW51iGzR68EL-ZPWxraFz-NTdNJPqM",
  authDomain: "esp32ledcontrol-c0d28.firebaseapp.com",
  databaseURL: "https://esp32ledcontrol-c0d28-default-rtdb.firebaseio.com",
  projectId: "esp32ledcontrol-c0d28",
  storageBucket: "esp32ledcontrol-c0d28.appspot.com",
  messagingSenderId: "616534198261",
  appId: "1:616534198261:web:5c6848fdec9d01c9c6c2bc"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const firebaseUrl = "https://esp32ledcontrol-c0d28-default-rtdb.firebaseio.com/led.json";

let currentUser = null;
let updateTimer = null;
let lastEntry = null;
const storedLogsKey = 'pendingLogs';

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    // Upload any stored logs on login
    await uploadStoredLogs();
    startUpdater();
  } else {
    // Continue updater even when logged out
    startUpdater();
  }
});

async function fetchData() {
  const today = new Date().toISOString().split("T")[0];
  try {
    const res = await fetch(firebaseUrl + "?t=" + Date.now());
    const data = await res.json();
    const now = new Date();
    const time = now.toLocaleTimeString();
    const ledState = data.real_state === 1 ? "ON" : "OFF";
    const brightness = data.brightness_percent ?? "N/A";
    const potValue = data.pot_value ?? "N/A";
    const entry = { time, ledState, brightness, potValue, timestamp: now.getTime() };

    // Check for duplicates to avoid multiple pushes from different devices
    if (!lastEntry || JSON.stringify(lastEntry) !== JSON.stringify(entry)) {
      if (getAuth().currentUser) {
        // Push to Firebase under /logs/{userUID}/{date}
        const logsRef = ref(database, `logs/${getAuth().currentUser.uid}/${today}`);
        await push(logsRef, entry);
        console.log("Logged data to Firebase:", entry);
      } else {
        // Store in localStorage
        storeLogLocally(entry, today);
        console.log("Stored log locally:", entry);
      }
      lastEntry = entry;
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

function startUpdater() {
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(fetchData, 10000);
}

function stopUpdater() {
  if (updateTimer) clearInterval(updateTimer);
}

function storeLogLocally(entry, date) {
  const stored = JSON.parse(localStorage.getItem(storedLogsKey) || '{}');
  if (!stored[date]) stored[date] = [];
  stored[date].push(entry);
  localStorage.setItem(storedLogsKey, JSON.stringify(stored));
}

async function uploadStoredLogs() {
  const stored = JSON.parse(localStorage.getItem(storedLogsKey) || '{}');
  const user = getAuth().currentUser;
  if (!user || Object.keys(stored).length === 0) return;

  for (const date in stored) {
    const logsRef = ref(database, `logs/${user.uid}/${date}`);
    for (const entry of stored[date]) {
      await push(logsRef, entry);
    }
  }
  localStorage.removeItem(storedLogsKey);
  console.log("Uploaded stored logs to Firebase");
}

// Export stopUpdater for external use
export { stopUpdater };

// Initial fetch on load if authenticated
if (currentUser) {
  fetchData();
  startUpdater();
}
