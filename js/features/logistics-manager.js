/**
 * EASYON DIAMOND LOGISTICS MANAGER (v86.1) 🚢📦
 * Håndterer SSCC-forsendelser og logistik-manifest.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, closeAllModals } from '../ui/ui-helpers.js';

let currentSsccManifest = [];

export async function fetchSsccShipments() {
    const list = document.getElementById('ssccList');
    if (!list) return;
    
    list.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
    
    try {
        const { data, error } = await state.supabaseClient
            .from('forsendelser')
            .select('*, forsendelse_indhold(*, lager(navn))')
            .eq('firma_id', state.currentFirmaId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Ingen forsendelser fundet. Opret din første pallet ovenfor 🚢</div>';
            return;
        }

        list.innerHTML = '';
        data.forEach(ship => {
            const itemCount = ship.forsendelse_indhold?.length || 0;
            const statusColor = ship.status === 'modtaget' ? 'var(--success)' : 'var(--primary)';
            const div = document.createElement('div');
            div.className = 'list-item';
            div.onclick = () => previewSsccShipment(ship);
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; font-size:15px; color:white;">${ship.sscc_kode}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${ship.leverandoer || 'Ukendt leverandør'}</div>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge" style="background:rgba(255,255,255,0.05); color:${statusColor}; border:1px solid ${statusColor}44;">${ship.status.toUpperCase()}</span>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${itemCount} varer</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        showSnackbar("Kunne ikke hente forsendelser", err.code);
    }
}

export function previewSsccShipment(ship) {
    const preview = document.getElementById('ssccPreview');
    if (!preview) return;
    
    const contents = ship.forsendelse_indhold?.map(item => `
        <div style="display:flex; justify-content:space-between; padding:12px; background:rgba(255,255,255,0.02); border-radius:10px; border:1px solid var(--border); margin-bottom:8px;">
            <span style="font-weight:600;">${item.lager?.navn || 'Ukendt vare'}</span>
            <span style="color:var(--primary); font-weight:800;">${item.antal} stk</span>
        </div>
    `).join('') || '<p class="text-muted">Ingen varer registreret.</p>';

    preview.innerHTML = `
        <div style="padding:40px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px;">
                <div>
                    <h2 style="font-size:32px; font-weight:800; margin-bottom:8px;">Palle: ${ship.sscc_kode}</h2>
                    <p class="text-muted">Leverandør: <strong>${ship.leverandoer || '-'}</strong> • Status: <span style="color:var(--primary); font-weight:700;">${ship.status}</span></p>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn-outline" onclick="deleteShipment('${ship.id}')">Slet</button>
                    ${ship.status === 'afventer' ? `<button class="btn-primary" onclick="showSnackbar('Scan varen i appen for at modtage 📱')">Modtag i App</button>` : ''}
                </div>
            </div>
            
            <div style="margin-top:40px;">
                <h4 style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:20px;">Indhold af forsendelse</h4>
                ${contents}
            </div>
        </div>
    `;
}

export async function prepareSsccModal() {
    currentSsccManifest = [];
    renderSsccManifest();
    
    const select = document.getElementById('sscc_add_item_id');
    if (!select) return;
    
    select.innerHTML = '<option value="">Henter reservedele...</option>';
    
    try {
        const { data } = await state.supabaseClient.from('lager').select('id, navn').eq('firma_id', state.currentFirmaId).order('navn');
        select.innerHTML = '<option value="">Vælg vare...</option>';
        data?.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.innerText = item.navn;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load inventory for SSCC modal:", err);
    }
}

export function addSsccItemToList() {
    const select = document.getElementById('sscc_add_item_id');
    const qtyInput = document.getElementById('sscc_add_item_qty');
    
    if (!select.value) { showSnackbar("Vælg venligst en vare."); return; }
    
    const itemId = select.value;
    const itemName = select.options[select.selectedIndex].text;
    const qty = parseInt(qtyInput.value) || 1;
    
    currentSsccManifest.push({ lager_id: itemId, navn: itemName, antal: qty });
    renderSsccManifest();
}

export function renderSsccManifest() {
    const container = document.getElementById('sscc_items_container');
    if (!container) return;
    
    if (currentSsccManifest.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px; font-size:13px; font-style:italic;">Ingen varer tilføjet på pallen endnu.</p>';
        return;
    }
    
    container.innerHTML = '';
    currentSsccManifest.forEach((item, idx) => {
        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:10px 16px; border-radius:10px;";
        div.innerHTML = `
            <div>
                <span style="font-weight:700; color:white;">${item.navn}</span>
                <span style="color:var(--primary); font-weight:800; margin-left:12px;">${item.antal} stk</span>
            </div>
            <button class="sscc-item-remove" data-idx="${idx}" style="background:transparent; border:none; color:var(--danger); cursor:pointer;">✕</button>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.sscc-item-remove').forEach(btn => {
        btn.onclick = () => {
            const idx = btn.getAttribute('data-idx');
            currentSsccManifest.splice(idx, 1);
            renderSsccManifest();
        };
    });
}

export async function saveSsccShipment() {
    const ssccCode = document.getElementById('sscc_barcode').value;
    const vendor = document.getElementById('sscc_vendor').value;
    
    if (!ssccCode || ssccCode.length !== 18) { showSnackbar("SSCC kode skal være nøjagtig 18 cifre."); return; }
    if (currentSsccManifest.length === 0) { showSnackbar("Tilføj venligst mindst én vare til pallen."); return; }
    
    try {
        // 1. Opret hovedforsendelsen
        const { data: ship, error: sErr } = await state.supabaseClient.from('forsendelser').insert({
            firma_id: state.currentFirmaId,
            sscc_kode: ssccCode,
            leverandoer: vendor,
            status: 'afventer'
        }).select().maybeSingle();
        
        if (sErr) throw sErr;
        
        // 2. Opret indholdet
        const itemsToInsert = currentSsccManifest.map(item => ({
            forsendelse_id: ship.id,
            lager_id: item.lager_id,
            antal: item.antal
        }));
        
        const { error: iErr } = await state.supabaseClient.from('forsendelse_indhold').insert(itemsToInsert);
        if (iErr) throw iErr;
        
        showSnackbar("SSCC Forsendelse oprettet! 🚀");
        closeAllModals();
        fetchSsccShipments();
    } catch (err) {
        showSnackbar("Kunne ikke oprette forsendelse", err.code);
    }
}

export async function deleteShipment(id) {
    if (!confirm("Er du sikker på, at du vil slette denne forsendelse?")) return;
    try {
        const { error } = await state.supabaseClient.from('forsendelser').delete().eq('id', id);
        if (error) throw error;
        showSnackbar("Forsendelse slettet.");
        const preview = document.getElementById('ssccPreview');
        if (preview) preview.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Vælg en forsendelse for at se detaljer.</div>';
        fetchSsccShipments();
    } catch (err) { showSnackbar("Kunne ikke slette", err.code); }
}

// Expose to window for legacy onclick support
window.addSsccItemToList = addSsccItemToList;
window.saveSsccShipment = saveSsccShipment;
window.previewSsccShipment = previewSsccShipment;
window.deleteShipment = deleteShipment;
window.prepareSsccModal = prepareSsccModal;
