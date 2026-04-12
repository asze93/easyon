/**
 * EASYON DIAMOND PROCUREMENT MANAGER (v86.1) 🛒💎
 * Styrer leverandører og indkøbsordrer.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, closeAllModals } from '../ui/ui-helpers.js';

let currentPoManifest = [];

export async function fetchSuppliers() {
    const list = document.getElementById('vendorList');
    if (!list) return;
    try {
        const { data, error } = await state.supabaseClient.from('leverandoerer').select('*').eq('firma_id', state.currentFirmaId).order('navn');
        if (error) throw error;
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Ingen leverandører endnu.</p>';
            return;
        }
        list.innerHTML = '';
        data.forEach(sup => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; color:white;">${sup.navn}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${sup.kontakt_person || '-'}</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (err) { console.error("Fetch suppliers failed:", err); }
}

export async function fetchPurchaseOrders() {
    const list = document.getElementById('orderList');
    if (!list) return;
    try {
        const { data, error } = await state.supabaseClient
            .from('indkoeb_ordrer')
            .select('*, leverandoerer(navn), indkoeb_indhold(*)')
            .eq('firma_id', state.currentFirmaId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Ingen bestillinger endnu.</p>';
            return;
        }
        list.innerHTML = '';
        data.forEach(po => {
            const itemCount = po.indkoeb_indhold?.length || 0;
            const statusColor = po.status === 'received' ? 'var(--success)' : (po.status === 'sent' ? 'var(--warning)' : 'var(--text-muted)');
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; color:white;">Indkøb #${po.id.substring(0,5)}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${po.leverandoerer?.navn || 'Ukendt Leverandør'}</div>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge" style="background:rgba(255,255,255,0.05); color:${statusColor}; border:1px solid ${statusColor}44;">${po.status.toUpperCase()}</span>
                        ${po.status === 'sent' && !po.sscc_id ? `<button class="po-convert-btn btn-primary" style="font-size:10px; padding:4px 8px; margin-top:5px;" data-id="${po.id}">Opret SSCC</button>` : ''}
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
        
        document.querySelectorAll('.po-convert-btn').forEach(btn => {
            btn.onclick = () => convertPoToSscc(btn.getAttribute('data-id'));
        });
    } catch (err) { console.error("Fetch POs failed:", err); }
}

export async function handleSupplierSubmit(e) {
    if(e) e.preventDefault();
    const sup = {
        firma_id: state.currentFirmaId,
        navn: document.getElementById('supNavn').value,
        kontakt_person: document.getElementById('supKontakt').value,
        email: document.getElementById('supEmail').value,
        telefon: document.getElementById('supTlf').value,
        note: document.getElementById('supNote').value
    };
    try {
        const { error } = await state.supabaseClient.from('leverandoerer').insert(sup);
        if (error) throw error;
        showSnackbar("Leverandør gemt! 🤝");
        closeAllModals();
        fetchSuppliers();
    } catch (err) { showSnackbar("Fejl ved gem:", err.code); }
}

export async function preparePoModal() {
    currentPoManifest = [];
    renderPoManifest();
    
    const vSelect = document.getElementById('po_vendor_select');
    const iSelect = document.getElementById('po_add_item_select');
    
    const { data: vendors } = await state.supabaseClient.from('leverandoerer').select('id, navn').eq('firma_id', state.currentFirmaId).order('navn');
    vSelect.innerHTML = '<option value="">Vælg leverandør...</option>';
    vendors?.forEach(v => vSelect.innerHTML += `<option value="${v.id}">${v.navn}</option>`);
    
    const { data: items } = await state.supabaseClient.from('lager').select('id, navn').eq('firma_id', state.currentFirmaId).order('navn');
    iSelect.innerHTML = '<option value="">Vælg vare...</option>';
    items?.forEach(i => iSelect.innerHTML += `<option value="${i.id}">${i.navn}</option>`);
}

export function addPoItemToList() {
    const select = document.getElementById('po_add_item_select');
    const qtyInput = document.getElementById('po_add_qty');
    const qty = parseInt(qtyInput.value) || 1;
    if (!select.value) return;
    
    currentPoManifest.push({
        lager_id: select.value,
        navn: select.options[select.selectedIndex].text,
        antal: qty
    });
    renderPoManifest();
}

export function renderPoManifest() {
    const container = document.getElementById('po_items_container');
    if (!container) return;
    container.innerHTML = currentPoManifest.length === 0 ? '<p class="text-muted">Ingen varer tilføjet.</p>' : '';
    currentPoManifest.forEach((item, idx) => {
        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:10px 16px; border-radius:10px;";
        div.innerHTML = `
            <span style="font-weight:700;">${item.navn} x ${item.antal}</span>
            <button class="po-item-remove" data-idx="${idx}" style="background:transparent; border:none; color:var(--danger); cursor:pointer;">✕</button>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.po-item-remove').forEach(btn => {
        btn.onclick = () => {
            currentPoManifest.splice(btn.getAttribute('data-idx'), 1);
            renderPoManifest();
        };
    });
}

export async function savePurchaseOrder() {
    const vendorId = document.getElementById('po_vendor_select').value;
    const currency = document.getElementById('po_currency').value;
    
    if (!vendorId) { showSnackbar("Vælg en leverandør."); return; }
    if (currentPoManifest.length === 0) { showSnackbar("Tilføj varer."); return; }
    
    try {
        const { data: po, error: pErr } = await state.supabaseClient.from('indkoeb_ordrer').insert({
            firma_id: state.currentFirmaId,
            leverandoer_id: vendorId,
            valuta: currency,
            status: 'sent'
        }).select().maybeSingle();
        
        if (pErr) throw pErr;
        
        const contents = currentPoManifest.map(i => ({
            indkoeb_id: po.id,
            lager_id: i.lager_id,
            antal: i.antal
        }));
        
        await state.supabaseClient.from('indkoeb_indhold').insert(contents);
        
        showSnackbar("Bestilling oprettet og sendt! 🛒🚀");
        closeAllModals();
        fetchPurchaseOrders();
    } catch (err) { showSnackbar("Fejl ved bestilling", err.code); }
}

export async function convertPoToSscc(poId) {
    if (!confirm("Vil du omdanne denne bestilling til en SSCC-forsendelse nu?")) return;
    try {
        const { data: po } = await state.supabaseClient.from('indkoeb_ordrer').select('*, leverandoerer(navn), indkoeb_indhold(*)').eq('id', poId).single();
        const ssccCode = "00" + Math.floor(Math.random() * 9000000000000000 + 1000000000000000).toString();
        const { data: ship, error: sErr } = await state.supabaseClient.from('forsendelser').insert({
            firma_id: state.currentFirmaId,
            sscc_kode: ssccCode,
            leverandoer: po.leverandoerer?.navn || "Bestilling #" + poId.substring(0,5),
            status: 'afventer'
        }).select().maybeSingle();
        if (sErr) throw sErr;
        const shipItems = po.indkoeb_indhold.map(i => ({ forsendelse_id: ship.id, lager_id: i.lager_id, antal: i.antal }));
        await state.supabaseClient.from('forsendelse_indhold').insert(shipItems);
        await state.supabaseClient.from('indkoeb_ordrer').update({ sscc_id: ship.id }).eq('id', poId);
        showSnackbar(`Bestilling omdannet til SSCC! Kode: ${ssccCode} 🚢`);
        fetchPurchaseOrders();
    } catch (err) { showSnackbar("Fejl ved konvertering", err.code); }
}

export async function deleteOrder(id) {
    if (!confirm("Vil du slette denne bestilling?")) return;
    try {
        const { error } = await state.supabaseClient.from('indkoeb_ordrer').delete().eq('id', id);
        if (error) throw error;
        showSnackbar("Bestilling slettet.");
        fetchPurchaseOrders();
    } catch (err) {
        showSnackbar("Fejl ved sletning", err.code);
    }
}

// Expose globals for HTML
window.handleSupplierSubmit = handleSupplierSubmit;
window.addPoItemToList = addPoItemToList;
window.savePurchaseOrder = savePurchaseOrder;
window.convertPoToSscc = convertPoToSscc;
window.deleteOrder = deleteOrder;
window.preparePoModal = preparePoModal;
