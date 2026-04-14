/**
 * EASYON DIAMOND ASSET MANAGER (v84.0) 🛰️🏢
 * Alt om maskiner, lokationer og kategorier.
 */

import { state } from '../core/app-state.js';
import { 
    showSnackbar, openModal, closeAllModals, setLoading, 
    toggleSidebar, showMobileDetail 
} from '../ui/ui-helpers.js';
import { fetchStats, fetchAssets, ensureLocationPath, ensureCategory } from '../services/api-service.js';
import { printQrTag } from '../services/print-service.js';

export async function renderAssetsList() {
    if (!state.currentFirmaId) return;
    const list = document.getElementById('assetsList'); 
    if (!list) return; 

    // Visual placeholder while loading
    if (!list.innerHTML) list.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.5;">Henter maskiner...</div>';

    try {
        const data = await fetchAssets(); 
        list.innerHTML = "";
        
        // Filter search 🔍
        const q = document.getElementById('assetListSearch')?.value?.toLowerCase() || "";
        const filtered = data.filter(a => 
            a.navn?.toLowerCase().includes(q) || 
            a.short_id?.toLowerCase().includes(q) ||
            a.alias?.toLowerCase().includes(q)
        );

        if (!data || data.length === 0) {
            list.innerHTML = `
                <div style="padding:40px; text-align:center; opacity:0.5;">
                    <div style="font-size:32px; margin-bottom:12px;">🚜</div>
                    <div style="font-weight:700; font-size:14px; color:var(--text-muted);">Ingen maskiner oprettet</div>
                </div>`;
            return;
        }

        filtered.forEach(a => {
            const div = document.createElement('div');
            div.className = 'list-card-item';
            div.id = `asset-item-${a.id}`;
            div.onclick = () => selectAsset(a);
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:800;">${a.navn}</div>
                    <span style="font-size:9px; font-weight:900; background:var(--primary); color:white; padding:1px 5px; border-radius:4px; opacity:0.8;">${a.alias || a.short_id || ''}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted);">📍 ${a.lokationer?.navn || 'Ukendt'} ${a.alias ? '• ID: ' + a.short_id : ''}</div>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.warn("Assets Render Error:", e);
        list.innerHTML = '<p class="text-muted" style="padding:20px;">Kunne ikke hente maskiner.</p>';
    }
}

export function selectAsset(a) {
    document.querySelectorAll('#assetsList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`asset-item-${a.id}`)?.classList.add('active');
    const preview = document.getElementById('assetsPreview'); if (!preview) return;
    
    // Trigger mobile drill-down
    showMobileDetail('assets');

    preview.innerHTML = `
        <!-- Mobile Back Button -->
        <div class="mobile-back-btn" onclick="hideMobileDetail('assets')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <h1 style="font-size:28px; font-weight:800; margin:0;">${a.navn}</h1>
            <div style="display:flex; gap:8px;">
                <div style="background:var(--primary); color:white; padding:4px 12px; border-radius:8px; font-size:14px; font-weight:900; letter-spacing:1px;" title="System ID">
                    ${a.short_id || 'M-NEW'}
                </div>
                ${a.alias ? `<div style="background:rgba(255,255,255,0.1); color:white; padding:4px 12px; border-radius:8px; font-size:14px; font-weight:900; border:1px solid var(--border);" title="Eksternt Alias">
                    ${a.alias}
                </div>` : ''}
            </div>
        </div>
        <p class="text-muted" style="margin-bottom:24px;">${a.beskrivelse || 'Ingen beskrivelse.'}</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:24px;">
            <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:14px; border:1px solid var(--border);">
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">📍 Lokation</div>
                <div style="font-weight:700;">${a.lokationer?.navn || 'Ikke angivet'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:14px; border:1px solid var(--border);">
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">🏷️ Kategori</div>
                <div style="font-weight:700;">${a.kategorier?.navn || 'Standard'}</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:20px;">
            <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:14px; border:1px solid var(--border);">
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">📅 Købsdato</div>
                <div style="font-weight:700;">${a.koebs_dato || 'Ukendt'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:14px; border:1px solid var(--border);">
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">🛡️ Garanti-udløb</div>
                <div style="font-weight:700; color:${a.garanti_udloeb && new Date(a.garanti_udloeb) < new Date() ? 'var(--danger)' : 'white'}">
                    ${a.garanti_udloeb || 'Ingen dato'}
                </div>
            </div>
        </div>
        
        <!-- QR KODE SEKTION -->
        <div style="margin-top:28px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:24px;">
            <div style="font-size:12px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:16px;">📱 QR-kode til maskinen</div>
            <div style="display:flex; gap:24px; align-items:center;">
                <div style="background:white; padding:12px; border-radius:12px; flex-shrink:0;">
                    <div id="previewQrCanvas" style="width:120px; height:120px;"></div>
                </div>
                <div>
                    <div style="font-weight:700; font-size:14px; margin-bottom:6px;">${a.navn}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">Scan koden med EasyON-appen for at åbne maskinen automatisk</div>
                    <button onclick="printPreviewQR('${a.short_id || a.id}', '${a.navn.replace(/'/g, "\\'")}')"
                        style="background:linear-gradient(135deg,#3B82F6,#1D4ED8); color:white; border:none; padding:10px 18px; border-radius:10px; cursor:pointer; font-weight:700; font-size:13px;">
                        🖨️ Print QR-kode
                    </button>
                </div>
            </div>
        </div>
        
        <div style="display:flex; gap:12px; margin-top:24px;">
            <button class="btn-primary" onclick='editAsset(${JSON.stringify(a).replace(/'/g, "&#39;")})'>📝 Rediger</button>
            <button class="btn-outline" onclick="confirmDelete('${a.id}', 'assets')">🗑️ Slet</button>
        </div>
    `;
    
    // Generer QR kode med asset ID (UUID) som indhold
    setTimeout(() => {
        const qrEl = document.getElementById('previewQrCanvas');
        if (qrEl && typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrEl, {
                    text: a.short_id || a.id, width: 120, height: 120,
                    colorDark: '#0F172A', colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch(e) { console.warn('QR preview fejl:', e); }
        }
    }, 50);
}

export async function handleAssetSubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('assetId').value;
    const descEl = document.getElementById('assetDesc');
    const locEl = document.getElementById('assetLoc');
    const catEl = document.getElementById('assetCategory');
    const navnEl = document.getElementById('assetName');
    
    if (!navnEl?.value?.trim()) {
        showSnackbar("Maskinens navn er påkrævet!");
        setLoading(btn, false);
        return;
    }
    
    const data = {
        firma_id: state.currentFirmaId,
        navn: navnEl.value.trim(),
        alias: document.getElementById('assetAlias')?.value?.trim() || null,
        beskrivelse: (descEl?.value?.trim()) || null,
        lokation_id: (locEl?.value) || null,
        kategori_id: (catEl?.value) || null,
        koebs_dato: document.getElementById('assetPurchaseDate')?.value || null,
        garanti_udloeb: document.getElementById('assetWarrantyDate')?.value || null
    };

    try {
        const { error } = id 
            ? await state.supabaseClient.from('assets').update(data).eq('id', id)
            : await state.supabaseClient.from('assets').insert(data);
        
        if (error) {
            console.error('Asset gem fejl:', error);
            showSnackbar(`Fejl: ${error.message}`);
            setLoading(btn, false);
            return;
        }
        
        renderAssetsList(); fetchStats(); closeAllModals();
        showSnackbar(`${data.navn} er gemt! 💎`);
    } catch(err) {
        showSnackbar(`Uventet fejl: ${err.message}`);
    }
    setLoading(btn, false);
}

export function autoFillAssetLocation() {
    const parentId = document.getElementById('assetParent').value;
    if (!parentId) return;
    const parent = state.allAssets.find(a => a.id === parentId);
    if (parent && parent.lokation_id) {
        document.getElementById('assetLoc').value = parent.lokation_id;
    }
}

// EXPOSE GLOBALS for Legacy HTML support
window.editAsset = (a) => {
    document.getElementById('assetId').value = a.id;
    document.getElementById('assetName').value = a.navn;
    if(document.getElementById('assetAlias')) document.getElementById('assetAlias').value = a.alias || '';
    
    if(document.getElementById('assetDesc')) document.getElementById('assetDesc').value = a.beskrivelse || '';
    if(document.getElementById('assetLoc')) document.getElementById('assetLoc').value = a.lokation_id || '';
    if(document.getElementById('assetCategory')) document.getElementById('assetCategory').value = a.kategori_id || '';
    if(document.getElementById('assetPurchaseDate')) document.getElementById('assetPurchaseDate').value = a.koebs_dato || '';
    if(document.getElementById('assetWarrantyDate')) document.getElementById('assetWarrantyDate').value = a.garanti_udloeb || '';
    
    openModal('modal-asset');
}

/**
 * INTELLIGENT CSV IMPORT 🧠🛰️
 * Auto-opretter Lokationer og Kategorier hvis de ikke findes.
 */
export async function handleAssetCsvImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const rowsRaw = text.split('\n').filter(r => r.trim());
        if (rowsRaw.length < 2) return;

        // Intelligent delimiter detection 🧠
        const firstRow = rowsRaw[0];
        const delimiter = (firstRow.split(';').length > firstRow.split(',').length) ? ';' : ',';
        
        const rows = rowsRaw.map(r => r.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
        const data = rows.slice(1).filter(r => r.length >= 1 && r[0]);

        showSnackbar(`Behandler ${data.length} rækker... ⏳`);

        try {
            const assetsToInsert = await Promise.all(data.map(async r => ({
                firma_id: state.currentFirmaId,
                navn: r[0],
                beskrivelse: r[1] || '',
                lokation_id: await ensureLocationPath(r[2]),
                kategori_id: await ensureCategory(r[3]),
                koebs_dato: r[4] || null,
                garanti_udloeb: r[5] || null
            })));

            const { error } = await state.supabaseClient.from('assets').insert(assetsToInsert);
            if (error) throw error;

            renderAssetsList();
            showSnackbar(`Import succes! ${data.length} maskiner tilføjet. 🚜💎`);
            input.value = '';
        } catch (err) {
            console.error(err);
            showSnackbar("Fejl under import: " + err.message);
        }
    };
    reader.readAsText(file);
}

window.handleAssetCsvImport = handleAssetCsvImport;
window.selectAsset = selectAsset;
window.handleAssetSubmit = handleAssetSubmit;
window.autoFillAssetLocation = autoFillAssetLocation;
window.renderAssetsList = renderAssetsList;

// Print QR fra preview panelet (bruger asset UUID)
window.printPreviewQR = function(assetId, assetNavn) {
    printQrTag(assetId, assetNavn, 'Maskine / Asset');
};

// --- QR KODE & FOTO FUNKTIONER ---
let _assetQrInstance = null;

window.opdaterAssetQR = function() {
    const navn = document.getElementById('assetName')?.value?.trim();
    const qrSection = document.getElementById('assetQrSection');
    const canvas = document.getElementById('assetQrCanvas');
    const label = document.getElementById('assetQrLabel');
    if (!qrSection || !canvas) return;

    if (!navn) { qrSection.style.display = 'none'; return; }
    qrSection.style.display = 'block';
    if (label) label.textContent = `Maskine: ${navn}`;

    // QR indhold: asset navn (efter gem vil vi bruge ID, men preview bruger navn)
    const qrIndhold = navn;
    canvas.innerHTML = '';
    try {
        if (_assetQrInstance) { _assetQrInstance.clear(); _assetQrInstance.makeCode(qrIndhold); }
        else {
            _assetQrInstance = new QRCode(canvas, {
                text: qrIndhold, width: 160, height: 160,
                colorDark: '#0F172A', colorLight: '#FFFFFF',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    } catch(e) { console.warn('QR fejl:', e); }
};

window.previewAssetPhoto = function(input) {
    const zone = document.getElementById('assetPhotoZone');
    const label = document.getElementById('assetPhotoLabel');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (zone) zone.style.backgroundImage = `url(${e.target.result})`;
            if (zone) Object.assign(zone.style, { backgroundSize: 'cover', backgroundPosition: 'center' });
            if (label) label.textContent = '✅ ' + input.files[0].name;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.printAssetQR = function() {
    const navn = document.getElementById('assetName')?.value?.trim() || 'Maskine';
    const canvas = document.getElementById('assetQrCanvas')?.querySelector('canvas') 
                   || document.getElementById('assetQrCanvas')?.querySelector('img');
    if (!canvas) return;

    const imgSrc = canvas.tagName === 'CANVAS' ? canvas.toDataURL() : canvas.src;
    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <!DOCTYPE html><html><head><title>QR - ${navn}</title>
        <style>
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; margin:0; background:white; }
            img { width:200px; height:200px; }
            h2 { font-size:20px; margin-top:16px; color:#0F172A; }
            p { font-size:12px; color:#64748B; margin-top:4px; }
            @media print { button { display:none; } }
        </style></head><body>
        <img src="${imgSrc}" alt="QR Kode">
        <h2>${navn}</h2>
        <p>EasyON Asset QR-kode • Scan for at åbne maskinen</p>
        <button onclick="window.print()" style="margin-top:20px; padding:10px 24px; background:#0F172A; color:white; border:none; border-radius:8px; font-size:16px; cursor:pointer;">🖨️ Print</button>
        </body></html>
    `);
    printWin.document.close();
};
