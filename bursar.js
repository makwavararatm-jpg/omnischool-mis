import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    addDoc, 
    getDocs,
    query,
    where,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 🔴 1. PASTE YOUR FIREBASE CONFIG HERE
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

emailjs.init("7pmLCsmrNpjD3gZVS");

// --- INCOME ELEMENTS ---
const studentSelect = document.getElementById('student-select');
const paymentMethod = document.getElementById('payment-method');
const amountInput = document.getElementById('amount');
const paymentDesc = document.getElementById('payment-desc'); // Maps the Narration
const processBtn = document.getElementById('process-btn');
const receiptArea = document.getElementById('receipt-area');

// --- ACCOUNT STATUS ELEMENTS ---
const accountStatusCard = document.getElementById('account-status-card');
const displayBalance = document.getElementById('display-balance');
const displayTermFee = document.getElementById('display-term-fee');
const displayTotalPaid = document.getElementById('display-total-paid');
let currentStudentBalance = 0; 

// --- EXPENSE ELEMENTS ---
const expenseCategory = document.getElementById('expense-category');
const expenseAmount = document.getElementById('expense-amount');
const expenseDesc = document.getElementById('expense-desc');
const logExpenseBtn = document.getElementById('log-expense-btn');
const expenseFeedback = document.getElementById('expense-feedback');

// --- ARREARS ELEMENTS ---
const arrearsTableBody = document.getElementById('arrears-table-body');
const refreshArrearsBtn = document.getElementById('refresh-arrears-btn');

const ledgerBody = document.getElementById('ledger-table-body');
let masterLedgerData = []; 

// 1. Load Students & Classes into Memory
let studentDataMap = {}; 
let classFeeMap = {};

async function loadSystemData() {
    try {
        const classSnap = await getDocs(collection(db, "classes"));
        classSnap.forEach(doc => { classFeeMap[doc.data().name] = doc.data().term_fee || 0; });

        const studentSnap = await getDocs(collection(db, "students"));
        studentSelect.innerHTML = '<option value="">-- Select a Student --</option>'; 
        studentSnap.forEach((doc) => {
            const student = doc.data();
            studentDataMap[student.name] = student;
            const option = document.createElement('option');
            option.value = student.name;
            option.innerText = `${student.name} (${student.class})`;
            studentSelect.appendChild(option);
        });
    } catch (error) { console.error(error); }
}

// 2. LIVE BALANCE CALCULATOR
studentSelect.addEventListener('change', async (e) => {
    const selectedName = e.target.value;
    if (!selectedName) {
        accountStatusCard.style.display = 'none';
        return;
    }

    accountStatusCard.style.display = 'block';
    displayBalance.innerText = "Calculating...";
    
    const studentInfo = studentDataMap[selectedName];
    const termFee = classFeeMap[studentInfo.class] || 0;
    const previousArrears = studentInfo.previous_arrears || 0; // Capture past arrears
    
    // Add past arrears to the current term fee
    const totalExpected = termFee + previousArrears;

    const q = query(collection(db, "transactions"), where("student", "==", selectedName), where("type", "==", "income"));
    const txSnap = await getDocs(q);
    
    let totalPaid = 0;
    txSnap.forEach(doc => { totalPaid += doc.data().amount; });

    currentStudentBalance = totalExpected - totalPaid;

    // Show breakdown in the UI
    displayTermFee.innerText = `$${termFee.toFixed(2)}${previousArrears > 0 ? ` (+ $${previousArrears} arrears)` : ''}`;
    displayTotalPaid.innerText = `$${totalPaid.toFixed(2)}`;
    
    if (currentStudentBalance <= 0) {
        displayBalance.innerText = "$0.00 (Fully Paid)";
        displayBalance.style.color = "#10b981"; 
    } else {
        displayBalance.innerText = `$${currentStudentBalance.toFixed(2)}`;
        displayBalance.style.color = "#e74c3c"; 
    }
});


// 3. PROCESS INCOME & SEND RECEIPT
processBtn.addEventListener('click', async () => {
    const selectedStudent = studentSelect.value;
    const amount = parseFloat(amountInput.value);
    const narration = paymentDesc.value.trim() || "Term Fees";
    
    if (!selectedStudent || !amount || amount <= 0) return alert("Select student and amount.");

    try {
        processBtn.innerText = "Processing & Emailing...";
        processBtn.disabled = true;

        await addDoc(collection(db, "transactions"), {
            student: selectedStudent,
            method: paymentMethod.value,
            amount: amount,
            description: narration, // Save Narration to Vault
            type: "income",
            school_id: "demo-school-01",
            timestamp: serverTimestamp()
        });

        const newBalance = currentStudentBalance - amount;
        const finalBalanceToDisplay = newBalance <= 0 ? 0 : newBalance;

        const todayStr = new Date().toLocaleDateString();
        document.getElementById('r-date').innerText = todayStr;
        document.getElementById('r-student').innerText = selectedStudent;
        document.getElementById('r-method').innerText = `${paymentMethod.value} (${narration})`;
        document.getElementById('r-amount').innerText = amount.toFixed(2);
        receiptArea.style.display = "block"; 

        if (navigator.onLine) {
            const targetEmail = studentDataMap[selectedStudent].parent_email;
            if (targetEmail && targetEmail !== "Pending") {
                const templateParams = {
                    to_email: targetEmail,
                    student_name: selectedStudent,
                    amount_paid: amount.toFixed(2),
                    payment_method: paymentMethod.value,
                    date: todayStr,
                    account_balance: finalBalanceToDisplay.toFixed(2), 
                    reply_to: "admin@intracore.digital"
                };
                await emailjs.send("service_cyvn17d", "template_ubal64q", templateParams);
            }
        }
        
        amountInput.value = "";
        paymentDesc.value = ""; // Clear narration input
        studentSelect.value = "";
        accountStatusCard.style.display = 'none';
        processBtn.innerText = "Complete Transaction";
        processBtn.disabled = false;

        fetchLedger(); 
        fetchArrearsList(); // Refresh arrears instantly so the list stays accurate

    } catch (e) {
        console.error(e);
        processBtn.innerText = "Complete Transaction";
        processBtn.disabled = false;
    }
});


// 4. Ledger & Expenses
async function fetchLedger() {
    try {
        masterLedgerData = []; 
        const txSnap = await getDocs(collection(db, "transactions"));
        txSnap.forEach(doc => { 
            masterLedgerData.push({ 
                type: 'Income', 
                details: doc.data().student, 
                ref: doc.data().description || doc.data().method, // Master Ledger displays Narration!
                amount: doc.data().amount, 
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date() 
            }); 
        });
        const exSnap = await getDocs(collection(db, "expenses"));
        exSnap.forEach(doc => { 
            masterLedgerData.push({ 
                type: 'Expense', 
                details: doc.data().category, 
                ref: doc.data().description, 
                amount: doc.data().amount, 
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date() 
            }); 
        });
        masterLedgerData.sort((a, b) => b.timestamp - a.timestamp);
        renderLedger();
    } catch (error) { console.error(error); }
}

function renderLedger() {
    ledgerBody.innerHTML = ''; 
    masterLedgerData.forEach(record => {
        const row = document.createElement('tr');
        const badgeClass = record.type === 'Income' ? 'badge-income' : 'badge-expense';
        const amountColor = record.type === 'Income' ? '#10b981' : '#e74c3c';
        row.innerHTML = `
            <td><strong>${record.timestamp.toLocaleDateString()}</strong></td>
            <td><span class="${badgeClass}">${record.type}</span></td>
            <td>${record.details}</td>
            <td>${record.ref}</td>
            <td style="text-align: right; font-weight: bold; color: ${amountColor};">${record.type === 'Income' ? '+' : '-'} $${record.amount.toFixed(2)}</td>
        `;
        ledgerBody.appendChild(row);
    });
}

// 5. Arrears Tracking Engine
async function fetchArrearsList() {
    try {
        if(!arrearsTableBody) return; // Prevent crashes if HTML isn't updated yet
        arrearsTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">Scanning financial records...</td></tr>';
        
        const txSnap = await getDocs(query(collection(db, "transactions"), where("type", "==", "income")));
        const paymentsMap = {};
        txSnap.forEach(doc => {
            const tx = doc.data();
            paymentsMap[tx.student] = (paymentsMap[tx.student] || 0) + tx.amount;
        });

        const studentsSnap = await getDocs(collection(db, "students"));
        arrearsTableBody.innerHTML = '';
        let arrearsCount = 0;

        studentsSnap.forEach(doc => {
            const student = doc.data();
            const termFee = classFeeMap[student.class] || 0;
            const previousArrears = student.previous_arrears || 0; 
            const arrearsNote = student.arrears_term || "N/A";
            
            const totalExpected = termFee + previousArrears;
            const totalPaid = paymentsMap[student.name] || 0;
            const balanceOwed = totalExpected - totalPaid;

            if (balanceOwed > 0) {
                arrearsCount++;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${student.name}</strong></td>
                    <td><span style="background: #f8fafc; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${student.class}</span></td>
                    <td style="color: #7f8c8d; font-size: 13px;">${arrearsNote} ($${previousArrears})</td>
                    <td style="text-align: right; color: #e74c3c; font-weight: bold; font-size: 16px;">$${balanceOwed.toFixed(2)}</td>
                `;
                arrearsTableBody.appendChild(row);
            }
        });

        if (arrearsCount === 0) {
            arrearsTableBody.innerHTML = '<tr><td colspan="4" class="empty-state" style="color: #10b981;">✅ All student accounts are fully cleared!</td></tr>';
        }
    } catch (error) { console.error("Arrears Error:", error); }
}

// Hook it up to the refresh button and tab click
if(refreshArrearsBtn) refreshArrearsBtn.addEventListener('click', fetchArrearsList);
const arrearsTabBtn = document.getElementById('tab-btn-arrears');
if(arrearsTabBtn) arrearsTabBtn.addEventListener('click', fetchArrearsList);

// Boot up
loadSystemData();
fetchLedger();
fetchArrearsList();

// ==========================================
// 6. PUBLISH CAMPUS EVENTS ENGINE
// ==========================================
const publishEventBtn = document.getElementById('publish-event-btn');

if (publishEventBtn) {
    publishEventBtn.addEventListener('click', async () => {
        const title = document.getElementById('event-title').value.trim();
        const date = document.getElementById('event-date').value;
        const desc = document.getElementById('event-desc').value.trim();
        const feedbackEl = document.getElementById('event-feedback');

        if (!title || !desc) return alert("Title and announcement details are required.");

        try {
            publishEventBtn.innerText = "Broadcasting to Vault...";
            publishEventBtn.disabled = true;

            await addDoc(collection(db, "events"), {
                title: title,
                date: date,
                description: desc,
                author: "Finance Office",
                timestamp: serverTimestamp()
            });

            document.getElementById('event-title').value = "";
            document.getElementById('event-date').value = "";
            document.getElementById('event-desc').value = "";
            
            feedbackEl.innerText = "✅ Announcement Broadcasted Successfully!";
            feedbackEl.style.color = "#10b981";
            
        } catch (error) {
            console.error("Error publishing event:", error);
            feedbackEl.innerText = "❌ Error broadcasting announcement.";
            feedbackEl.style.color = "#e74c3c";
        } finally {
            publishEventBtn.innerText = "Broadcast Announcement";
            publishEventBtn.disabled = false;
            setTimeout(() => feedbackEl.innerText = "", 4000);
        }
    });
}