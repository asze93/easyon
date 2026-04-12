/**
 * EASYON DIAMOND SOP UI (v84.0) 🧠🎨
 * Handles rendering of the SOP lists, previews, and builder canvas.
 */

export function normalizeTrin(trinArray) {
    if (!trinArray) return [];
    return trinArray.map((t, idx) => {
        if (typeof t === 'string') {
            return { id: 'legacy_' + idx, type: 'checkbox', title: t, isRequired: true };
        }
        return t;
    });
}

export function renderSopList(data, onSelect) {
    const list = document.getElementById('sopTemplateList'); 
    if (!list) return; 
    list.innerHTML = "";
    
    if (data.length === 0) {
        list.innerHTML = '<p class="text-muted" style="padding:40px; text-align:center;">Ingen procedurer oprettet endnu.</p>';
        return;
    }

    data.forEach(p => {
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.id = `sop-item-${p.id}`;
        div.onclick = () => onSelect(p);
        
        const normalized = normalizeTrin(p.trin);
        const fieldsCount = normalized.filter(x => x.type !== 'heading' && x.type !== 'section').length;

        div.innerHTML = `
            <div style="font-weight:800;">${p.titel}</div>
            <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-top:4px;">
                ${fieldsCount} handlinger
            </div>
        `;
        list.appendChild(div);
    });
}

export function renderSopPreview(p, onEdit) {
    const preview = document.getElementById('sopPreview'); 
    if (!preview) return;

    const normalized = normalizeTrin(p.trin);
    let numberCounter = 0;

    let stepsHtml = normalized.map((step) => {
        if (step.type === 'heading' || step.type === 'section') {
            return `<div style="font-size:18px; font-weight:900; margin-top:30px; margin-bottom:12px; color:var(--primary); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">${step.title}</div>`;
        }
        
        let leadingEl = '';
        if (step.type === 'numberlist') {
            numberCounter++;
            leadingEl = `<div style="font-weight:900; color:var(--primary); font-size:16px; min-width:24px;">${numberCounter}.</div>`;
        } else if (step.type === 'checkbox') {
            leadingEl = `<div style="width:20px; height:20px; border:2px solid var(--border); border-radius:6px; margin-right:12px; opacity:0.3;"></div>`;
        }

        return `
            <div style="display:flex; align-items:flex-start; padding:12px 16px; background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.03);">
                ${leadingEl}
                <div style="flex:1;">
                    <div style="font-weight:700; color:var(--text-main);">${step.title}</div>
                    ${step.description ? `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${step.description}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    preview.innerHTML = `
        <div style="padding:30px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div>
                    <h2 style="font-size:32px; font-weight:900; letter-spacing:-1px;">${p.titel}</h2>
                    <p class="text-muted" style="font-size:14px;">${p.beskrivelse || 'Ingen beskrivelse.'}</p>
                </div>
                <button class="btn btn-secondary" onclick="window.editSop('${p.id}')">
                    <span style="font-size:18px; margin-right:8px;">🛠️</span> Rediger Procedure
                </button>
            </div>
            <div style="max-width:700px;">${stepsHtml}</div>
        </div>
    `;
}
