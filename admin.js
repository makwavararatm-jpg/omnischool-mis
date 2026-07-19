import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    addDoc, 
    getDocs,
    deleteDoc,
    doc,
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

// --- ELEMENTS ---
// Enrollment
const nameInput = document.getElementById('student-name');
const dobInput = document.getElementById('student-dob');
const parentNameInput = document.getElementById('parent-name');
const parentContactInput = document.getElementById('parent-contact');
const parentEmailInput = document.getElementById('parent-email');
const classSelect = document.getElementById('student-class'); 
const addBtn = document.getElementById('add-btn');
const feedback = document.getElementById('feedback-msg');

// Staff
const staffNameInput = document.getElementById('staff-name');
const staffEmailInput = document.getElementById('staff-email');
const assignClassSelect = document.getElementById('assign-class'); 
const assignSubjectSelect = document.getElementById('assign-subject'); 
const addAssignmentBtn = document.getElementById('add-assignment-btn');
const pendingAssignmentsContainer = document.getElementById('pending-assignments');
const addStaffBtn = document.getElementById('add-staff-btn');
const staffFeedback = document.getElementById('staff-feedback');
const staffListContainer = document.getElementById('staff-list');

let currentAssignments = []; // Holds the class/subject pairs before saving

// Settings (Classes & Subjects)
const newClassNameInput = document.getElementById('new-class-name');
const newClassFeeInput = document.getElementById('new-class-fee'); // Mapped fee input
const saveClassBtn = document.getElementById('save-class-btn');
const classesListContainer = document.getElementById('classes-list');
const settingsFeedback = document.getElementById('settings-feedback');

const newSubjectNameInput = document.getElementById('new-subject-name');
const saveSubjectBtn = document.getElementById('save-subject-btn');
const subjectsListContainer = document.getElementById('subjects-list');
const subjectFeedback = document.getElementById('subject-feedback');


// ==========================================
// MODULE 1: DYNAMIC SYSTEM SETTINGS
// ==========================================

// ==========================================
// 1. CLEAN LOAD CLASSES FUNCTION
// ==========================================
async function loadClasses() {
    try {
        const querySnapshot = await getDocs(collection(db, "classes"));
        
        // Clear lists and dropdowns safely
        classesListContainer.innerHTML = '';
        classSelect.innerHTML = '<option value="">-- Select Assigned Class --</option>'; // Keeps Student tab working
        assignClassSelect.innerHTML = '<option value="">-- Class --</option>'; // Powers the new Staff tab

        if (querySnapshot.empty) {
            classesListContainer.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 20px;">No classes configured.</div>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const classData = docSnap.data();
            
            // Populate both dropdowns
            classSelect.appendChild(new Option(classData.name, classData.name));
            assignClassSelect.appendChild(new Option(classData.name, classData.name));
            
            // Display the fee alongside the class name in a green badge
            const feeDisplay = classData.term_fee 
                ? `<span style="background: #e8f8f5; color: #10b981; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 13px; margin-left: 15px;">$${classData.term_fee}</span>` 
                : '';
            
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span style="font-weight: bold; color: #2c3e50;">📁 ${classData.name}</span>
                    ${feeDisplay}
                </div>
                <button class="btn-delete" data-id="${docSnap.id}" data-type="classes">Delete</button>
            `;
            classesListContainer.appendChild(listItem);
        });

        attachDeleteListeners();
    } catch (e) { console.error("Error loading classes: ", e); }
}

// ==========================================
// 2. CLEAN LOAD SUBJECTS FUNCTION
// ==========================================
async function loadSubjects() {
    try {
        const querySnapshot = await getDocs(collection(db, "subjects"));
        
        // Clear list and the new staff dropdown safely
        subjectsListContainer.innerHTML = '';
        assignSubjectSelect.innerHTML = '<option value="">-- Subject --</option>';

        if (querySnapshot.empty) {
            subjectsListContainer.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 20px;">No subjects configured.</div>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const subjectData = docSnap.data();
            
            // Populate the new staff assignment dropdown
            assignSubjectSelect.appendChild(new Option(subjectData.name, subjectData.name));

            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.innerHTML = `<span>📚 ${subjectData.name}</span><button class="btn-delete" data-id="${docSnap.id}" data-type="subjects">Delete</button>`;
            subjectsListContainer.appendChild(listItem);
        });

        attachDeleteListeners();
    } catch (e) { console.error("Error loading subjects: ", e); }
}

// ==========================================
// GLOBAL DELETE ENGINE (Bulletproof)
// ==========================================
document.addEventListener('click', async (e) => {
    // Listen for clicks on ANY delete button
    if (e.target.classList.contains('btn-delete')) {
        const type = e.target.getAttribute('data-type');
        const docId = e.target.getAttribute('data-id');
        
        // Friendly confirmation popup
        const typeName = type === 'classes' ? 'Class' : type === 'subjects' ? 'Subject' : 'Staff Member';
        
        if (confirm(`Are you sure you want to delete this ${typeName}?`)) {
            try {
                // Visual feedback
                const originalText = e.target.innerText;
                e.target.innerText = "Deleting...";
                e.target.disabled = true;
                
                // Delete from vault
                await deleteDoc(doc(db, type, docId));
                
                // Refresh the correct list dynamically
                if (type === 'classes') loadClasses();
                if (type === 'subjects') loadSubjects();
                if (type === 'staff') loadStaff();
                
            } catch (error) {
                console.error(`Error deleting ${type}:`, error);
                e.target.innerText = "Error";
                e.target.disabled = false;
            }
        }
    }
});

// ==========================================
// MODULE 2: STAFF DIRECTORY (UPGRADED)
// ==========================================

// 1. Handle adding assignments to the temporary array
addAssignmentBtn.addEventListener('click', () => {
    const cls = assignClassSelect.value;
    const sub = assignSubjectSelect.value;

    if (!cls || !sub) {
        alert("Please select both a Class and a Subject.");
        return;
    }

    // Check for duplicates
    const exists = currentAssignments.some(a => a.class === cls && a.subject === sub);
    if (exists) {
        alert("This allocation already exists.");
        return;
    }

    currentAssignments.push({ class: cls, subject: sub });
    renderPendingAssignments();
});

function renderPendingAssignments() {
    if (currentAssignments.length === 0) {
        pendingAssignmentsContainer.innerHTML = '<span style="color: #95a5a6; font-size: 12px; font-style: italic;">No allocations added yet...</span>';
        return;
    }

    pendingAssignmentsContainer.innerHTML = '';
    currentAssignments.forEach((assignment, index) => {
        const badge = document.createElement('div');
        badge.style.cssText = "background: #e8f8f5; border: 1px solid #10b981; color: #10b981; padding: 4px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px;";
        
        badge.innerHTML = `
            <span>${assignment.class} - ${assignment.subject}</span>
            <span style="cursor: pointer; color: #e74c3c; font-size: 14px;" onclick="removeAssignment(${index})">×</span>
        `;
        pendingAssignmentsContainer.appendChild(badge);
    });
}

// Make remove function global so the inline onclick works
window.removeAssignment = function(index) {
    currentAssignments.splice(index, 1);
    renderPendingAssignments();
}

// 2. Load Staff Roster
async function loadStaff() {
    try {
        const querySnapshot = await getDocs(collection(db, "staff"));
        staffListContainer.innerHTML = '';

        if (querySnapshot.empty) {
            staffListContainer.innerHTML = '<div style="text-align: center; color: #95a5a6; padding: 20px;">No staff records found.</div>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const staff = docSnap.data();
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            
            const assignments = staff.allocations || [];
            let badgesHtml = '<div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; max-width: 300px;">';
            
            if (assignments.length === 0) {
                badgesHtml += `<span style="color: #95a5a6; font-size: 11px;">No Allocations</span>`;
            } else {
                assignments.forEach(alloc => {
                    badgesHtml += `<span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #2c3e50; padding: 3px 8px; border-radius: 6px; font-size: 11px;"><strong>${alloc.class}:</strong> ${alloc.subject}</span>`;
                });
            }
            badgesHtml += '</div>';

            listItem.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <strong>${staff.name}</strong>
                    <span style="font-size: 12px; color: #7f8c8d;">${staff.email}</span>
                </div>
                ${badgesHtml}
            `;
            staffListContainer.appendChild(listItem);
        });
    } catch (e) { console.error(e); }
}

// 3. Save Staff to Vault
addStaffBtn.addEventListener('click', async () => {
    const name = staffNameInput.value.trim();
    const email = staffEmailInput.value.trim();

    if (!name || !email) return alert("Name and Email are required.");
    if (currentAssignments.length === 0) return alert("Please add at least one class/subject allocation.");

    try {
        addStaffBtn.innerText = "Provisioning...";
        addStaffBtn.disabled = true;

        await addDoc(collection(db, "staff"), {
            name: name,
            email: email,
            allocations: currentAssignments, // Saves the granular array!
            role: "Teacher",
            timestamp: serverTimestamp()
        });

        staffFeedback.innerText = "✅ Staff account provisioned!";
        staffFeedback.style.color = "#10b981";
        
        // Reset UI
        staffNameInput.value = ""; 
        staffEmailInput.value = "";
        assignClassSelect.value = "";
        assignSubjectSelect.value = "";
        currentAssignments = [];
        renderPendingAssignments();

        loadStaff(); 
        setTimeout(() => staffFeedback.innerText = "", 4000);
    } catch (e) { 
        console.error(e); 
    } finally {
        addStaffBtn.innerText = "Provision Staff Account";
        addStaffBtn.disabled = false;
    }
});

// ==========================================
// MODULE 3: STUDENT ENROLLMENT
// ==========================================
async function generateStudentID() {
    const yearStr = new Date().getFullYear().toString().slice(-2);
    const studentsSnap = await getDocs(collection(db, "students"));
    const paddedNumber = (studentsSnap.size + 1).toString().padStart(4, '0');
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomSuffix = letters.charAt(Math.floor(Math.random() * letters.length));
    return `ST${yearStr}${paddedNumber}${randomSuffix}`;
}

addBtn.addEventListener('click', async () => {
    const studentName = nameInput.value.trim();
    const studentClass = classSelect.value;
    if (!studentName || !studentClass) return;

    try {
        addBtn.innerText = "Saving to Vault...";
        addBtn.disabled = true;
        
        const generatedSystemId = await generateStudentID();
        
        await addDoc(collection(db, "students"), {
            system_id: generatedSystemId,
            name: studentName,
            dob: dobInput.value,
            parent_name: parentNameInput.value.trim(),
            parent_contact: parentContactInput.value.trim(),
            parent_email: parentEmailInput.value.trim(),     
            class: studentClass,
            school_id: "demo-school-01",
            timestamp: serverTimestamp() 
        });

        feedback.innerText = `✅ Enrolled! ID: ${generatedSystemId}`;
        feedback.style.color = "#10b981";
        
        nameInput.value = ""; dobInput.value = ""; parentNameInput.value = "";
        parentContactInput.value = ""; parentEmailInput.value = ""; classSelect.value = ""; 

        setTimeout(() => feedback.innerText = "", 6000);
    } catch (e) { console.error(e); } finally {
        addBtn.innerText = "Save to Master Roster";
        addBtn.disabled = false;
    }
});

// Boot up
loadClasses();
loadSubjects();
loadStaff();

// Refresh data on tab clicks
document.getElementById('tab-btn-settings').addEventListener('click', () => { loadClasses(); loadSubjects(); });
document.getElementById('tab-btn-staff').addEventListener('click', loadStaff);