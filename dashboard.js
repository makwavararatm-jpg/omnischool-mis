import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    collection, 
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Elements
const kpiStudents = document.getElementById('kpi-students');
const kpiExpected = document.getElementById('kpi-expected');
const kpiCollected = document.getElementById('kpi-collected');
const kpiOwed = document.getElementById('kpi-owed');

let enrollmentChartInstance = null;
let financeChartInstance = null;

async function loadDashboardMetrics() {
    try {
        // 1. Fetch Class Fees Map
        const classFeeMap = {};
        const classesSnap = await getDocs(collection(db, "classes"));
        classesSnap.forEach(doc => {
            classFeeMap[doc.data().name] = doc.data().term_fee || 0;
        });

        // 2. Fetch Students & Calculate Expected Revenue
        let totalStudents = 0;
        let expectedRevenue = 0;
        const classCounts = {}; // For the bar chart

        const studentsSnap = await getDocs(collection(db, "students"));
        studentsSnap.forEach(doc => {
            const student = doc.data();
            totalStudents++;
            
            // Add to Expected Revenue based on their class fee
            expectedRevenue += (classFeeMap[student.class] || 0);

            // Group for chart
            classCounts[student.class] = (classCounts[student.class] || 0) + 1;
        });

        // 3. Fetch Transactions to calculate Actual Collected
        let totalCollected = 0;
        const txSnap = await getDocs(collection(db, "transactions"));
        txSnap.forEach(doc => {
            if (doc.data().type === "income") {
                totalCollected += doc.data().amount;
            }
        });

        // 4. Calculate Outstanding
        let totalOwed = expectedRevenue - totalCollected;
        if (totalOwed < 0) totalOwed = 0; // Prevent negative owed if overpaid

        // --- UPDATE KPI UI ---
        kpiStudents.innerText = totalStudents;
        kpiExpected.innerText = `$${expectedRevenue.toFixed(2)}`;
        kpiCollected.innerText = `$${totalCollected.toFixed(2)}`;
        kpiOwed.innerText = `$${totalOwed.toFixed(2)}`;

        // --- RENDER CHARTS ---
        renderEnrollmentChart(classCounts);
        renderFinanceChart(totalCollected, totalOwed);

    } catch (error) {
        console.error("Dashboard Error: ", error);
        kpiStudents.innerText = "Error";
    }
}

// Draw the Bar Chart (Enrollment)
function renderEnrollmentChart(classData) {
    const ctx = document.getElementById('enrollmentChart').getContext('2d');
    if (enrollmentChartInstance) enrollmentChartInstance.destroy();

    const labels = Object.keys(classData).length > 0 ? Object.keys(classData) : ["No Students Yet"];
    const data = Object.keys(classData).length > 0 ? Object.values(classData) : [0];

    enrollmentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Enrolled Students',
                data: data,
                backgroundColor: '#3498db',
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            },
            onClick: (event, elements) => {
                if (elements.length > 0 && labels[0] !== 'No Students Yet') {
                    const selectedClass = labels[elements[0].index];
                    window.location.href = `roster.html?class=${encodeURIComponent(selectedClass)}`;
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] && labels[0] !== 'No Students Yet' ? 'pointer' : 'default';
            }
        }
    });
}

// Draw the Doughnut Chart (Financial Health)
function renderFinanceChart(collected, owed) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    if (financeChartInstance) financeChartInstance.destroy();

    // Prevent blank chart if no money expected yet
    if (collected === 0 && owed === 0) {
        owed = 1; // Fake value just to draw a gray circle
    }

    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Collected', 'Outstanding'],
            datasets: [{
                data: [collected, owed],
                backgroundColor: ['#10b981', '#e74c3c'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            }
        }
    });
}

// Boot up
loadDashboardMetrics();

// ==========================================
// EXECUTIVE FEEDS (Live Attendance & Events)
// ==========================================

async function loadExecutiveFeeds() {
    try {
        // 1. Fetch Live Announcements
        const eventsSnap = await getDocs(collection(db, "events"));
        const eventsList = document.getElementById('dash-events-list');
        
        let events = [];
        eventsSnap.forEach(doc => events.push(doc.data()));
        events.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); // Newest top
        
        eventsList.innerHTML = '';
        if (events.length === 0) {
            eventsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #95a5a6; font-style: italic;">No campus announcements.</div>';
        } else {
            events.forEach(ev => {
                const postDate = ev.timestamp ? ev.timestamp.toDate().toLocaleDateString() : 'Recent';
                const dateBadge = ev.date ? `<span class="date-badge">📅 ${ev.date}</span>` : '';
                
                eventsList.innerHTML += `
                    <div class="event-card">
                        <div class="event-meta">${ev.author || 'Admin'} • Posted ${postDate}</div>
                        <h4 class="event-title">${ev.title} ${dateBadge}</h4>
                        <p class="event-desc">${ev.description}</p>
                    </div>
                `;
            });
        }

        // 2. Fetch Live Attendance Feed
        const attSnap = await getDocs(collection(db, "attendance"));
        const attList = document.getElementById('dash-attendance-list');
        
        let records = [];
        attSnap.forEach(doc => records.push(doc.data()));
        records.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); // Newest top
        
        attList.innerHTML = '';
        if (records.length === 0) {
            attList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #95a5a6; font-style: italic;">No attendance recorded yet.</td></tr>';
        } else {
            // Show only the 15 most recent records so the dashboard doesn't get infinitely long
            records.slice(0, 15).forEach(rec => {
                const dateStr = rec.date || (rec.timestamp ? rec.timestamp.toDate().toLocaleDateString() : 'N/A');
                const statusColor = rec.status === 'Present' ? '#10b981' : '#e74c3c';
                
                attList.innerHTML += `
                    <tr>
                        <td style="color: #7f8c8d;">${dateStr}</td>
                        <td><strong>${rec.class}</strong></td>
                        <td style="color: #2c3e50;">${rec.student_name}</td>
                        <td style="color: ${statusColor}; font-weight: bold;">${rec.status}</td>
                    </tr>
                `;
            });
        }
    } catch (error) {
        console.error("Error loading executive feeds:", error);
    }
}

// Ensure the feeds load when the dashboard boots up!
loadExecutiveFeeds();