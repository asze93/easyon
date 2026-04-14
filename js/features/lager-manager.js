/**
 * EASYON DIAMOND LAGER MANAGER (v84.1) 📦
 * Alt omkring reservedele og lagerstyring.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, closeAllModals, setLoading, openModal, showMobileDetail } from '../ui/ui-helpers.js';
import { ensureLocationPath, fetchLager, fetchStats, exportToCsv } from '../services/api-service.js';

export async function handleLagerSubmit(e) {
    if(e) e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    
    const id = document.getElementById('lagerId')?.value;
    const data = {
        firma_id: state.currentFirmaId,
        navn: document.getElementById('lagerNavn')?.value || 'Ny Vare',
        antal_paa_lager: parseInt(document.getElementById('lagerAntal')?.value || '0'),
        minimums_beholdning: parseInt(document.getElementById('lagerMin')?.value || '0'),
        stregkode: document.getElementById('lagerCode')?.value || '',
        lokation_tekst: document.getElementById('lagerLokation')?.value || ''
    };

    try {
        if (id) await state.supabaseClient.from('lager').update(data).eq('id', id);
        else await state.supabaseClient.from('lager').insert(data);
        
        if (window.renderLagerList) window.renderLagerList();
        else fetchLager(); // Fallback
        
        fetchStats(); closeAllModals(); showSnackbar("Vare opdateret på lager! 💎");
    } catch(err) {
        showSnackbar("Fejl ved lagring!");
    }
    setLoading(btn, false);
}

export function selectLagerItem(item) {
    document.querySelectorAll('#lagerList .list-card-item').forEach(el => el.classList.remove('active'));
    const preview = document.getElementById('lagerPreview'); if (!preview) return;

    showMobileDetail('lager');

    preview.innerHTML = `
        <div class="mobile-back-btn" onclick="hideMobileDetail('lager')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <h1 style="font-size:32px; font-weight:800;">${item.navn}</h1>
        <div style="margin-top:20px; background:rgba(255,255,255,0.03); padding:24px; border-radius:20px; border:1px solid var(--border);">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">📦 Antal på lager</div>
                    <div style="font-size:24px; font-weight:800; color:var(--primary);">${item.antal_paa_lager || 0}</div>
                </div>
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">🚨 Min. Beholdning</div>
                    <div style="font-size:24px; font-weight:800; color:var(--danger);">${item.minimums_beholdning || 0}</div>
                </div>
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">📍 Lokation</div>
                    <div style="font-size:18px; font-weight:700;">${item.lokation_tekst || 'Ukendt'}</div>
                </div>
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">📑 Item ID / Short ID</div>
                    <div style="font-size:18px; font-weight:700; font-family:monospace; color:var(--primary);">${item.short_id || '-'}</div>
                </div>
                <div>
                    <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">🏷️ Stregkode / SSCC</div>
                    <div style="font-size:18px; font-weight:700; font-family:monospace;">${item.stregkode || '-'}</div>
                </div>
            </div>
        </div>

        <div style="display:flex; gap:12px; margin-top:30px;">
            <button class="btn-primary" onclick='editLager(${JSON.stringify(item).replace(/'/g, "&#39;")})'>📝 Rediger</button>
            <button class="btn-outline" onclick="confirmDelete('${item.id}', 'lager')">🗑️ Slet</button>
        </div>
    `;
}

export function editLager(item) {
    document.getElementById('lagerId').value = item.id;
    document.getElementById('lagerNavn').value = item.navn;
    document.getElementById('lagerAntal').value = item.antal_paa_lager || 0;
    document.getElementById('lagerMin').value = item.minimums_beholdning || 0;
    document.getElementById('lagerCode').value = item.stregkode || '';
    document.getElementById('lagerLokation').value = item.lokation_tekst || '';
    openModal('modal-lager');
}

export async function handleLagerCsvImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const rowsRaw = text.split('\n').filter(r => r.trim());
        if (rowsRaw.length < 2) return;

        const delimiter = (rowsRaw[0].split(';').length > rowsRaw[0].split(',').length) ? ';' : ',';
        const rows = rowsRaw.map(r => r.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
        const data = rows.slice(1).filter(r => r.length >= 1 && r[0]);

        showSnackbar(`Behandler ${data.length} lagervarer... ⏳`);

        try {
            const itemsToInsert = await Promise.all(data.map(async r => {
                // Enterprise: Process location path if it looks like a path
                if (r[3] && r[3].includes('>')) await ensureLocationPath(r[3]);
                
                return {
                    firma_id: state.currentFirmaId,
                    navn: r[0],
                    antal_paa_lager: parseInt(r[1]) || 0,
                    minimums_beholdning: parseInt(r[2]) || 0,
                    lokation_tekst: r[3] || '',
                    stregkode: r[4] || ''
                };
            }));

            const { error } = await state.supabaseClient.from('lager').insert(itemsToInsert);
            if (error) throw error;

            fetchLager();
            fetchStats();
            showSnackbar(`Import succes! ${data.length} varer tilføjet. 📦💎`);
            input.value = '';
        } catch (err) {
            console.error(err);
            showSnackbar("Fejl under import: " + err.message);
        }
    };
    reader.readAsText(file);
}

export async function renderLagerList() {
    if (!state.currentFirmaId) return;
    const list = document.getElementById('lagerList'); if (!list) return;
    
    if (!list.innerHTML) list.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.5;">Henter lager...</div>';

    try {
        const data = await fetchLager();
        list.innerHTML = "";
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen varer på lager.</p>';
        } else {
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'list-card-item';
                div.onclick = () => { if (window.selectLagerItem) window.selectLagerItem(item); };
                const lowStock = item.antal_paa_lager <= item.minimums_beholdning ? 'color:var(--danger); font-weight:800;' : '';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:800;">${item.navn}</div>
                        <div style="font-size:10px; font-weight:900; background:rgba(255,255,255,0.05); color:white; padding:2px 6px; border-radius:4px;">${item.short_id || ''}</div>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted);">
                        <span style="${lowStock}">Antal: ${item.antal_paa_lager || 0}</span> (Min: ${item.minimums_beholdning || 0}) • 📍 ${item.lokation_tekst || 'Ukendt'}
                    </div>
                `;
                list.appendChild(div);
            });
        }
    } catch (e) { console.warn("Lager Render Error:", e); }
}

// EXPOSE GLOBALS
window.handleLagerSubmit = handleLagerSubmit;
window.selectLagerItem = selectLagerItem;
window.editLager = editLager;
window.handleLagerCsvImport = handleLagerCsvImport;
window.exportToCsv = exportToCsv;
window.renderLagerList = renderLagerList;

