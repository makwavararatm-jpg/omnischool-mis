import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    updateDoc
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

const urlParams = new URLSearchParams(window.location.search);
const targetClass = urlParams.get('class');

const classTitleEl = document.getElementById('class-title');
const tableBody = document.getElementById('roster-table-body');

// Modal Elements
const modal = document.getElementById('profile-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const modalFeedback = document.getElementById('modal-feedback');

// Read-Only Modal Elements
const modalAvatar = document.getElementById('modal-avatar');
const modalDisplayName = document.getElementById('modal-display-name');
const modalSysId = document.getElementById('modal-sys-id');
const modalDisplayClass = document.getElementById('modal-display-class');
const modalDisplayEnrolled = document.getElementById('modal-display-enrolled');

// Editable Modal Inputs
const editDocId = document.getElementById('edit-doc-id');
const editName = document.getElementById('edit-name');
const editDob = document.getElementById('edit-dob');
const editParentName = document.getElementById('edit-parent-name');
const editParentContact = document.getElementById('edit-parent-contact');
const editParentEmail = document.getElementById('edit-parent-email'); // Added Email field

// --- Helper: Get Initials for Avatar ---
function getInitials(name) {
    let parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return (parts[0][0] + parts[0][1] || parts[0][0]).toUpperCase();
    return "??";
}

// --- 1. Load the Roster ---
async function loadRoster() {
    if (!targetClass) {
        classTitleEl.innerText = "Unknown Class";
        tableBody.innerHTML = `<tr><td colspan="3" class="empty-state">No class specified. Go back to the dashboard.</td></tr>`;
        return;
    }

    classTitleEl.innerText = targetClass;

    try {
        const studentsRef = collection(db, "students");
        const q = query(studentsRef, where("class", "==", targetClass));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="3" class="empty-state">No students found in ${targetClass}.</td></tr>`;
            return;
        }

        tableBody.innerHTML = ''; 

        querySnapshot.forEach((docSnap) => {
            const student = docSnap.data();
            const row = document.createElement('tr');
            
            let guardianDisplay = student.parent_name;
            if (!student.parent_name || student.parent_name === "Pending") {
                guardianDisplay = `<span style="color: #95a5a6; font-style: italic;">Missing KYC</span> <span class="pending-warning">!</span>`;
            }

            const displayId = student.system_id || docSnap.id.substring(0, 8).toUpperCase();
            const enrolledDate = student.timestamp ? student.timestamp.toDate().toLocaleDateString() : "Pending Sync";

            // Attach data directly to the ROW so clicking anywhere opens the profile
            row.setAttribute('data-id', docSnap.id);
            row.setAttribute('data-sysid', displayId);
            row.setAttribute('data-name', student.name);
            row.setAttribute('data-class', student.class);
            row.setAttribute('data-enrolled', enrolledDate);
            row.setAttribute('data-dob', student.dob || '');
            row.setAttribute('data-pname', student.parent_name || '');
            row.setAttribute('data-pcontact', student.parent_contact || '');
            row.setAttribute('data-pemail', student.parent_email || ''); // Attach email to row

            row.innerHTML = `
                <td><strong>${student.name}</strong></td>
                <td style="color: #10b981; font-family: monospace; font-weight: bold;">${displayId}</td>
                <td>${guardianDisplay}</td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error fetching roster: ", error);
        tableBody.innerHTML = `<tr><td colspan="3" class="empty-state" style="color: red;">Error loading data from the vault.</td></tr>`;
    }
}

// --- 2. Handle Row Clicks to Open Modal ---
tableBody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row || !row.getAttribute('data-id')) return; 
    
    const fullName = row.getAttribute('data-name');
    modalAvatar.innerText = getInitials(fullName);
    modalDisplayName.innerText = fullName;
    modalSysId.innerText = row.getAttribute('data-sysid');
    
    modalDisplayClass.innerText = row.getAttribute('data-class');
    modalDisplayEnrolled.innerText = row.getAttribute('data-enrolled');
    
    editDocId.value = row.getAttribute('data-id');
    editName.value = fullName;
    
    const dob = row.getAttribute('data-dob');
    editDob.value = dob === "Pending" ? "" : dob;
    
    const pname = row.getAttribute('data-pname');
    editParentName.value = pname === "Pending" ? "" : pname;
    
    const pcontact = row.getAttribute('data-pcontact');
    editParentContact.value = pcontact === "Pending" ? "" : pcontact;

    const pemail = row.getAttribute('data-pemail');
    editParentEmail.value = pemail === "Pending" ? "" : pemail;

    // Show the modal
    modal.style.display = 'flex';
});

// --- 3. Close Modal ---
closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    modalFeedback.innerText = "";
});

// --- 4. Save Updates to Firestore ---
saveProfileBtn.addEventListener('click', async () => {
    const docId = editDocId.value;
    if (!docId) return;

    try {
        saveProfileBtn.innerText = "Updating...";
        saveProfileBtn.disabled = true;

        const studentRef = doc(db, "students", docId);
        
        await updateDoc(studentRef, {
            name: editName.value.trim(),
            dob: editDob.value,
            parent_name: editParentName.value.trim() || "Pending",
            parent_contact: editParentContact.value.trim() || "Pending",
            parent_email: editParentEmail.value.trim() || "Pending" // Save email
        });

        // Update the visual display immediately
        modalDisplayName.innerText = editName.value.trim();
        modalAvatar.innerText = getInitials(editName.value.trim());

        modalFeedback.innerText = "✅ Profile updated successfully.";
        modalFeedback.style.color = "#10b981";

        loadRoster(); // Refresh the table behind the modal

        setTimeout(() => {
            modalFeedback.innerText = "";
            saveProfileBtn.innerText = "Save Changes";
            saveProfileBtn.disabled = false;
        }, 1500);

    } catch (error) {
        console.error("Error updating profile:", error);
        modalFeedback.innerText = "❌ Error updating profile.";
        modalFeedback.style.color = "#e74c3c";
        saveProfileBtn.innerText = "Save Changes";
        saveProfileBtn.disabled = false;
    }
});

// Boot up
loadRoster();