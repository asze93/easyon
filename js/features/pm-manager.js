/**
 * EASYON DIAMOND PM MANAGER (v86.3) 🛰️🚜
 * Avanceret automatik med SOP, Kategori og Billede-integration.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, closeAllModals } from '../ui/ui-helpers.js';

export async function fetchPmPlans() {
    const list = document.getElementById('pmList');
    if (!list) return;
    
    list.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
    
    try {
        const { data, error } = await state.supabaseClient
            .from('pm_planer')
            .select('*, assets(navn, lokation_id, lokationer(navn)), kategorier(navn, farve), procedurer(titel)')
            .eq('firma_id', state.currentFirmaId)
            .order('naeste_service_dato', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Ingen serviceplaner fundet. Klik på "+ Planlæg" for at starte 🛠️</div>';
            return;
        }

        list.innerHTML = '';
        data.forEach(plan => {
            const nextDate = new Date(plan.naeste_service_dato).toLocaleDateString();
            const intervalText = `${plan.interval_vaerdi} ${plan.interval_type === 'days' ? 'dag(e)' : (plan.interval_type === 'weeks' ? 'uge(r)' : (plan.interval_type === 'months' ? 'måned(er)' : 'år'))}`;
            
            const div = document.createElement('div');
            div.className = 'list-card-item';
            div.id = `pm-item-${plan.id}`;
            div.onclick = () => previewPmPlan(plan);
            
            const catBadge = plan.kategorier ? `
                <div style="display:inline-flex; align-items:center; gap:6px; background:#${plan.kategorier.farve}20; color:#${plan.kategorier.farve}; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800; text-transform:uppercase;">
                    <div style="width:6px; height:6px; background:#${plan.kategorier.farve}; border-radius:50%;"></div>
                    ${plan.kategorier.navn}
                </div>
            ` : '';

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                            <div style="font-weight:800; color:white;">${plan.titel}</div>
                            ${catBadge}
                        </div>
                        <div style="font-size:12px; color:var(--text-muted);">${plan.assets?.navn || 'Ingen maskine'} • Hver ${intervalText}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; font-weight:800; color:var(--primary); text-transform:uppercase;">Næste Service</div>
                        <div style="font-weight:700; font-size:14px; color:white;">${nextDate}</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        showSnackbar("Kunne ikke hente serviceplaner", err.code);
    }
}

export function previewPmPlan(plan) {
    const preview = document.getElementById('pmPreview');
    if (!preview) return;
    
    const intervalText = `${plan.interval_vaerdi} ${plan.interval_type === 'days' ? 'dag(e)' : (plan.interval_type === 'weeks' ? 'uge(r)' : (plan.interval_type === 'months' ? 'måned(er)' : 'år'))}`;

    preview.innerHTML = `
        <div style="padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px;">
                <div style="flex:1;">
                    <h2 style="font-size:32px; font-weight:800; margin-bottom:8px;">Plan: ${plan.titel}</h2>
                    <p class="text-muted">
                        Asset: <strong>${plan.assets?.navn || '-'}</strong> | 
                        Lokation: <strong>${plan.assets?.lokationer?.navn || 'Ukendt'}</strong>
                    </p>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn-outline" onclick="deletePmPlan('${plan.id}')">Slet Plan</button>
                    <button class="btn-primary" onclick="showSnackbar('Planen er aktiv og kører automatisk 🛰️')">Kører selv</button>
                </div>
            </div>

            ${plan.billede_url ? `
                <div style="margin-bottom:30px; border-radius:18px; overflow:hidden; border:2px solid var(--border); height:150px; background:var(--bg-card); display:flex; align-items:center; justify-content:center;">
                    <img src="${plan.billede_url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/600x200?text=Billede+ikke+fundet'">
                </div>
            ` : ''}
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px; margin-top:20px;">
                <div class="stat-card" style="background:rgba(255,255,255,0.03);">
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Service Interval</div>
                    <div style="font-size:20px; font-weight:800; color:white;">Hver ${intervalText}</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.03);">
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Næste Aktivering</div>
                    <div style="font-size:20px; font-weight:800; color:var(--primary);">${new Date(plan.naeste_service_dato).toLocaleDateString()}</div>
                </div>
            </div>

            <div style="margin-top:40px; display:grid; grid-template-columns:1fr 1fr; gap:24px;">
                <div>
                    <h4 style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:12px;">Tilknyttet SOP Guide</h4>
                    <div style="background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); padding:16px; border-radius:12px; color:white; font-weight:700;">
                        ${plan.procedurer ? `🧠 ${plan.procedurer.titel}` : 'Ingen guide tilknyttet'}
                    </div>
                </div>
                <div>
                    <h4 style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:12px;">Kategori</h4>
                    <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; font-weight:700;">
                        ${plan.kategorier ? plan.kategorier.navn : 'Standard'}
                    </div>
                </div>
            </div>

            <div style="margin-top:40px;">
                <h4 style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:12px;">Instruktioner</h4>
                <div style="background:rgba(255,255,255,0.02); padding:20px; border-radius:14px; border:1px solid var(--border); line-height:1.6; font-size:14px;">
                    ${plan.beskrivelse || 'Ingen instruktioner.'}
                </div>
            </div>
        </div>
    `;
}

export async function preparePmModal() {
    const assetSelect = document.getElementById('pmAssetSelect');
    const catSelect = document.getElementById('pmKategoriSelect');
    const sopSelect = document.getElementById('pmSopSelect');
    
    if (!assetSelect) return;
    
    // Load Assets
    try {
        const { data: assets } = await state.supabaseClient.from('assets').select('id, navn').eq('firma_id', state.currentFirmaId).order('navn');
        assetSelect.innerHTML = '<option value="">Vælg maskine / udstyr...</option>';
        assets?.forEach(a => assetSelect.innerHTML += `<option value="${a.id}">${a.navn}</option>`);

        // Load Categories
        const { data: cats } = await state.supabaseClient.from('kategorier').select('id, navn').eq('firma_id', state.currentFirmaId).order('navn');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Standard (Ingen kategori)</option>';
            cats?.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.navn}</option>`);
        }

        // Load SOPs
        const { data: sops } = await state.supabaseClient.from('procedurer').select('id, titel').eq('firma_id', state.currentFirmaId).order('titel');
        if (sopSelect) {
            sopSelect.innerHTML = '<option value="">Ingen guide tilknyttet</option>';
            sops?.forEach(s => sopSelect.innerHTML += `<option value="${s.id}">${s.titel}</option>`);
        }

        // Live Preview Setup (Updated for Photo Zone)
        window.promptPmImageUrl = () => {
            const current = document.getElementById('pmImageUrl').value;
            const url = prompt("Indtast URL til referencebillede:", current);
            if (url !== null) {
                document.getElementById('pmImageUrl').value = url;
                updatePmPhotoPreview(url);
            }
        };

        window.updatePmPhotoPreview = (url) => {
            const placeholder = document.getElementById('pmPhotoPlaceholder');
            const preview = document.getElementById('pmPhotoPreview');
            if (url) {
                placeholder.style.display = 'none';
                preview.style.display = 'block';
                preview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:16px;" onerror="this.src='https://via.placeholder.com/400x150?text=Ugyldig+URL'">`;
            } else {
                placeholder.style.display = 'flex';
                preview.style.display = 'none';
            }
        };
        
        // Reset preview if new
        updatePmPhotoPreview('');
    } catch (err) { console.error("PM Modal Load Error:", err); }
}

export async function handlePmSubmit(e) {
    if (e) e.preventDefault();
    
    const payload = {
        firma_id: state.currentFirmaId,
        titel: document.getElementById('pmTitle').value,
        asset_id: document.getElementById('pmAssetSelect').value,
        kategori_id: document.getElementById('pmKategoriSelect').value || null,
        sop_id: document.getElementById('pmSopSelect').value || null,
        interval_vaerdi: parseInt(document.getElementById('pmIntervalValue').value),
        interval_type: document.getElementById('pmIntervalType').value,
        naeste_service_dato: document.getElementById('pmNextDate').value,
        beskrivelse: document.getElementById('pmDesc').value,
        billede_url: document.getElementById('pmImageUrl').value || null,
        aktiv: true
    };
    
    try {
        const { error } = await state.supabaseClient.from('pm_planer').insert(payload);
        if (error) throw error;
        
        showSnackbar("Super-Integration Gemt! 🛰️🚀");
        closeAllModals();
        fetchPmPlans();
        
        // Instant Audit 🛰️
        setTimeout(() => checkAndProcessPm(), 500); 
    } catch (err) { showSnackbar("Fejl ved gemning", err.code); }
}

export async function checkAndProcessPm() {
    if (!state.currentFirmaId) return;

    try {
        // Fix: Use local date to avoid UTC Midnight Displacement
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localDate = new Date(now.getTime() - offset).toISOString().split('T')[0];
        
        console.log(`--- [PM AUDIT] Local Today: ${localDate} --- 🛰️`);

        const { data: duePlans, error: pullErr } = await state.supabaseClient
            .from('pm_planer')
            .select('*, assets(lokation_id)')
            .eq('firma_id', state.currentFirmaId)
            .eq('aktiv', true)
            .lte('naeste_service_dato', localDate);

        if (pullErr) throw pullErr;
        if (!duePlans || duePlans.length === 0) {
            console.log("No PM tasks due. System stable. 💎");
            return;
        }

        for (const plan of duePlans) {
            // Opret opgave med fuld integration context
            const { error: tErr } = await state.supabaseClient.from('opgaver').insert({
                firma_id: plan.firma_id,
                titel: `[PLANLAGT] ${plan.titel}`,
                beskrivelse: `OPRETTET AUTOMATISK AF SERVICEPLAN: ${plan.titel}\n---\n${plan.beskrivelse || "Følg den tilknyttede SOP guide."}`,
                status: 'Venter',
                prioritet: plan.prioritet || 1,
                asset_id: plan.asset_id,
                sop_id: plan.sop_id,
                lokation_id: plan.assets?.lokation_id || null, // Auto-derive location
            });

            if (tErr) throw tErr;

            const nextDateObj = new Date(plan.naeste_service_dato);
            if (plan.interval_type === 'days') nextDateObj.setDate(nextDateObj.getDate() + plan.interval_vaerdi);
            else if (plan.interval_type === 'weeks') nextDateObj.setDate(nextDateObj.getDate() + (plan.interval_vaerdi * 7));
            else if (plan.interval_type === 'months') nextDateObj.setMonth(nextDateObj.getMonth() + plan.interval_vaerdi);
            else if (plan.interval_type === 'years') nextDateObj.setFullYear(nextDateObj.getFullYear() + plan.interval_vaerdi);
            
            await state.supabaseClient.from('pm_planer').update({ 
                sidste_service_dato: plan.naeste_service_dato,
                naeste_service_dato: nextDateObj.toISOString().split('T')[0]
            }).eq('id', plan.id);
            
            console.log(`Generated task for: ${plan.titel} ✅`);
        }

        showSnackbar(`${duePlans.length} automatiske opgaver er sat i gang! 🚜⚡`);
        if (typeof window.fetchTasks === 'function') window.fetchTasks();
    } catch (err) { console.warn("PM Automation Error:", err); }
}

export async function deletePmPlan(id) {
    if (!confirm("Slet plan?")) return;
    try {
        await state.supabaseClient.from('pm_planer').delete().eq('id', id);
        showSnackbar("Plan slettet.");
        fetchPmPlans();
        const preview = document.getElementById('pmPreview');
        if (preview) preview.innerHTML = '<div class="detail-view-empty"><h3>Vælg en plan</h3></div>';
    } catch (err) { showSnackbar("Fejl ved sletning"); }
}

window.handlePmSubmit = handlePmSubmit;
window.preparePmModal = preparePmModal;
window.deletePmPlan = deletePmPlan;
window.fetchPmPlans = fetchPmPlans;
