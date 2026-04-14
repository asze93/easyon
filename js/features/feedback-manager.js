/**
 * EASYON DIAMOND FEEDBACK MANAGER (v87.2) 💎💬📸
 * Håndterer indsendelse af brugerfeedback inklusive screenshots.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, closeAllModals, setLoading } from '../ui/ui-helpers.js';
import { fetchFeedback } from '../services/api-service.js';

// EXPOSE GLOBALS
window.fetchFeedback = fetchFeedback;

/**
 * Live preview af vedhæftet billede 📸
 */
window.previewFeedbackImage = function(input) {
    const file = input.files[0];
    if (!file) return;

    const label = document.getElementById('feedbackUploadLabel');
    const preview = document.getElementById('feedbackImagePreview');
    const urlInput = document.getElementById('feedbackImageUrl');

    const reader = new FileReader();
    reader.onload = (e) => {
        if (label) label.style.display = 'none';
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        if (urlInput) urlInput.value = e.target.result; // Midlertidig Base64
    };
    reader.readAsDataURL(file);
};

/**
 * Indsend feedback til Supabase 🚀
 */
export async function handleFeedbackSubmit(e) {
    if (e) e.preventDefault();
    const btn = e.submitter;
    setLoading(btn, true);

    try {
        const type = document.getElementById('feedbackType').value;
        const besked = document.getElementById('feedbackMsg').value;
        const billedeUrl = document.getElementById('feedbackImageUrl').value;
        const sideUrl = window.location.href;

        // Find brugerens navn (Diamond mapping logik) 👤
        const p = state.currentUser || JSON.parse(localStorage.getItem('easyon_session_profile') || '{}');
        const navn = p.full_name || (p.fornavn ? `${p.fornavn} ${p.efternavn || ''}`.trim() : null) || p.navn || p.email || "Anonym Bruger";

        const payload = {
            firma_id: state.currentFirmaId || localStorage.getItem('easyon_firma_id'),
            bruger_navn: navn,
            type: type,
            besked: besked,
            billede_url: billedeUrl || null,
            side_url: sideUrl
        };

        const { error } = await state.supabaseClient.from('feedback').insert(payload);
        
        if (error) throw error;

        showSnackbar("Tak! Din feedback hjælper os med at gøre Diamond bedre. 💎");
        closeAllModals();
        
        // Nulstil formularen
        e.target.reset();
        const label = document.getElementById('feedbackUploadLabel');
        const preview = document.getElementById('feedbackImagePreview');
        if (label) label.style.display = 'block';
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
        document.getElementById('feedbackImageUrl').value = '';

    } catch (err) {
        console.error("Feedback error:", err);
        showSnackbar("Kunne ikke sende feedback. Prøv igen senere.", err.code);
    } finally {
        setLoading(btn, false);
    }
}

/**
 * Render listen af feedback (KUN MASTER) 📋
 */
window.renderFeedbackList = function(data) {
    const list = document.getElementById('feedback-list-container');
    if (!list) return;
    list.innerHTML = "";

    if (!data || data.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.5;">Ingen feedback endnu...</div>`;
        return;
    }

    data.forEach(item => {
        const date = new Date(item.created_at).toLocaleDateString('da-DK');
        const card = document.createElement('div');
        card.className = 'list-card-item';
        card.style.cursor = 'pointer';
        card.onclick = () => selectFeedbackItem(item);
        
        // Farver baseret på type 🎨
        let typeColor = "#10B981"; // Ros
        if (item.type?.includes('Ris')) typeColor = "#EF4444";
        if (item.type?.includes('Forslag')) typeColor = "#3B82F6";

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:10px; font-weight:800; padding:4px 8px; border-radius:6px; background:${typeColor}20; color:${typeColor}; text-transform:uppercase;">${item.type}</span>
                <span style="font-size:11px; opacity:0.5;">${date}</span>
            </div>
            <div style="font-weight:700; margin-top:8px;">${item.bruger_navn}</div>
            <div style="font-size:12px; opacity:0.7; margin-top:4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.besked}</div>
            <div style="font-size:10px; font-weight:700; color:var(--primary); margin-top:8px; text-transform:uppercase;">🏢 ${item.firmaer?.navn || 'System'}</div>
        `;
        list.appendChild(card);
    });
};

/**
 * Vis detaljer for én feedback 🧐
 */
function selectFeedbackItem(item) {
    const panel = document.getElementById('feedback-detail-panel');
    const content = document.getElementById('feedback-detail-content');
    if (!panel || !content) return;

    panel.style.display = 'block';
    
    const date = new Date(item.created_at).toLocaleString('da-DK');
    
    content.innerHTML = `
        <div style="margin-bottom:30px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h2 style="margin:0; font-weight:800;">Fra: ${item.bruger_navn}</h2>
                <div style="font-size:13px; opacity:0.6; margin-top:5px;">${date} • ${item.firmaer?.navn || 'Firma ukendt'}</div>
            </div>
            <div style="font-size:24px;">${item.type?.includes('Ros') ? '💎' : (item.type?.includes('Ris') ? '🛠️' : '💡')}</div>
        </div>

        <div style="background:rgba(255,255,255,0.03); padding:30px; border-radius:20px; border:1px solid var(--border); margin-bottom:30px; line-height:1.6; font-size:16px; white-space: pre-wrap;">
            ${item.besked}
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <div>
                <label style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:8px;">📍 Side i systemet</label>
                <a href="${item.side_url}" target="_blank" style="color:var(--primary); text-decoration:none; font-size:13px; font-weight:700; word-break:break-all;">${item.side_url}</a>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:8px;">🖼️ Screenshot / Foto</label>
                ${item.billede_url ? 
                    `<img src="${item.billede_url}" style="width:100%; border-radius:12px; border:1px solid var(--border); cursor:zoom-in;" onclick="window.open(this.src)">` : 
                    `<div style="font-style:italic; opacity:0.5; font-size:13px;">Intet billede vedhæftet</div>`
                }
            </div>
        </div>
    `;
}

// Global exposure
window.handleFeedbackSubmit = handleFeedbackSubmit;
