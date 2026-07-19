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
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 🔴 IMPORTANT: PASTE YOUR FIREBASE CONFIG HERE 🔴
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

// --- TAB 1 ELEMENTS (ENTRY) ---
const classSelect = document.getElementById('select-class');
const subjectSelect = document.getElementById('select-subject');
const loadSheetBtn = document.getElementById('load-sheet-btn');
const sheetTitle = document.getElementById('sheet-title');
const tableBody = document.getElementById('grading-table-body');
const saveBar = document.getElementById('save-bar');
const saveGradesBtn = document.getElementById('save-grades-btn');
const saveFeedback = document.getElementById('save-feedback');

// --- TAB 2 ELEMENTS (REPORTS) ---
const reportClassSelect = document.getElementById('report-class');
const reportStudentSelect = document.getElementById('report-student');
const generateReportBtn = document.getElementById('generate-report-btn');
const reportDocument = document.getElementById('report-document');
const docName = document.getElementById('doc-name');
const docId = document.getElementById('doc-id');
const docClass = document.getElementById('doc-class');
const docGradesBody = document.getElementById('doc-grades-body');
const docAverage = document.getElementById('doc-average');
const docStatus = document.getElementById('doc-status');

// Network Monitor
const statusText = document.getElementById('network-status');
window.addEventListener('online', () => statusText.innerText = 'Live Sync 🟢');
window.addEventListener('offline', () => statusText.innerText = 'Offline Vault 🔴');

// --- 1. Load Initial Configuration ---
async function initializeEngine() {
    try {
        const classesSnap = await getDocs(collection(db, "classes"));
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        reportClassSelect.innerHTML = '<option value="">-- Select Class --</option>';
        
        classesSnap.forEach(doc => {
            classSelect.appendChild(new Option(doc.data().name, doc.data().name));
            reportClassSelect.appendChild(new Option(doc.data().name, doc.data().name));
        });

        const subjectsSnap = await getDocs(collection(db, "subjects"));
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        subjectsSnap.forEach(doc => {
            subjectSelect.appendChild(new Option(doc.data().name, doc.data().name));
        });

    } catch (error) { console.error("Error loading config: ", error); }
}

// --- 2. Master Grading Sheet Logic ---
loadSheetBtn.addEventListener('click', async () => {
    const targetClass = classSelect.value;
    const targetSubject = subjectSelect.value;

    if (!targetClass || !targetSubject) return alert("Select both a Class and a Subject.");

    try {
        loadSheetBtn.innerText = "Loading...";
        sheetTitle.innerHTML = `Grading Sheet: <span style="color: #10b981;">${targetClass} - ${targetSubject}</span>`;

        const q = query(collection(db, "students"), where("class", "==", targetClass));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="3" class="empty-state">No students found.</td></tr>`;
            saveBar.style.display = 'none';
            return;
        }

        tableBody.innerHTML = ''; 
        querySnapshot.forEach((docSnap) => {
            const student = docSnap.data();
            const studentId = docSnap.id; 
            const displaySysId = student.system_id || studentId.substring(0, 8).toUpperCase();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color: #7f8c8d; font-family: monospace;">${displaySysId}</td>
                <td><strong>${student.name}</strong></td>
                <td><input type="number" class="grade-input" data-docid="${studentId}" data-sysid="${displaySysId}" data-name="${student.name}" placeholder="--" min="0" max="100"></td>
            `;
            tableBody.appendChild(row);
        });

        saveBar.style.display = 'flex';
        saveFeedback.innerText = "Ready to log marks offline.";
        saveFeedback.style.color = "#7f8c8d";
    } catch (error) { console.error("Error: ", error); } finally { loadSheetBtn.innerText = "Load Master Sheet"; }
});

saveGradesBtn.addEventListener('click', async () => {
    const targetClass = classSelect.value;
    const targetSubject = subjectSelect.value;
    const gradeInputs = document.querySelectorAll('.grade-input');

    saveGradesBtn.innerText = "Locking to Vault...";
    saveGradesBtn.disabled = true;

    try {
        let saveCount = 0;
        for (const input of gradeInputs) {
            const gradeValue = input.value.trim();
            if (gradeValue !== "") {
                const studentDocId = input.getAttribute('data-docid');
                const studentName = input.getAttribute('data-name');
                const sysId = input.getAttribute('data-sysid');

                const recordId = `${studentDocId}_${targetSubject.replace(/\s+/g, '')}`;
                await setDoc(doc(db, "grades", recordId), {
                    student_id: studentDocId,
                    system_id: sysId,
                    student_name: studentName,
                    class: targetClass,
                    subject: targetSubject,
                    term_mark: parseFloat(gradeValue),
                    timestamp: serverTimestamp()
                });
                saveCount++;
            }
        }
        saveFeedback.innerText = `✅ Successfully locked ${saveCount} grades to the vault.`;
        saveFeedback.style.color = "#10b981";
    } catch (error) { console.error("Error: ", error); } finally {
        saveGradesBtn.innerText = "Lock All Grades to Vault";
        saveGradesBtn.disabled = false;
    }
});

// --- 3. Report Card Generator Logic ---

// Auto-load students when a class is selected
reportClassSelect.addEventListener('change', async (e) => {
    const targetClass = e.target.value;
    reportStudentSelect.innerHTML = '<option value="">Loading students...</option>';
    reportStudentSelect.disabled = true;

    if (!targetClass) {
        reportStudentSelect.innerHTML = '<option value="">Waiting for class selection...</option>';
        return;
    }

    try {
        const q = query(collection(db, "students"), where("class", "==", targetClass));
        const studentsSnap = await getDocs(q);
        
        reportStudentSelect.innerHTML = '<option value="">-- Select Student --</option>';
        studentsSnap.forEach(doc => {
            const stu = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; // Store actual database ID
            option.innerText = stu.name;
            // Store extra data as attributes so we don't have to fetch it again
            option.setAttribute('data-sysid', stu.system_id || doc.id.substring(0, 8).toUpperCase());
            option.setAttribute('data-name', stu.name);
            option.setAttribute('data-class', stu.class);
            reportStudentSelect.appendChild(option);
        });
        reportStudentSelect.disabled = false;
    } catch (e) { console.error(e); }
});

// Calculate Grade Logic
function getGradeScale(mark) {
    if (mark >= 80) return { letter: 'A', class: 'bg-A', remark: 'Excellent' };
    if (mark >= 70) return { letter: 'B', class: 'bg-B', remark: 'Very Good' };
    if (mark >= 60) return { letter: 'C', class: 'bg-C', remark: 'Satisfactory' };
    return { letter: 'D', class: 'bg-D', remark: 'Needs Improvement' };
}

// Generate the Document
generateReportBtn.addEventListener('click', async () => {
    const selectedOption = reportStudentSelect.options[reportStudentSelect.selectedIndex];
    const studentId = selectedOption.value;

    if (!studentId) return alert("Please select a student.");

    try {
        generateReportBtn.innerText = "Generating...";
        generateReportBtn.disabled = true;

        // Populate Header Data
        docName.innerText = selectedOption.getAttribute('data-name');
        docId.innerText = selectedOption.getAttribute('data-sysid');
        docClass.innerText = selectedOption.getAttribute('data-class');

        // Query the vault for all grades matching this student ID
        const q = query(collection(db, "grades"), where("student_id", "==", studentId));
        const gradesSnap = await getDocs(q);

        docGradesBody.innerHTML = '';
        let totalMarks = 0;
        let subjectCount = 0;

        if (gradesSnap.empty) {
            docGradesBody.innerHTML = `<tr><td colspan="4" class="empty-state">No grades recorded for this student yet.</td></tr>`;
            docAverage.innerText = "0%";
            reportDocument.style.display = 'block';
            return;
        }

        gradesSnap.forEach(docSnap => {
            const data = docSnap.data();
            const scale = getGradeScale(data.term_mark);
            totalMarks += data.term_mark;
            subjectCount++;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${data.subject}</strong></td>
                <td style="text-align: center;">${data.term_mark}%</td>
                <td style="text-align: center;"><span class="grade-badge ${scale.class}">${scale.letter}</span></td>
                <td><span style="color: #7f8c8d; font-size: 13px;">${scale.remark}</span></td>
            `;
            docGradesBody.appendChild(row);
        });

        // Calculate Summary
        const average = (totalMarks / subjectCount).toFixed(1);
        docAverage.innerText = `${average}%`;
        
        if (average >= 60) {
            docStatus.innerText = "Proceed";
            docStatus.style.color = "#10b981";
        } else {
            docStatus.innerText = "Academic Review";
            docStatus.style.color = "#e74c3c";
        }

        reportDocument.style.display = 'block';

    } catch (e) { console.error(e); } finally {
        generateReportBtn.innerText = "Generate Report Card";
        generateReportBtn.disabled = false;
    }
});

// Boot up
initializeEngine();