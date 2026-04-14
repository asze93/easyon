/**
 * EASYON DIAMOND NAVIGATION (v84.0) 🧭🚀
 * Alt omkring visningsskift og hov-menu navigation.
 */

import { state } from '../core/app-state.js';
import { showView, showSnackbar, toggleSidebar } from './ui-helpers.js';
import { 
    fetchTasks, fetchRequests, fetchLager, fetchAssets, 
    fetchLocations, fetchCategories, fetchTeam, fetchStats 
} from '../services/api-service.js';
import { fetchProcedures } from '../features/sop-builder.js';
import { fetchSsccShipments } from '../features/logistics-manager.js';
import { fetchSuppliers, fetchPurchaseOrders } from '../features/procurement-manager.js';
import { fetchPmPlans } from '../features/pm-manager.js';

export function dashTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(n => n.classList.remove('active'));
    
    // Support both ID and data-tab attributes
    const targetTab = document.getElementById('dash-' + tabId);
    if (targetTab) targetTab.classList.add('active');
    
    document.querySelectorAll(`.dash-nav[data-tab="${tabId}"]`).forEach(n => n.classList.add('active'));
}

export async function dashNavTab(e, tabId) {
    if (e) e.preventDefault();
    
    const adminTabs = ['team', 'indstillinger', 'categories', 'locations', 'assets', 'lager', 'kpi', 'sscc', 'indkoeb', 'data-hub', 'feedback'];
    
    // Defensive check: If we're an admin or the tab is NOT in adminTabs, allow.
    if (adminTabs.includes(tabId)) {
        const savedRole = localStorage.getItem('easyon_user_role') || (state.isGlobalAdmin ? 'admin' : 'viewer');
        if (!savedRole.includes('admin') && !savedRole.includes('superbruger')) {
            showSnackbar("Ingen adgang. Kun for Administratorer. 🔒"); 
            return; 
        }
    }

    if (window.innerWidth < 992) toggleSidebar(); 
    
    // Handle redirected tabs
    if (tabId === 'kpi' || tabId === 'data-hub') {
        const subTab = tabId === 'kpi' ? 'kpi' : 'data';
        dashTab('indstillinger');
        const navBtn = document.querySelector(`.settings-nav[onclick*="'${subTab}'"]`);
        if (navBtn) window.switchSettings(navBtn, subTab);
        return;
    }

    // Switch Tab Immediately (Visual feedback)
    dashTab(tabId);

    // Fetch fresh data in the background (Non-blocking)
    try {
        if (tabId === 'tasks') fetchTasks();
        if (tabId === 'requests') fetchRequests();
        if (tabId === 'lager' && window.renderLagerList) window.renderLagerList();
        if (tabId === 'assets' && window.renderAssetsList) window.renderAssetsList();
        if (tabId === 'locations') fetchLocations();
        if (tabId === 'categories') fetchCategories();
        if (tabId === 'team') fetchTeam();
        if (tabId === 'procedures') fetchProcedures();
        if (tabId === 'sscc') fetchSsccShipments();
        if (tabId === 'pm') fetchPmPlans();
        if (tabId === 'indkoeb') { fetchSuppliers(); fetchPurchaseOrders(); }
        if (tabId === 'overview') fetchStats();
        if (tabId === 'feedback' && window.fetchFeedback) window.fetchFeedback();
        if (tabId === 'indstillinger') {
            // Data for sub-tabs
            if (typeof window.fetchKpiStats === 'function') window.fetchKpiStats();
        }
    } catch (err) {
        console.warn(`Data refresh failed for ${tabId}:`, err);
    }
}

// EXPOSE GLOBALS for Legacy HTML support
window.dashNavTab = dashNavTab;
window.dashTab = dashTab;
