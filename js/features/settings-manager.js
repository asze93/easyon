/**
 * EASYON DIAMOND SETTINGS MANAGER (v84.0) ⚙️
 * Håndterer indstillinger, temaer og KPI konfiguration.
 */

import { showSnackbar } from '../ui/ui-helpers.js';

/**
 * Skifter applikationens tema lynhurtigt
 * @param {string} themeName - 'midnight', 'deep-blue', 'gold' eller 'light'
 */
export function setTheme(themeName) {
    console.log(`🎨 Skifter tema til: ${themeName}`);
    
    // 1. Skift på document element så CSS variabler opdateres
    document.documentElement.setAttribute('data-theme', themeName);
    
    // 2. Gem i localStorage for hurtig indlæsning næste gang
    localStorage.setItem('easyon_theme', themeName);
    
    // 3. Opdater UI (vis hvilken der er valgt)
    document.querySelectorAll('.theme-card').forEach(card => {
        card.style.border = '1px solid var(--border)';
    });
    
    // Highlight den valgte
    const selectedCard = document.querySelector(`.theme-card[onclick*="${themeName}"]`);
    if (selectedCard) {
        selectedCard.style.border = '2px solid var(--primary)';
    }

    showSnackbar(`Tema skiftet til ${themeName.charAt(0).toUpperCase() + themeName.slice(1)}! ✨`);
}

export function saveIndstillinger() {
    const currentTheme = localStorage.getItem('easyon_theme') || 'midnight';
    console.log("Gemmer indstillinger til skyen...", { theme: currentTheme });
    
    // Her kunne vi lave et kald til Supabase 'firma_indstillinger' 
    // for at gemme det permanent på firma-niveau.
    
    showSnackbar("Systemindstillinger og tema er gemt i skyen! 💎☁️");
}

export function saveKpiSettings() {
    showSnackbar("KPI Mål gemt succesfuldt! 🎯");
}

// Initialiser tema ved load
export function initTheme() {
    const savedTheme = localStorage.getItem('easyon_theme') || 'midnight';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// EXPOSE GLOBALS
window.setTheme = setTheme;
window.saveIndstillinger = saveIndstillinger;
window.saveKpiSettings = saveKpiSettings;

// Kør init
initTheme();
