/**
 * EASYON DIAMOND UI HELPERS (v84.0) 🪄✨
 * Alt hvad der har med visuel feedback og navigation at gøre.
 */

import { state } from '../core/app-state.js';

export function showSnackbar(msg, code = null) {
    const sb = document.getElementById('snackbar');
    if (!sb) return;
    let fullMsg = msg;
    if (code) fullMsg += ` (Fejlkode: ${code})`;
    sb.innerText = fullMsg;
    sb.className = 'snackbar show';
    setTimeout(() => { sb.className = sb.className.replace('show', ''); }, 4000);
}

export function showLoading(isLoading) {
    state.profileLoading = isLoading;
    const loader = document.getElementById('eliteLoader') || document.getElementById('global-loader');
    if (!loader) return;
    loader.style.opacity = isLoading ? '1' : '0';
    loader.style.pointerEvents = isLoading ? 'all' : 'none';
    if (loader.id === 'global-loader') loader.classList.toggle('hidden', !isLoading);
}

export function setLoading(btn, isLoading, originalText) {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = 'Arbejder...';
        btn.disabled = true;
    } else {
        btn.innerText = originalText || btn.dataset.originalText || 'Fortsæt';
        btn.disabled = false;
    }
}

export function togglePassVisibility(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = (input.type === 'password' ? 'text' : 'password');
}

export function showView(viewId) {
    state.currentView = viewId;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    if (viewId === 'dashboard') {
        document.body.classList.add('dashboard-mode');
    } else {
        document.body.classList.remove('dashboard-mode');
        // Sikrer at scroll lock fjernes, hvis menuen var åben på mobil
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-locked');
        document.body.classList.remove('sidebar-open');
        
        const sidebar = document.getElementById('dashboardSidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
        
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.classList.remove('active');
    }
    
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        if (viewId !== 'dashboard') window.scrollTo(0, 0);
    }
}

export function toggleSidebar() {
    const sidebar = document.getElementById('dashboardSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active');
    
    // Toggle body classes for scroll lock and UI states 💎
    const isOpen = sidebar && sidebar.classList.contains('mobile-open');
    document.body.classList.toggle('sidebar-locked', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen); // Specific for hamburger styling
    
    if (isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

export function closeAllModals() {
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
}

export function openModal(id, reset = false) {
    const m = document.getElementById(id); if (!m) return;
    if (reset) m.querySelectorAll('form').forEach(f => f.reset());
    m.classList.remove('hidden'); 
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('hidden');
    
    // Feature Specific Prep
    if (id === 'modal-pm' && window.preparePmModal) window.preparePmModal();
    if (id === 'modal-sscc' && window.prepareSsccModal) window.prepareSsccModal();
    if (id === 'modal-indkoeb' && window.preparePoModal) window.preparePoModal();
}

/**
 * Mobile Drill-down Helpers 📱💎
 * Hides list and shows detail view on mobile.
 */
export function showMobileDetail(tabId) {
    const grid = document.getElementById(tabId + 'SplitGrid');
    if (grid && window.innerWidth <= 992) {
        grid.classList.add('mobile-detail-active');
    }
}

export function hideMobileDetail(tabId) {
    const grid = document.getElementById(tabId + 'SplitGrid');
    if (grid) {
        grid.classList.remove('mobile-detail-active');
    }
}

export function updateLandingUI() {
    const session = localStorage.getItem('easyon_session_profile');
    const isLoggedIn = !!session;
    
    // Header Navigation
    const gNav = document.getElementById('guestNav');
    const uNav = document.getElementById('userNav');
    if (gNav) gNav.classList.toggle('hidden', isLoggedIn);
    if (uNav) uNav.classList.toggle('hidden', !isLoggedIn);

    // Hero Section Buttons
    const gHero = document.getElementById('guestHeroBtns');
    const uHero = document.getElementById('userHeroBtns');
    if (gHero) gHero.classList.toggle('hidden', isLoggedIn);
    if (uHero) uHero.classList.toggle('hidden', !isLoggedIn);
}

// Global exposure for legacy / inline support
window.showMobileDetail = showMobileDetail;
window.hideMobileDetail = hideMobileDetail;
window.toggleSidebar = toggleSidebar;
window.showView = showView;
window.closeAllModals = closeAllModals;
window.openModal = openModal;
window.updateLandingUI = updateLandingUI;
