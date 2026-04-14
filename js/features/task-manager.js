/**
 * EASYON DIAMOND TASK MANAGER (v84.0) 🚀📋
 * Alt omkring opgaver, anmodninger og vedligeholdelse.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, openModal, closeAllModals, setLoading } from '../ui/ui-helpers.js';
import { fetchStats, fetchTasks, fetchRequests } from '../services/api-service.js';

export async function handleTaskSubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('taskId').value;
    const data = {
        firma_id: state.currentFirmaId,
        titel: document.getElementById('taskTitle').value,
        beskrivelse: document.getElementById('taskDesc').value,
        prioritet: parseInt(document.getElementById('taskPriority').value),
        asset_id: document.getElementById('taskAssetId').value || null,
        lokation_id: document.getElementById('taskLocId').value || null, // FIX: Inclusion of lokation_id 💎
        opgavetype: document.getElementById('taskType').value,
        fagomraade: document.getElementById('taskSkill').value
    };

    if (id) await state.supabaseClient.from('opgaver').update(data).eq('id', id);
    else await state.supabaseClient.from('opgaver').insert(data);

    fetchTasks(); 
    fetchStats(); // Update dashboard numbers 📊
    closeAllModals(); 
    showSnackbar("Opgave gemt! 💎"); setLoading(btn, false);
}

export function selectTask(t) {
    document.querySelectorAll('#tasksList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`task-item-${t.id}`)?.classList.add('active');
    const preview = document.getElementById('tasksPreview'); if (!preview) return;

    // Trigger mobile drill-down
    showMobileDetail('tasks');

    preview.innerHTML = `
        <!-- Mobile Back Button -->
        <div class="mobile-back-btn" onclick="hideMobileDetail('tasks')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h1 style="font-size:28px; font-weight:800; margin-bottom:8px;">${t.titel}</h1>
            <div class="badge prio-${t.prioritet == 3 ? 'høj' : (t.prioritet == 2 ? 'middel' : 'lav')}">${t.prioritet == 3 ? 'Høj Priortet' : (t.prioritet == 2 ? 'Middel Prioritet' : 'Lav Prioritet')}</div>
        </div>
        <p class="text-muted" style="font-size:16px; margin-top:12px;">${t.beskrivelse || 'Ingen beskrivelse.'}</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:30px; background:rgba(255,255,255,0.03); padding:24px; border-radius:20px; border:1px solid var(--border);">
            <div>
                <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">🚜 Maskine</div>
                <div style="font-weight:700; color:white;">${t.assets?.navn || 'Ingen maskine'}</div>
            </div>
            <div>
                <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">📍 Lokation</div>
                <div style="font-weight:700; color:white;">${t.lokationer?.navn || 'Ingen lokation'}</div>
            </div>
            <div>
                <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">👷 Tildelt / Oprettet af</div>
                <div style="font-weight:700; color:white;">${t.tildelt_titel || 'Ikke tildelt'}</div>
            </div>
            <div>
                <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">📅 Status</div>
                <div style="font-weight:700; color:var(--primary);">${t.status || 'Ny'}</div>
            </div>
            <div>
                <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">🔨 Opgavetype</div>
                <div style="font-weight:700; color:white;">${t.opgavetype || 'Vedligehold'}</div>
            </div>
        </div>

        <div style="display:flex; gap:12px; margin-top:30px;">
            <button class="btn-primary" onclick='editTask(${JSON.stringify(t).replace(/'/g, "&#39;")})'>📝 Rediger</button>
            <button class="btn-outline" onclick="confirmDelete('${t.id}', 'opgaver')">🗑️ Slet</button>
        </div>
    `;
}

export function selectRequest(r) {
    document.querySelectorAll('#requestsList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`req-item-${r.id}`)?.classList.add('active');
    const preview = document.getElementById('requestsPreview'); if (!preview) return;

    // Trigger mobile drill-down
    showMobileDetail('requests');

    preview.innerHTML = `
        <!-- Mobile Back Button -->
        <div class="mobile-back-btn" onclick="hideMobileDetail('requests')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <h1 style="font-size:28px; font-weight:800; margin-bottom:12px;">${r.titel}</h1>
        <p class="text-muted" style="font-size:16px;">${r.beskrivelse || 'Ingen yderligere beskrivelse fra rekvirent.'}</p>
        
        <div style="margin-top:24px; padding:20px; background:rgba(59,130,246,0.1); border-radius:16px; border:1px solid rgba(59,130,246,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase;">Anmoder</div>
                    <div style="font-weight:700;">${r.opretter_navn || 'Anonym medarbejder'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase;">Maskine</div>
                    <div style="font-weight:700;">${r.assets?.navn || 'Ukendt'}</div>
                </div>
            </div>
        </div>

        <div style="display:flex; gap:12px; margin-top:30px;">
            <button class="btn-primary" onclick="convertRequestToTask('${r.id}')">🚀 Godkend & Opret Opgave</button>
            <button class="btn-outline" onclick="confirmDelete('${r.id}', 'anmodninger')">Afvis</button>
        </div>
    `;
}

export function editTask(t) {
    document.getElementById('taskId').value = t.id;
    document.getElementById('taskTitle').value = t.titel;
    document.getElementById('taskDesc').value = t.beskrivelse || '';
    document.getElementById('taskPriority').value = t.prioritet || 1;
    setTaskPriority(t.prioritet || 1);
    
    // Populate Asset 🚜
    document.getElementById('taskAssetId').value = t.asset_id || '';
    document.getElementById('taskAssetSearch').value = t.assets?.navn || '';
    
    // Populate Location 📍
    document.getElementById('taskLocId').value = t.lokation_id || '';
    document.getElementById('taskLocSearch').value = t.lokationer?.navn || ''; 
    
    if(t.opgavetype) document.getElementById('taskType').value = t.opgavetype;
    if(t.fagomraade) document.getElementById('taskSkill').value = t.fagomraade;
    
    openModal('modal-task');
}

export async function convertRequestToTask(reqId) {
    showSnackbar("Konverterer anmodning... 🚀");
    const { data: r } = await state.supabaseClient.from('anmodninger').select('*').eq('reqId').maybeSingle();
    if (!r) return;

    const taskData = {
        firma_id: state.currentFirmaId,
        titel: r.titel,
        beskrivelse: r.beskrivelse,
        asset_id: r.asset_id,
        prioritet: 2
    };

    const { error } = await state.supabaseClient.from('opgaver').insert(taskData);
    if (!error) {
        await state.supabaseClient.from('anmodninger').delete().eq('id', reqId);
        fetchTasks(); fetchRequests(); fetchStats();
        showSnackbar("Konverteret til opgave! 💎");
    }
}

export function setTaskPriority(val) {
    document.getElementById('taskPriority').value = val;
    document.querySelectorAll('.prio-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.prio == val));
}

export function simulatePhotoUpload() {
    showSnackbar("📸 Simulere kamera-adgang... (Billede vedhæftet)");
}

// EXPOSE GLOBALS for Legacy HTML support
window.selectTask = selectTask;
window.selectRequest = selectRequest;
window.editTask = editTask;
window.handleTaskSubmit = handleTaskSubmit;
window.setTaskPriority = setTaskPriority;
window.simulatePhotoUpload = simulatePhotoUpload;
window.convertRequestToTask = convertRequestToTask;
window.confirmDelete = async (id, table) => {
    if (confirm("Er du sikker på, at du vil slette dette element?")) {
        await state.supabaseClient.from(table).delete().eq('id', id);
        
        // Dynamisk import af api-service for at få adgang til fetch-funktioner for specifikke tabeller
        const api = await import('../services/api-service.js');
        
        if (table === 'opgaver') api.fetchTasks();
        if (table === 'anmodninger') api.fetchRequests();
        if (table === 'brugere') api.fetchTeam();
        if (table === 'lokationer') api.fetchLocations();
        if (table === 'kategorier') api.fetchCategories();
        
        if (table === 'assets') {
            if (window.renderAssetsList) window.renderAssetsList();
        }
        if (table === 'lager') {
            if (window.renderLagerList) window.renderLagerList();
        }
        if (table === 'procedurer') {
            if (window.fetchProcedures) window.fetchProcedures(); // Ligger oftest i sop-builder.js
        }
        
        api.fetchStats();
        showSnackbar("Element slettet!");
        
        // Ryd eventuel form/preview for slettede element
        const previews = { 
            'lager': 'lagerPreview', 
            'assets': 'assetPreview', 
            'opgaver': 'tasksPreview', 
            'anmodninger': 'requestsPreview' 
            // brugere/lokationer/kategorier renderes direkte i indstillings-tabeller
        };
        if (previews[table]) {
            const p = document.getElementById(previews[table]);
            if (p) p.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.5;">Vælg et emne til venstre for at se detaljer</div>';
        }
    }
};

// ASSET + LOKATION AUTOCOMPLETE til Opret Opgave
export function initTaskSearch() {
    // --- MASKINE SØGNING ---
    const assetInput = document.getElementById('taskAssetSearch');
    const assetSugg = document.getElementById('assetSuggestions');
    if (assetInput && assetSugg) {
        assetInput.addEventListener('input', () => {
            const q = assetInput.value.toLowerCase();
            const matches = state.allAssets.filter(a => 
                a.navn?.toLowerCase().includes(q) || 
                a.short_id?.toLowerCase().includes(q) ||
                a.alias?.toLowerCase().includes(q)
            );
            if (!q || matches.length === 0) { assetSugg.style.display = 'none'; return; }
            assetSugg.innerHTML = '';
            matches.slice(0, 8).forEach(a => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${a.navn}</strong>
                        <span style="font-size:10px; font-weight:800; background:var(--primary); color:white; padding:2px 6px; border-radius:4px;">${a.alias || a.short_id || ''}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">📍 ${a.lokationer?.navn || ''} ${a.alias ? '• ID: ' + a.short_id : ''}</div>
                `;
                div.onclick = () => {
                    // Udfyld maskine
                    assetInput.value = a.navn;
                    document.getElementById('taskAssetId').value = a.id;
                    assetSugg.style.display = 'none';
                    // Auto-udfyld lokation hvis maskinen har en
                    if (a.lokation_id && a.lokationer?.navn) {
                        const locInput = document.getElementById('taskLocSearch');
                        const locId = document.getElementById('taskLocId');
                        if (locInput) locInput.value = a.lokationer.navn;
                        if (locId) locId.value = a.lokation_id;
                    }
                };
                assetSugg.appendChild(div);
            });
            assetSugg.style.display = 'block';
        });
        document.addEventListener('click', (e) => {
            if (!assetInput.contains(e.target) && !assetSugg.contains(e.target)) assetSugg.style.display = 'none';
        });
    }

    // --- LOKATION SØGNING ---
    const locInput = document.getElementById('taskLocSearch');
    const locSugg = document.getElementById('locationSuggestions');
    if (locInput && locSugg) {
        locInput.addEventListener('input', () => {
            const q = locInput.value.toLowerCase();
            const matches = state.allLocations.filter(l => l.navn?.toLowerCase().includes(q));
            if (!q || matches.length === 0) { locSugg.style.display = 'none'; return; }
            locSugg.innerHTML = '';
            matches.slice(0, 8).forEach(l => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<strong>${l.navn}</strong>`;
                div.onclick = () => {
                    locInput.value = l.navn;
                    document.getElementById('taskLocId').value = l.id;
                    locSugg.style.display = 'none';
                };
                locSugg.appendChild(div);
            });
            locSugg.style.display = 'block';
        });
        document.addEventListener('click', (e) => {
            if (!locInput.contains(e.target) && !locSugg.contains(e.target)) locSugg.style.display = 'none';
        });
    }
}
window.initTaskSearch = initTaskSearch;
