/**
 * EASYON DIAMOND MAIN ENTRY POINT (v86.8) 🧠⚡🚀
 * Dirigenten der starter hele EasyON platformen.
 */

import { state } from './core/app-state.js';
import { showView, showSnackbar, toggleSidebar, closeAllModals, openModal, updateLandingUI } from './ui/ui-helpers.js';
import { handleAuth, loadDashboard, logout } from './services/auth-service.js';
import { checkAndProcessPm } from './features/pm-manager.js';

// EXPOSE GLOBALS IMMEDIATELY (v85.5 - Early Wiring) 🔌💎
window.showView = showView;
window.showSnackbar = showSnackbar;
window.toggleSidebar = toggleSidebar;
window.closeAllModals = closeAllModals;
window.openModal = openModal;
window.handleAuth = handleAuth;
window.loadDashboard = loadDashboard;
window.logout = logout;

// FEATURE MODULES (Exposes globals for legacy HTML buttons)
import './features/asset-manager.js';
import './features/task-manager.js';
import './features/sop-builder.js';
import './features/team-manager.js';
import './features/location-manager.js';
import './features/category-manager.js';
import './features/lager-manager.js';
import './features/logistics-manager.js';
import './features/procurement-manager.js';
import './features/pm-manager.js';
import './features/settings-manager.js';
import './features/feedback-manager.js';
import './ui/navigation.js';

import { dashNavTab, dashTab } from './ui/navigation.js';
window.dashNavTab = dashNavTab;
window.dashTab = dashTab;

window.toggleAuthMode = (mode) => {
    state.authMode = mode;
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('authBtn');
    const nameGrp = document.getElementById('nameGroup');
    const sub = document.getElementById('authSub');
    const passConfirm = document.getElementById('passConfirmGroup');
    const firmaGroup = document.getElementById('loginFirmaGroup');

    if (mode === 'signup') {
        if (title) title.innerHTML = 'Opret <span>EasyON</span> Profil';
        if (btn) btn.innerText = 'Start Gratis Prøveperiode 🚀';
        if (nameGrp) nameGrp.classList.remove('hidden');
        if (sub) sub.innerText = "Det tager kun 30 sekunder at komme i gang.";
        if (passConfirm) passConfirm.classList.remove('hidden');
        if (firmaGroup) firmaGroup.classList.add('hidden');
    } else {
        if (title) title.innerHTML = 'Velkommen tilbage 💎';
        if (btn) btn.innerText = 'Log ind på Dashboard';
        if (nameGrp) nameGrp.classList.add('hidden');
        if (sub) sub.innerText = "Godt at se dig igen – dit dashboard venter.";
        if (passConfirm) passConfirm.classList.add('hidden');
        if (firmaGroup) firmaGroup.classList.remove('hidden');
    }
    showView('auth');
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    console.log("--- EASYON DIAMOND v86.1 INITIALIZING --- 💎");

    // Connect to Supabase
    try {
        state.supabaseClient = window.supabase.createClient(
            'https://zhbbyttbulqvekfsvspt.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYmJ5dHRidWxxdmVrZnN2c3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQ0NDAsImV4cCI6MjA5MDQ4MDQ0MH0.P44R3ypY4qFXHAD4Jeku4-y8puLhnvx0xmwcWeo9mak'
        );
    } catch (e) {
        showSnackbar("Kunne ikke forbinde til databasen. Tjek din internetforbindelse.");
        return;
    }

    // Set up Global Event Listeners
    setupEventListeners();

    // Initial Landing UI state check 🧭
    updateLandingUI();

    // Check for Session
    const savedProfile = localStorage.getItem('easyon_session_profile');
    if (savedProfile) {
        try {
            const profile = JSON.parse(savedProfile);
            // Run Automation Audits (PM) 🛰️
            checkAndProcessPm();
            
            // Validate the session has required fields - clear bad sessions
            if (!profile || !profile.firma_id || profile.firma_id === 'null' || profile.firma_id === 'undefined') {
                console.warn('💀 Bad session detected - clearing localStorage and redirecting to login');
                localStorage.clear();
                showView('landing');
            } else {
                await loadDashboard(profile);
            }
        } catch (e) {
            localStorage.removeItem('easyon_session_profile');
            showView('landing');
        }
    } else {
        showView('landing');
    }
});

function setupEventListeners() {
    // Fjernet: Event listeners her forudsagede dobbelt-kald (double execution) 
    // fordi index.html allerede bruger globals (f.eks. onclick="dashNavTab(...)").
}
