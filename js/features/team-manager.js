/**
 * EASYON DIAMOND TEAM MANAGER (v86.5) 👥🚀
 * Medarbejdere med roller, stillingstitler, kompetencer og foto.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, openModal, closeAllModals, setLoading } from '../ui/ui-helpers.js';
import { fetchTeam } from '../services/api-service.js';

// -- Kompetence-tag logik --
let _kompetencerList = [];

window.addKompetenceTag = function() {
    const input = document.getElementById('teamKompetencerInput');
    const val = input.value.trim();
    if (!val) return;
    if (!_kompetencerList.includes(val)) {
        _kompetencerList.push(val);
        renderKompetenceTags();
    }
    input.value = '';
};

function renderKompetenceTags() {
    const container = document.getElementById('teamKompetencerTags');
    if (!container) return;
    container.innerHTML = _kompetencerList.map(k => `
        <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:var(--primary); padding:5px 12px; border-radius:20px; font-size:12px; font-weight:700;">
            ${k}
            <span onclick="removeKompetenceTag('${k}')" style="cursor:pointer; opacity:0.6; font-size:14px; line-height:1;">×</span>
        </span>
    `).join('');
    const hidden = document.getElementById('teamKompetencer');
    if (hidden) hidden.value = JSON.stringify(_kompetencerList);
}

window.removeKompetenceTag = function(tag) {
    _kompetencerList = _kompetencerList.filter(k => k !== tag);
    renderKompetenceTags();
};

// -- Foto preview --
window.previewTeamAvatar = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('teamAvatarPreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
        const urlInput = document.getElementById('teamAvatarUrl');
        if (urlInput) urlInput.value = e.target.result; // base64 til preview; erstat med upload til Supabase Storage hvis ønsket
    };
    reader.readAsDataURL(file);
};

// -- Edit --
export async function editTeamMember(id) {
    try {
        const { data: u } = await state.supabaseClient.from('brugere').select('*').eq('id', id).maybeSingle();
        if (u) {
            document.getElementById('teamId').value = u.id;
            document.getElementById('teamFirstName').value = u.fornavn || u.navn || '';
            document.getElementById('teamLastName').value = u.efternavn || '';
            document.getElementById('teamPhone').value = u.telefon || '';
            document.getElementById('teamEmail').value = u.email || '';
            document.getElementById('teamNr').value = u.arbejdsnummer || '';
            document.getElementById('teamPin').value = u.adgangskode || '';
            document.getElementById('teamRolle').value = u.rolle || 'bruger';
            document.getElementById('teamAfdeling').value = u.afdeling || '';
            document.getElementById('teamStartdato').value = u.startdato || '';
            document.getElementById('teamNodkontaktNavn').value = u.nodkontakt_navn || '';
            document.getElementById('teamNodkontaktTlf').value = u.nodkontakt_tlf || '';

            // Titel
            const stillingSelect = document.getElementById('teamTitel');
            const knownOptions = Array.from(stillingSelect.options).map(o => o.value);
            if (u.stilling && knownOptions.includes(u.stilling)) {
                stillingSelect.value = u.stilling;
            } else if (u.stilling) {
                stillingSelect.value = 'anden';
                document.getElementById('teamTitelCustom').style.display = 'block';
                document.getElementById('teamTitelCustomInput').value = u.stilling;
            }

            // Kompetencer
            _kompetencerList = Array.isArray(u.kompetencer) ? [...u.kompetencer] : [];
            renderKompetenceTags();

            // Avatar
            const preview = document.getElementById('teamAvatarPreview');
            if (u.avatar_url && preview) {
                preview.innerHTML = `<img src="${u.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                document.getElementById('teamAvatarUrl').value = u.avatar_url;
            } else if (preview) {
                preview.innerHTML = `<span style="font-size:32px;">👤</span><span style="font-size:10px; color:rgba(255,255,255,0.55); margin-top:3px;">Tilføj foto</span>`;
                document.getElementById('teamAvatarUrl').value = '';
            }

            openModal('modal-team');
        }
    } catch (e) {
        showSnackbar('Kunne ikke hente bruger: ' + e.message);
    }
}

// -- Submit --
export async function handleTeamSubmit(e) {
    e.preventDefault();
    const btn = e.submitter;
    setLoading(btn, true);
    try {
        const id = document.getElementById('teamId').value;
        const fornavn = document.getElementById('teamFirstName').value.trim();
        const efternavn = document.getElementById('teamLastName').value.trim();

        // Stilling: brug custom hvis 'anden' er valgt
        const stillingVal = document.getElementById('teamTitel').value;
        const stilling = stillingVal === 'anden'
            ? document.getElementById('teamTitelCustomInput').value.trim()
            : stillingVal;

        const kompetencerRaw = document.getElementById('teamKompetencer').value;
        const kompetencer = kompetencerRaw ? JSON.parse(kompetencerRaw) : _kompetencerList;

        const userData = {
            firma_id: state.currentFirmaId,
            fornavn,
            efternavn,
            navn: `${fornavn} ${efternavn}`.trim(),
            email: document.getElementById('teamEmail').value || null,
            telefon: document.getElementById('teamPhone').value || null,
            arbejdsnummer: document.getElementById('teamNr').value,
            adgangskode: document.getElementById('teamPin').value,
            rolle: document.getElementById('teamRolle').value,
            stilling: stilling || null,
            afdeling: document.getElementById('teamAfdeling').value || null,
            startdato: document.getElementById('teamStartdato').value || null,
            kompetencer: kompetencer.length > 0 ? kompetencer : null,
            nodkontakt_navn: document.getElementById('teamNodkontaktNavn').value || null,
            nodkontakt_tlf: document.getElementById('teamNodkontaktTlf').value || null,
            avatar_url: document.getElementById('teamAvatarUrl').value || null,
        };

        if (id) {
            await state.supabaseClient.from('brugere').update(userData).eq('id', id);
        } else {
            await state.supabaseClient.from('brugere').insert(userData);
        }

        // Nulstil kompetencer state
        _kompetencerList = [];

        showSnackbar('Medarbejder gemt! 🚀');
        closeAllModals();
        fetchTeam();
    } catch (err) {
        showSnackbar('Fejl: ' + err.message);
    } finally {
        setLoading(btn, false);
    }
}

// -- Preview panel --
export function selectTeamMember(u) {
    document.querySelectorAll('#teamList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-item-${u.id}`)?.classList.add('active');
    const preview = document.getElementById('teamPreview');
    if (!preview) return;

    // Trigger mobile drill-down
    showMobileDetail('team');

    const name = u.fornavn ? `${u.fornavn} ${u.efternavn || ''}`.trim() : (u.navn || u.email);
    const rolleEmoji = { bruger: '👤', superbruger: '⭐', admin: '🔑', tekniker: '🔧' }[u.rolle?.toLowerCase()] || '👤';
    const avatarHtml = u.avatar_url
        ? `<img src="${u.avatar_url}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid var(--primary); margin-bottom:12px;">`
        : `<div style="width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #7c3aed); display:flex; align-items:center; justify-content:center; font-size:32px; margin-bottom:12px; border:3px solid rgba(59,130,246,0.3);">👤</div>`;

    const kompetenceTags = Array.isArray(u.kompetencer) && u.kompetencer.length > 0
        ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${u.kompetencer.map(k =>
            `<span style="background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25); color:var(--primary); padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;">${k}</span>`).join('')}</div>`
        : '';

    preview.innerHTML = `
        <!-- Mobile Back Button -->
        <div class="mobile-back-btn" onclick="hideMobileDetail('team')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <div style="text-align:center; padding:40px 40px 24px;">
            ${avatarHtml}
            <h1 style="font-size:28px; font-weight:800; margin:0 0 4px;">${name}</h1>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:4px;">
                <span style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:var(--primary); padding:4px 14px; border-radius:20px; font-size:12px; font-weight:800;">${rolleEmoji} ${u.rolle || 'Medarbejder'}</span>
                ${u.stilling ? `<span style="background:rgba(255,255,255,0.06); border:1px solid var(--border); color:var(--text-muted); padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700;">${u.stilling}</span>` : ''}
            </div>
            ${u.afdeling ? `<p style="color:var(--text-muted); font-size:13px; margin:4px 0 0;">📍 ${u.afdeling}</p>` : ''}
        </div>
        <hr style="border:0; border-top:1px solid var(--border); margin:0 32px 24px;">
        <div style="padding:0 40px; display:grid; gap:12px; font-size:14px;">
            ${u.email ? `<div>📧 <span style="color:var(--text-muted);">E-mail:</span> <strong>${u.email}</strong></div>` : ''}
            ${u.telefon ? `<div>📞 <span style="color:var(--text-muted);">Telefon:</span> <strong>${u.telefon}</strong></div>` : ''}
            <div>🆔 <span style="color:var(--text-muted);">Medarbejder ID:</span> <strong>${u.arbejdsnummer || '-'}</strong></div>
            ${u.startdato ? `<div>📅 <span style="color:var(--text-muted);">Startdato:</span> <strong>${new Date(u.startdato).toLocaleDateString('da-DK')}</strong></div>` : ''}
            ${u.nodkontakt_navn ? `<div>🚨 <span style="color:var(--text-muted);">Nødkontakt:</span> <strong>${u.nodkontakt_navn} ${u.nodkontakt_tlf ? '– ' + u.nodkontakt_tlf : ''}</strong></div>` : ''}
        </div>
        ${kompetenceTags ? `<div style="padding:16px 40px 0;"><div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px;">Kompetencer</div>${kompetenceTags}</div>` : ''}
        <div style="display:flex; gap:12px; margin:32px 40px 40px;">
            <button class="btn-primary" style="flex:1;" onclick="editTeamMember('${u.id}')">📝 Rediger</button>
            <button class="btn-outline" style="color:var(--danger); border-color:rgba(239,68,68,0.3);" onclick="confirmDelete('${u.id}', 'brugere')">🗑️ Slet</button>
        </div>
    `;
}

// EXPOSE GLOBALS
window.editTeamMember = editTeamMember;
window.handleTeamSubmit = handleTeamSubmit;
window.selectTeamMember = selectTeamMember;
