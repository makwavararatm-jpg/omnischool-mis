import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    query, 
    where, 
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 🔴 PASTE YOUR FIREBASE CONFIG HERE
// 2. YOUR FIREBASE CONFIG (Paste your exact keys here)
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

// Get Registration ID from the Gateway URL
const urlParams = new URLSearchParams(window.location.search);
const regId = urlParams.get('regId');

// System Boot
async function initializePortal() {
    if (!regId) {
        document.getElementById('loading-overlay').innerHTML = `<h2 style="color:#e74c3c;">Access Denied</h2><p>No registration identity found. Please login via the gateway.</p><button onclick="window.location.href='index.html'" style="padding:10px 20px; margin-top:20px; cursor:pointer;">Return to Gateway</button>`;
        return;
    }

    try {
        // 1. Authenticate Student (Query by name/ID for demo purposes)
        // Since you likely used 'name' in earlier builds, we will query students where name or id matches the regId input to ensure your demo works seamlessly.
        const studentsRef = collection(db, "students");
        // For the MVP, if they type the exact name or ID, we let them in.
        const qStudent = query(studentsRef, where("name", "==", regId)); 
        const studentSnap = await getDocs(qStudent);
        
        let studentData = null;
        let studentDocId = null;

        if (studentSnap.empty) {
            // Fallback: Check if they used the document ID instead of name
            const allStudents = await getDocs(studentsRef);
            allStudents.forEach(doc => {
                if (doc.id === regId || doc.data().system_id === regId) {
                    studentData = doc.data();
                    studentDocId = doc.id;
                }
            });
            
            if(!studentData) {
                document.getElementById('loading-overlay').innerHTML = `<h2 style="color:#e74c3c;">Identity Not Found</h2><p>Registration Number '${regId}' does not exist in the vault.</p><button onclick="window.location.href='index.html'" style="padding:10px 20px; margin-top:20px; cursor:pointer;">Return to Gateway</button>`;
                return;
            }
        } else {
            studentData = studentSnap.docs[0].data();
            studentDocId = studentSnap.docs[0].id;
        }

        // 2. Populate Sidebar Profile
        document.getElementById('sb-name').innerText = studentData.name;
        document.getElementById('sb-reg').innerText = `Reg: ${regId}`;
        document.getElementById('stat-class').innerText = studentData.class;
        
        // Remove Overlay
        setTimeout(() => { document.getElementById('loading-overlay').style.display = 'none'; }, 500);

        // 3. Fetch Class Fee
        let termFee = 0;
        const classesSnap = await getDocs(query(collection(db, "classes"), where("name", "==", studentData.class)));
        if (!classesSnap.empty) termFee = classesSnap.docs[0].data().term_fee || 0;

        // 4. Fetch Finance History
        let totalPaid = 0;
        const finTable = document.getElementById('finance-table-body');
        finTable.innerHTML = '';
        const qFinance = query(collection(db, "transactions"), where("student", "==", studentData.name));
        const finSnap = await getDocs(qFinance);
        
        if (finSnap.empty) finTable.innerHTML = `<tr><td colspan="4" class="empty-state">No payments recorded.</td></tr>`;
        else {
            finSnap.forEach(doc => {
                const tx = doc.data();
                if(tx.type === 'income') totalPaid += tx.amount;
                const dateStr = tx.timestamp ? tx.timestamp.toDate().toLocaleDateString() : 'Recent';
                const row = document.createElement('tr');
                row.innerHTML = `<td>${dateStr}</td><td style="font-family:monospace; color:#7f8c8d;">#${doc.id.substring(0,8).toUpperCase()}</td><td style="color:#10b981; font-weight:bold;">$${tx.amount.toFixed(2)}</td><td>Cash/Transfer</td>`;
                finTable.appendChild(row);
            });
        }
        
        // Update Dashboard Balance
        const balance = termFee - totalPaid;
        const balEl = document.getElementById('stat-balance');
        if (balance <= 0) { balEl.innerText = "$0.00"; balEl.className = "stat-value green"; }
        else { balEl.innerText = `$${balance.toFixed(2)}`; }

        // 5. Fetch Attendance
        let daysAbsent = 0;
        let daysPresent = 0;
        const qAttendance = query(collection(db, "attendance"), where("student_name", "==", studentData.name));
        const attSnap = await getDocs(qAttendance);
        
        attSnap.forEach(doc => {
            if (doc.data().status === 'Absent') daysAbsent++;
            else daysPresent++;
        });
        
        document.getElementById('stat-present').innerText = daysPresent;
        document.getElementById('stat-absent').innerText = daysAbsent;
        
        const remarks = document.getElementById('attendance-remarks');
        if (daysAbsent === 0 && daysPresent > 0) remarks.innerText = "Perfect Attendance! 🌟";
        else if (daysAbsent > 3) { remarks.innerText = "Warning: High absence rate."; remarks.style.color = "#e74c3c"; }
        else if (daysPresent === 0 && daysAbsent === 0) remarks.innerText = "No register data logged yet.";
        else remarks.innerText = "Standard attendance rate.";

        // 6. Fetch Grades
        const gradesTable = document.getElementById('grades-table-body');
        gradesTable.innerHTML = '';
        const qGrades = query(collection(db, "grades"), where("student_id", "==", studentDocId));
        const gradesSnap = await getDocs(qGrades);

        if (gradesSnap.empty) {
            gradesTable.innerHTML = `<tr><td colspan="3" class="empty-state">No grades uploaded for this term.</td></tr>`;
        } else {
            gradesSnap.forEach(docSnap => {
                const mark = docSnap.data().term_mark;
                let grade = { letter: 'D', color: '#e74c3c', bg: '#fdedec' };
                if (mark >= 80) grade = { letter: 'A', color: '#10b981', bg: '#e8f8f5' };
                else if (mark >= 70) grade = { letter: 'B', color: '#3498db', bg: '#eaf2f8' };
                else if (mark >= 60) grade = { letter: 'C', color: '#f39c12', bg: '#fef5e7' };

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${docSnap.data().subject}</strong></td>
                    <td style="text-align: center; color: #7f8c8d; font-weight: bold;">${mark}%</td>
                    <td style="text-align: center;"><span style="background:${grade.bg}; color:${grade.color}; padding:4px 10px; border-radius:4px; font-weight:bold;">${grade.letter}</span></td>
                `;
                gradesTable.appendChild(row);
            });
        }

        // 7. Fetch Announcements & Build School Calendar
        const eventsSnap = await getDocs(collection(db, "events"));
        const annList = document.getElementById('student-announcements-list');
        const calList = document.getElementById('student-calendar-list');
        
        let allEvents = [];
        eventsSnap.forEach(doc => allEvents.push(doc.data()));
        
        // Feed 1: Announcements (Sorted by newest post)
        const announcements = [...allEvents].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        annList.innerHTML = '';
        
        if (announcements.length === 0) {
            annList.innerHTML = '<div class="empty-state">No announcements currently.</div>';
        } else {
            announcements.forEach(ev => {
                const postDate = ev.timestamp ? ev.timestamp.toDate().toLocaleDateString() : 'Recent';
                const dateBadge = ev.date ? `<span style="background: #e8f8f5; color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 10px;">📅 ${ev.date}</span>` : '';
                
                annList.innerHTML += `
                    <div class="announcement-box">
                        <span>${ev.author || 'Admin'} • Posted ${postDate}</span>
                        <h4>${ev.title} ${dateBadge}</h4>
                        <p>${ev.description}</p>
                    </div>
                `;
            });
        }

        // Feed 2: School Calendar (Extract only items with dates, sort chronologically)
        const calendarEvents = allEvents.filter(ev => ev.date).sort((a, b) => new Date(a.date) - new Date(b.date));
        calList.innerHTML = '';
        
        if (calendarEvents.length === 0) {
            calList.innerHTML = '<p class="empty-state">No upcoming calendar events.</p>';
        } else {
            let calHTML = '<ul style="color:#2c3e50; line-height: 2.2; margin: 0; padding-left: 20px;">';
            calendarEvents.forEach(ev => {
                calHTML += `<li><strong style="color: #8e44ad;">${ev.date}:</strong> ${ev.title}</li>`;
            });
            calHTML += '</ul>';
            calList.innerHTML = calHTML;
        }

    } catch (error) { 
        console.error("Portal Boot Error: ", error); 
        document.getElementById('loading-overlay').innerHTML = `<h2 style="color:#e74c3c;">Vault Connection Error</h2><p>Please check your local cache or network.</p>`;
    }
}

// Start sequence
initializePortal();