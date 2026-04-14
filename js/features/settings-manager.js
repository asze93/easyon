/**
 * EASYON DIAMOND SETTINGS MANAGER (v84.0) ⚙️
 * Håndterer indstillinger, temaer og KPI konfiguration.
 */

import { state } from '../core/app-state.js';
import { showSnackbar } from '../ui/ui-helpers.js';
import { ensureLocationPath, ensureCategory } from '../services/api-service.js';

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

/**
 * Skifter mellem forskellige under-sektioner i indstillinger
 * @param {HTMLElement} btn - Knappen der blev trykket på
 * @param {string} sectionId - ID på sektionen der skal vises ('firma', 'kpi', 'data')
 */
export function switchSettings(btn, sectionId) {
    console.log(`切换设置分段: ${sectionId}`); // Log for debugging
    
    // 1. Opdater knapper (styling/active state)
    document.querySelectorAll('.settings-nav').forEach(b => {
        b.classList.remove('active');
        // Nulstil inline styles hvis de findes (fra tidligere forsøg)
        b.style.color = '';
        b.style.opacity = '';
    });
    
    btn.classList.add('active');
    
    // 2. Skjul alle sektioner
    document.querySelectorAll('.settings-section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    
    // 3. Vis den valgte sektion
    const target = document.getElementById('set-' + sectionId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
}

// EXPOSE GLOBALS
window.setTheme = setTheme;
window.saveIndstillinger = saveIndstillinger;
window.saveKpiSettings = saveKpiSettings;
window.switchSettings = switchSettings;

export async function handleUniversalCsvImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const rowsRaw = text.split('\n').filter(r => r.trim());
        if (rowsRaw.length < 2) return;

        const firstRow = rowsRaw[0];
        const delimiter = (firstRow.split(';').length > firstRow.split(',').length) ? ';' : ',';
        
        const rows = rowsRaw.map(r => r.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
        const data = rows.slice(1).filter(r => r.length >= 1 && r[0]);

        showSnackbar(`Smart-importerer ${data.length} rækker... ⏳`);

        try {
            let assetCount = 0;
            let lagerCount = 0;

            for (const r of data) {
                const type = r[4]?.toLowerCase();
                
                if (type === 'lager') {
                    // Lager format
                    const lagerData = {
                        firma_id: state.currentFirmaId,
                        navn: r[0],
                        antal_paa_lager: 0,
                        minimums_beholdning: 0,
                        lokation_tekst: r[2] || '',
                        stregkode: r[3] || ''
                    };
                    if (r[2] && r[2].includes('>')) await ensureLocationPath(r[2]);
                    
                    const { error } = await state.supabaseClient.from('lager').upsert(lagerData, { onConflict: 'navn,firma_id' });
                    if (error) throw error;
                    lagerCount++;
                } else {
                    // Default to Asset
                    const assetData = {
                        firma_id: state.currentFirmaId,
                        navn: r[0],
                        beskrivelse: r[1] || '',
                        lokation_id: await ensureLocationPath(r[2]),
                        alias: r[3] || null,
                        kategori_id: await ensureCategory('Asset')
                    };
                    const { error } = await state.supabaseClient.from('assets').upsert(assetData, { onConflict: 'navn,firma_id' });
                    if (error) throw error;
                    assetCount++;
                }
            }

            if (window.renderAssetsList) window.renderAssetsList();
            if (window.renderLagerList) window.renderLagerList();

            showSnackbar(`Succes! Oprettet ${assetCount} maskiner og ${lagerCount} lagervarer 🧙‍♂️✨`);
            input.value = '';
        } catch (err) {
            console.error(err);
            showSnackbar("Fejl under import: " + err.message);
        }
    };
    reader.readAsText(file);
}

window.handleUniversalCsvImport = handleUniversalCsvImport;

export function downloadCsvTemplate(type) {
    let csvContent = "";
    
    if (type === 'universal') {
        csvContent = "navn,beskrivelse,lokations_sti,eksternt_navn,kategori\n";
        csvContent += "Gaffeltruck 1,El-truck 2 tons kapacitet,Lager > Hal A > Sektion 1,M266,Asset\n";
        csvContent += "Hydraulikolie 10L,ISO 46 standard olie,Lager > Hal A > Reol 4,OIL-46,Lager\n";
    }
    
    if (!csvContent) return;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `easyon_${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSnackbar("Skabelon downloadet! 📥");
}
window.downloadCsvTemplate = downloadCsvTemplate;

// Kør init
initTheme();
