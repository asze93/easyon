/**
 * EASYON DIAMOND LOCATION MANAGER (v84.0) 📍🏢🚀
 * Alt omkring afdelinger, områder og lokationer.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, openModal, closeAllModals, setLoading, showMobileDetail } from '../ui/ui-helpers.js';
import { fetchLocations, fetchStats } from '../services/api-service.js';

export function selectLocation(l) {
    document.querySelectorAll('#locationsList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`loc-item-${l.id}`)?.classList.add('active');
    const preview = document.getElementById('locationsPreview'); if (!preview) return;

    preview.innerHTML = `
        <!-- Mobile Back Button -->
        <div class="mobile-back-btn" onclick="hideMobileDetail('locations')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <div class="breadcrumb" style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
            ${buildPath(l)}
        </div>
        <h1 style="font-size:32px; font-weight:800; margin-top:0;">${l.navn}</h1>
        <p class="text-muted">${l.beskrivelse || 'Ingen beskrivelse.'}</p>
        <div style="display:flex; gap:12px; margin-top:30px;">
            <button class="btn-primary" onclick='editLocation(${JSON.stringify(l).replace(/'/g, "&#39;")})'>📝 Rediger</button>
            <button class="btn-outline" onclick="confirmDelete('${l.id}', 'lokationer')">🗑️ Slet</button>
        </div>
    `;
}

function buildPath(l) {
    if (!l.parent_id) return "Hovedlokation";
    const parent = state.allLocations.find(p => p.id === l.parent_id);
    if (!parent) return "Ukendt hierarki";
    return (parent.parent_id ? buildPath(parent) + " > " : "") + parent.navn;
}


export function editLocation(l) {
    document.getElementById('locId').value = l.id;
    document.getElementById('locName').value = l.navn;
    document.getElementById('locDesc').value = l.beskrivelse || '';
    document.getElementById('locParent').value = l.parent_id || '';
    openModal('modal-location');
}

export async function handleLocationSubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('locId').value;
    const data = {
        firma_id: state.currentFirmaId,
        navn: document.getElementById('locName').value,
        beskrivelse: document.getElementById('locDesc').value,
        parent_id: document.getElementById('locParent').value || null
    };
    try {
        if (id) await state.supabaseClient.from('lokationer').update(data).eq('id', id);
        else await state.supabaseClient.from('lokationer').insert(data);
        fetchLocations(); 
        closeAllModals(); 
        showSnackbar("Lokation gemt! 💎"); 
    } catch (err) {
        showSnackbar("Kunne ikke gemme lokation: " + err.message);
    } finally {
        setLoading(btn, false);
    }
}

// EXPOSE GLOBALS for Legacy HTML support
window.selectLocation = selectLocation;
window.editLocation = editLocation;
window.handleLocationSubmit = handleLocationSubmit;
