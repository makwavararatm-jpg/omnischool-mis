import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    setDoc,
    addDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// 🟢 NEW: FIREBASE STORAGE IMPORTS
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// 🔴 PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyBNdOOPdiHtp0uBg_0p2ag1PyXIf9RC7cg",
  authDomain: "omnischool-mis.firebaseapp.com",
  projectId: "omnischool-mis",
  storageBucket: "omnischool-mis.firebasestorage.app",
  messagingSenderId: "625650816291",
  appId: "1:625650816291:web:7e35bdec6326224c82a896"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { localCache: persistentLocalCache() });
const storage = getStorage(app); // 🟢 INITIALIZE STORAGE

// --- ATTENDANCE ELEMENTS ---
const attendanceDate = document.getElementById('attendance-date');
const attendanceClass = document.getElementById('attendance-class');
const loadRosterBtn = document.getElementById('load-roster-btn');
const rosterTableBody = document.getElementById('roster-table-body');
const saveBar = document.getElementById('save-bar');
const saveAttendanceBtn = document.getElementById('save-attendance-btn');
const saveFeedback = document.getElementById('save-feedback');

// --- RESOURCE ELEMENTS ---
const resTitle = document.getElementById('res-title');
const resClass = document.getElementById('res-class');
const resSubject = document.getElementById('res-subject');
const resFileInput = document.getElementById('res-file');
const uploadResBtn = document.getElementById('upload-res-btn');
const uploadFeedback = document.getElementById('upload-feedback');
const libraryTableBody = document.getElementById('library-table-body');
const refreshLibBtn = document.getElementById('refresh-lib-btn');

// Network Monitor
const statusText = document.getElementById('network-status');
window.addEventListener('online', () => statusText.innerText = 'Live Sync 🟢');
window.addEventListener('offline', () => statusText.innerText = 'Offline Vault 🔴');

// 1. Load System Data (Classes & Subjects)
async function loadSystemData() {
    try {
        const classesSnap = await getDocs(collection(db, "classes"));
        attendanceClass.innerHTML = '<option value="">-- Select Class --</option>';
        resClass.innerHTML = '<option value="">-- Target Class --</option>';
        classesSnap.forEach(doc => {
            attendanceClass.appendChild(new Option(doc.data().name, doc.data().name));
            resClass.appendChild(new Option(doc.data().name, doc.data().name));
        });

        const subjectsSnap = await getDocs(collection(db, "subjects"));
        resSubject.innerHTML = '<option value="">-- Subject --</option>';
        subjectsSnap.forEach(doc => {
            resSubject.appendChild(new Option(doc.data().name, doc.data().name));
        });

        fetchLibrary(); // Load previously uploaded docs
    } catch (error) { console.error("Error loading system data: ", error); }
}

// 2. RESOURCE UPLOAD LOGIC
uploadResBtn.addEventListener('click', async () => {
    const title = resTitle.value.trim();
    const targetClass = resClass.value;
    const subject = resSubject.value;
    const file = resFileInput.files[0];

    if (!title || !targetClass || !subject || !file) {
        return alert("Please fill all fields and select a file.");
    }

    if (!navigator.onLine) {
        return alert("You must be connected to the internet to upload files to the cloud.");
    }

    try {
        uploadResBtn.innerText = "Uploading to Cloud... Please wait";
        uploadResBtn.disabled = true;
        uploadFeedback.innerText = "";

        // Create a unique file path in the Storage Bucket
        const storagePath = `resources/${targetClass}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);

        // Upload the physical file
        await uploadBytes(storageRef, file);
        
        // Get the secure download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Save the metadata to the Firestore Vault
        await addDoc(collection(db, "resources"), {
            title: title,
            class: targetClass,
            subject: subject,
            file_name: file.name,
            file_url: downloadURL,
            timestamp: serverTimestamp()
        });

        uploadFeedback.innerText = "✅ Material securely uploaded and distributed.";
        uploadFeedback.style.color = "#10b981";
        
        // Reset form
        resTitle.value = "";
        resFileInput.value = "";
        fetchLibrary();

    } catch (error) {
        console.error("Upload Error: ", error);
        uploadFeedback.innerText = "❌ Error uploading file.";
        uploadFeedback.style.color = "#e74c3c";
    } finally {
        uploadResBtn.innerText = "Upload to Cloud";
        uploadResBtn.disabled = false;
        setTimeout(() => uploadFeedback.innerText = "", 5000);
    }
});

// 3. FETCH DIGITAL LIBRARY
async function fetchLibrary() {
    try {
        const resourcesSnap = await getDocs(collection(db, "resources"));
        libraryTableBody.innerHTML = '';

        if (resourcesSnap.empty) {
            libraryTableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No materials uploaded yet.</td></tr>`;
            return;
        }

        // Convert to array so we can sort newest first
        const docs = [];
        resourcesSnap.forEach(doc => docs.push(doc.data()));
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        docs.forEach(data => {
            const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'Just now';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${dateStr}</strong></td>
                <td><span style="background: #f4f7f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${data.class}</span></td>
                <td>${data.title}<br><span style="font-size: 11px; color: #95a5a6;">${data.subject}</span></td>
                <td><a href="${data.file_url}" target="_blank" class="btn-link">View File</a></td>
            `;
            libraryTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Library Fetch Error: ", error);
        libraryTableBody.innerHTML = `<tr><td colspan="4" class="empty-state" style="color:red;">Error loading library.</td></tr>`;
    }
}

refreshLibBtn.addEventListener('click', fetchLibrary);

// ... (KEEP ATTENDANCE LOGIC UNCHANGED BELOW THIS LINE) ...
loadRosterBtn.addEventListener('click', async () => { /* Kept the same */
    const targetClass = attendanceClass.value;
    const targetDate = attendanceDate.value;
    if (!targetClass || !targetDate) return alert("Select a date and class.");
    try {
        loadRosterBtn.innerText = "Loading...";
        const q = query(collection(db, "students"), where("class", "==", targetClass));
        const studentsSnap = await getDocs(q);
        if (studentsSnap.empty) { rosterTableBody.innerHTML = `<tr><td colspan="3" class="empty-state">No students found.</td></tr>`; saveBar.style.display = 'none'; return; }
        rosterTableBody.innerHTML = ''; 
        studentsSnap.forEach((docSnap) => {
            const stu = docSnap.data(); const studentId = docSnap.id; const displaySysId = stu.system_id || studentId.substring(0, 8).toUpperCase();
            const row = document.createElement('tr');
            row.innerHTML = `<td style="color: #7f8c8d; font-family: monospace;">${displaySysId}</td><td><strong>${stu.name}</strong></td><td><div class="attendance-toggle" data-studentid="${studentId}" data-studentname="${stu.name}"><button class="btn-status present selected">Present</button><button class="btn-status absent">Absent</button></div></td>`;
            rosterTableBody.appendChild(row);
        });
        document.querySelectorAll('.attendance-toggle').forEach(toggleGroup => {
            const presentBtn = toggleGroup.querySelector('.present'); const absentBtn = toggleGroup.querySelector('.absent');
            presentBtn.addEventListener('click', () => { presentBtn.classList.add('selected'); absentBtn.classList.remove('selected'); });
            absentBtn.addEventListener('click', () => { absentBtn.classList.add('selected'); presentBtn.classList.remove('selected'); });
        });
        saveBar.style.display = 'flex'; saveFeedback.innerText = "Ready to sync attendance."; saveFeedback.style.color = "#7f8c8d";
    } catch (error) { console.error(error); } finally { loadRosterBtn.innerText = "Load Register"; }
});

saveAttendanceBtn.addEventListener('click', async () => { /* Kept the same */
    const targetClass = attendanceClass.value; const targetDate = attendanceDate.value; const toggleGroups = document.querySelectorAll('.attendance-toggle');
    saveAttendanceBtn.innerText = "Locking..."; saveAttendanceBtn.disabled = true;
    try {
        let saveCount = 0;
        for (const group of toggleGroups) {
            const studentId = group.getAttribute('data-studentid'); const studentName = group.getAttribute('data-studentname');
            const isPresent = group.querySelector('.present').classList.contains('selected'); const status = isPresent ? 'Present' : 'Absent';
            const recordId = `${targetDate}_${studentId}`;
            await setDoc(doc(db, "attendance", recordId), { date: targetDate, class: targetClass, student_id: studentId, student_name: studentName, status: status, timestamp: serverTimestamp() });
            saveCount++;
        }
        saveFeedback.innerText = `✅ Register locked. ${saveCount} records synced.`; saveFeedback.style.color = "#10b981";
    } catch (error) { console.error(error); saveFeedback.innerText = "❌ Network error. Cached locally."; saveFeedback.style.color = "#e74c3c";
    } finally { saveAttendanceBtn.innerText = "Lock Register to Vault"; saveAttendanceBtn.disabled = false; }
});

// ==========================================
// 4. FETCH CAMPUS ANNOUNCEMENTS & CALENDAR
// ==========================================
async function fetchCampusEvents() {
    try {
        const eventsSnap = await getDocs(collection(db, "events"));
        const annList = document.getElementById('teacher-announcements-list');
        const calList = document.getElementById('teacher-calendar-list');
        
        let allEvents = [];
        eventsSnap.forEach(doc => allEvents.push(doc.data()));
        
        // Feed 1: Announcements
        const announcements = [...allEvents].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        annList.innerHTML = '';
        
        if (announcements.length === 0) {
            annList.innerHTML = '<div class="empty-state">No announcements currently.</div>';
        } else {
            announcements.forEach(ev => {
                const postDate = ev.timestamp ? ev.timestamp.toDate().toLocaleDateString() : 'Recent';
                const dateBadge = ev.date ? `<span style="background: #e8f8f5; color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 10px;">📅 ${ev.date}</span>` : '';
                
                annList.innerHTML += `
                    <div style="border-left: 4px solid #3498db; background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 0 8px 8px 0;">
                        <span style="font-size: 11px; color: #bdc3c7; font-weight: bold; text-transform: uppercase;">${ev.author || 'Admin'} • ${postDate}</span>
                        <h4 style="margin: 5px 0; color: #2c3e50;">${ev.title} ${dateBadge}</h4>
                        <p style="margin: 0; font-size: 14px; color: #7f8c8d;">${ev.description}</p>
                    </div>
                `;
            });
        }

        // Feed 2: School Calendar
        const calendarEvents = allEvents.filter(ev => ev.date).sort((a, b) => new Date(a.date) - new Date(b.date));
        calList.innerHTML = '';
        
        if (calendarEvents.length === 0) {
            calList.innerHTML = '<p class="empty-state">No upcoming calendar events.</p>';
        } else {
            let calHTML = '<ul style="color:#2c3e50; line-height: 2.2; margin: 0; padding-left: 20px; font-size: 15px;">';
            calendarEvents.forEach(ev => {
                calHTML += `<li><strong style="color: #3498db;">${ev.date}:</strong> ${ev.title}</li>`;
            });
            calHTML += '</ul>';
            calList.innerHTML = calHTML;
        }
    } catch (error) {
        console.error("Error loading events: ", error);
    }
}

// Ensure it loads when the teacher logs in
fetchCampusEvents();

loadSystemData();