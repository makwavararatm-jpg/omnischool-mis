// 1. Import Firebase Core and Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    addDoc, 
    serverTimestamp,
    getDocs // NEW: We need this to fetch the students!
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. YOUR FIREBASE CONFIG (Paste your exact keys here)
const firebaseConfig = {
  apiKey: "AIzaSyBNdOOPdiHtp0uBg_0p2ag1PyXIf9RC7cg",
  authDomain: "omnischool-mis.firebaseapp.com",
  projectId: "omnischool-mis",
  storageBucket: "omnischool-mis.firebasestorage.app",
  messagingSenderId: "625650816291",
  appId: "1:625650816291:web:7e35bdec6326224c82a896"
};

// 3. Initialize App & Offline Vault
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache()
});

console.log("OmniSchool engine active. Offline vault ready.");

// 4. Network Status UI Monitor
const statusText = document.getElementById('network-status');
window.addEventListener('online', () => statusText.innerText = 'Status: 🟢 Online (Syncing)');
window.addEventListener('offline', () => statusText.innerText = 'Status: 🔴 Offline (Saving to Vault)');

// 5. Function to Save Attendance
async function markAttendance(studentName, status, cardElement) {
    try {
        await addDoc(collection(db, "attendance"), {
            student: studentName,
            status: status,
            class: "Form 4A",
            school_id: "demo-school-01",
            timestamp: serverTimestamp()
        });
        
        // Visual feedback: dim the card once marked
        cardElement.style.opacity = "0.5";
        cardElement.style.pointerEvents = "none";
        
    } catch (e) {
        console.error("Error writing to vault: ", e);
    }
}

// 6. Dynamic Student Roster (FETCHED FROM DATABASE)
const studentListContainer = document.getElementById('student-list');

async function loadClassList() {
    studentListContainer.innerHTML = '<p>Loading roster from vault...</p>'; 
    
    try {
        // This line asks the database for every record in the "students" collection
        const querySnapshot = await getDocs(collection(db, "students"));
        studentListContainer.innerHTML = ''; // Clear the loading text
        
        if (querySnapshot.empty) {
            studentListContainer.innerHTML = '<p>No students found. Add them in the Admin portal.</p>';
            return;
        }

        // Loop through the database records and build the UI
        querySnapshot.forEach((doc) => {
            const student = doc.data(); // This unpacks the data you saved in admin.html
            
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <span>${student.name}</span>
                <div>
                    <button class="btn btn-present">Present</button>
                    <button class="btn btn-absent">Absent</button>
                </div>
            `;
            
            const presentBtn = card.querySelector('.btn-present');
            const absentBtn = card.querySelector('.btn-absent');
            
            presentBtn.addEventListener('click', () => markAttendance(student.name, "Present", card));
            absentBtn.addEventListener('click', () => markAttendance(student.name, "Absent", card));
            
            studentListContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error("Error fetching students: ", error);
        studentListContainer.innerHTML = '<p>Error loading roster.</p>';
    }
}

// Boot up the UI
loadClassList();