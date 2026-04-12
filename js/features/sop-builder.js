/**
 * EASYON DIAMOND SOP BUILDER (v84.0) 🧠🛠️🚀
 * Den intelligente to-trins procedure-bygger.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, openModal, closeAllModals, setLoading, showView } from '../ui/ui-helpers.js';
import { fetchAllProcedures, saveProcedure, deleteProcedure } from './sop/sop-api.js';
import { renderSopList, renderSopPreview, normalizeTrin } from './sop/sop-ui.js';

let currentSop = {
    id: null,
    titel: '',
    beskrivelse: '',
    trin: []
};

let activeItemId = null;

window.activateBuilderItem = (id) => {
    activeItemId = id;
    renderBuilderCanvas();
};

// ----------------------------------------------------
// DASHBOARD LIST (LIST VISNING)
// ----------------------------------------------------
export async function fetchProcedures() {
    const data = await fetchAllProcedures();
    renderSopList(data, selectProcedure);
}

export function selectProcedure(p) {
    // 1. Highlight in list
    document.querySelectorAll('#sopTemplateList .list-card-item').forEach(el => {
        el.style.borderColor = 'var(--border)';
        el.style.background = 'var(--glass)';
        el.style.color = 'var(--text-main)';
    });
    const activeItem = document.getElementById(`sop-item-${p.id}`);
    if (activeItem) {
        activeItem.style.borderColor = 'var(--primary)';
        activeItem.style.background = 'rgba(59, 130, 246, 0.1)';
    }

    // Trigger mobile drill-down
    showMobileDetail('procedures');

    // 2. Render Details via Module
    renderSopPreview(p, window.editSop);
}

// ----------------------------------------------------
// BUILDER LOGIC (TRIN 1 -> TRIN 2)
// ----------------------------------------------------
export function initSopBuilderState() {
    const titleInput = document.getElementById('sopInitTitle');
    const descInput = document.getElementById('sopInitDesc');

    if (!titleInput || !titleInput.value.trim()) {
        showSnackbar("Giv venligst proceduren et navn.");
        return;
    }

    // Assign to state
    currentSop.id = null; // New
    currentSop.titel = titleInput.value.trim();
    currentSop.beskrivelse = descInput?.value.trim() || "";
    currentSop.trin = []; // Start fresh!

    // Reset init form
    if (titleInput) titleInput.value = ""; 
    if (descInput) descInput.value = "";
    closeAllModals();

    // Setup Header in Build View
    const builderTitle = document.getElementById('sopBuilderTitle');
    const builderDesc = document.getElementById('sopBuilderDesc');
    if (builderTitle) builderTitle.innerText = currentSop.titel;
    if (builderDesc) builderDesc.innerText = currentSop.beskrivelse || "Ingen beskrivelse";

    renderBuilderCanvas();
    window.dashTab('sop-builder');
}

export function editSopBuilder(p) {
    currentSop.id = p.id;
    currentSop.titel = p.titel;
    currentSop.beskrivelse = p.beskrivelse || '';
    currentSop.trin = normalizeTrin(p.trin);

    document.getElementById('sopBuilderTitle').innerText = currentSop.titel;
    document.getElementById('sopBuilderDesc').innerText = currentSop.beskrivelse || "Ingen beskrivelse";

    renderBuilderCanvas();
    window.dashTab('sop-builder');
}

export async function saveSopToDB() {
    const btn = document.querySelector('#view-sop-builder .btn-primary');
    setLoading(btn, true, "Gem Procedure 💎");

    const data = {
        firma_id: state.currentFirmaId,
        titel: currentSop.titel,
        beskrivelse: currentSop.beskrivelse,
        trin: currentSop.trin
    };

    try {
        if (currentSop.id) await state.supabaseClient.from('procedurer').update(data).eq('id', currentSop.id);
        else await state.supabaseClient.from('procedurer').insert(data);
        
        showSnackbar("Procedure gemt succesfuldt! 💎");
        fetchProcedures();
        window.dashTab('procedures');
    } catch(e) {
        console.error(e);
        showSnackbar("Der skete en fejl. Prøv igen.");
    }
    setLoading(btn, false, "Gem Procedure 💎");
}

// ----------------------------------------------------
// CANVAS MANIPULATION
// ----------------------------------------------------
export function addBuilderItem(type) {
    const newItem = {
        id: 'item_' + Date.now(),
        type: type === 'heading' || type === 'section' ? 'heading' : (type === 'field' ? 'checkbox' : type),
        title: '',
        isRequired: false
    };

    if (type === 'heading') newItem.title = "Overskrift...";
    if (type === 'section') newItem.title = "Sektion...";
    
    currentSop.trin.push(newItem);
    activeItemId = newItem.id;
    renderBuilderCanvas();
    
    // Focus newest input
    setTimeout(() => {
        const inputs = document.querySelectorAll('.sop-field-name-input, .sop-heading-input');
        if(inputs.length > 0) {
            const last = inputs[inputs.length - 1];
            last.focus();
            if(type === 'heading' || type === 'section') last.select();
        }
    }, 50);
}

export function updateItemField(id, field, value) {
    const item = currentSop.trin.find(i => i.id === id);
    if (item) {
        item[field] = value;
    }
}

export function updateItemType(id, newType) {
    const item = currentSop.trin.find(i => i.id === id);
    if (item && item.type !== 'heading') {
        item.type = newType;
        renderBuilderCanvas(); // Full re-render to change visual preview (checkbox -> textfield etc)
    }
}

export function deleteItem(id) {
    currentSop.trin = currentSop.trin.filter(i => i.id !== id);
    renderBuilderCanvas();
}

export function moveItem(index, direction) {
    if (index + direction < 0 || index + direction >= currentSop.trin.length) return;
    
    const arr = currentSop.trin;
    const temp = arr[index];
    arr[index] = arr[index + direction];
    arr[index + direction] = temp;
    
    renderBuilderCanvas();
}

// ----------------------------------------------------
// DRAG AND DROP (HTML5)
// ----------------------------------------------------
let draggedItemIndex = null;

window.dragStartItem = (e, index) => {
    draggedItemIndex = index;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { e.target.style.opacity = '0.4'; }, 50);
};

window.dragEndItem = (e) => {
    e.target.style.opacity = '1';
    renderBuilderCanvas();
};

window.dragOverItem = (e) => {
    e.preventDefault();
    e.currentTarget.style.borderTop = '3px solid var(--primary)';
};

window.dragLeaveItem = (e) => {
    e.currentTarget.style.borderTop = '';
};

window.dropItem = (e, dropIndex) => {
    e.preventDefault();
    e.currentTarget.style.borderTop = '';
    
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;
    
    const arr = currentSop.trin;
    const item = arr.splice(draggedItemIndex, 1)[0];
    
    if (draggedItemIndex < dropIndex) {
        arr.splice(dropIndex - 1, 0, item);
    } else {
        arr.splice(dropIndex, 0, item);
    }
    
    draggedItemIndex = null;
    renderBuilderCanvas();
};

// ----------------------------------------------------
// RENDERING
// ----------------------------------------------------
const typeOptions = `
    <option value="checkbox">☑️ Checkbox</option>
    <option value="textfield">✏️ Text Field</option>
    <option value="bulletlist">• Punktliste</option>
    <option value="numberlist">1. Nummerliste</option>
    <option value="inspection">🔎 Inspection</option>
`;

function renderBuilderCanvas() {
    const canvas = document.getElementById('sopBuilderCanvas');
    if (!canvas) return;

    if (currentSop.trin.length === 0) {
        canvas.innerHTML = `
            <div style="text-align:center; padding:80px 20px; border:2px dashed var(--border); border-radius:16px; margin-top:20px;">
                <div style="font-size:32px; margin-bottom:12px;">🏗️</div>
                <h3 style="font-size:18px; font-weight:800;">Dit lærred er tomt</h3>
                <p style="color:var(--text-muted); font-size:14px;">Brug menuen til højre for at tilføje dit første felt.</p>
            </div>
        `;
        return;
    }

    let currentNumberCount = 1;

    canvas.innerHTML = currentSop.trin.map((item, index) => {
        
        let displayNum = currentNumberCount;
        if (item.type === 'numberlist') currentNumberCount++;
        else currentNumberCount = 1;

        const isActive = (item.id === activeItemId);
        let typeSelector = '';
        let visualPreview = '';
        
        // Setup Visual Icons based on Type
        if (item.type !== 'heading') {
            typeSelector = `
                <select class="sop-type-selector" onchange="window.updateItemType('${item.id}', this.value)">
                    ${typeOptions.replace(`value="${item.type}"`, `value="${item.type}" selected`)}
                </select>
            `;
            
            if(item.type === 'checkbox') visualPreview = `<div style="width:18px; height:18px; border:2px solid var(--border); border-radius:4px; margin-right:16px; margin-top:2px;"></div>`;
            if(item.type === 'textfield') visualPreview = `<div style="font-size:16px; margin-right:16px;">✏️</div>`;
            if(item.type === 'bulletlist') visualPreview = `<div style="font-size:24px; margin-right:16px; line-height:20px; color:var(--text-muted);">•</div>`;
            if(item.type === 'numberlist') visualPreview = `<div style="font-size:16px; margin-right:16px; margin-top:1px; font-weight:800; color:var(--primary); min-width:20px; text-align:right;">${displayNum}.</div>`;
            if(item.type === 'inspection') visualPreview = `
                <div style="display:flex; gap:8px; margin-right:16px; margin-top:0px;">
                    <button style="border:1px solid rgba(16,185,129,0.3); color:var(--success); background:rgba(16,185,129,0.05); border-radius:6px; padding:4px 12px; font-weight:800; font-size:11px; cursor:default;">PASS</button>
                    <button style="border:1px solid rgba(245,158,11,0.3); color:var(--warning); background:rgba(245,158,11,0.05); border-radius:6px; padding:4px 12px; font-weight:800; font-size:11px; cursor:default;">FLAG</button>
                    <button style="border:1px solid rgba(239,68,68,0.3); color:var(--danger); background:rgba(239,68,68,0.05); border-radius:6px; padding:4px 12px; font-weight:800; font-size:11px; cursor:default;">FAIL</button>
                </div>`;
        }

        // --- INACTIVE PREVIEW MODE ---
        if (!isActive) {
            if (item.type === 'heading') {
                return `
                <div style="padding:16px 24px; cursor:pointer;" onclick="window.activateBuilderItem('${item.id}')"
                     ondragstart="window.dragStartItem(event, ${index})" ondragend="window.dragEndItem(event)" ondragover="window.dragOverItem(event)" ondragleave="window.dragLeaveItem(event)" ondrop="window.dropItem(event, ${index})">
                    <div style="font-size:24px; font-weight:800; color:var(--text-main); position:relative;">
                        <div class="sop-drag-handle" style="opacity:0;" onmousedown="this.parentElement.parentElement.setAttribute('draggable', true)" onmouseup="this.parentElement.parentElement.removeAttribute('draggable')"></div>
                        ${item.title || 'Uden overskrift'}
                    </div>
                </div>`;
            }
            return `
            <div class="sop-item-card inactive" style="padding:16px 24px; cursor:pointer; background:rgba(255,255,255,0.01);" onclick="window.activateBuilderItem('${item.id}')"
                 ondragstart="window.dragStartItem(event, ${index})" ondragend="window.dragEndItem(event)" ondragover="window.dragOverItem(event)" ondragleave="window.dragLeaveItem(event)" ondrop="window.dropItem(event, ${index})">
                <div class="sop-drag-handle" style="left:-16px;" onmousedown="this.parentElement.setAttribute('draggable', true)" onmouseup="this.parentElement.removeAttribute('draggable')"></div>
                <div style="display:flex; align-items:flex-start;">
                    ${visualPreview}
                    <div style="display:flex; flex-direction:column; flex:1;">
                        <div style="display:flex; align-items:center;">
                           <div style="font-size:16px; font-weight:500; color:var(--text-main);">${item.title || 'Indtast titel...'}</div>
                           ${item.isRequired ? '<span style="color:var(--danger); font-size:12px; font-weight:800; margin-left:8px; margin-top:2px;">*</span>' : ''}
                        </div>
                        ${item.description ? `<div style="font-size:14px; color:var(--text-muted); margin-top:4px; white-space:pre-wrap; line-height:1.5;">${item.description}</div>` : ''}
                    </div>
                </div>
            </div>`;
        }

        // --- ACTIVE EDITING MODE ---
        if (item.type === 'heading') {
            return `
            <div class="sop-item-card active" style="background:rgba(59, 130, 246, 0.05); border-color:var(--primary); padding:12px 24px; display:flex; align-items:center;"
                 ondragstart="window.dragStartItem(event, ${index})" ondragend="window.dragEndItem(event)" ondragover="window.dragOverItem(event)" ondragleave="window.dragLeaveItem(event)" ondrop="window.dropItem(event, ${index})">
                
                <div class="sop-drag-handle" style="opacity:1; cursor:grab;" onmousedown="this.parentElement.setAttribute('draggable', true)" onmouseup="this.parentElement.removeAttribute('draggable')"></div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="sop-action-btn" onclick="window.moveItem(${index}, -1)" title="Flyt op">↑</button>
                    <button class="sop-action-btn" onclick="window.moveItem(${index}, 1)" title="Flyt ned">↓</button>
                </div>

                <div style="flex:1; margin-left:24px;">
                    <input type="text" class="sop-heading-input" value="${item.title}" placeholder="Overskrift..." oninput="window.updateItemField('${item.id}', 'title', this.value)">
                </div>
                
                <div class="sop-actions" style="margin-left:auto; opacity:1;">
                    <button class="sop-action-btn" title="Kopier">⧉</button>
                    <button class="sop-action-btn delete" onclick="window.deleteItem('${item.id}')" title="Slet">🗑️</button>
                </div>
            </div>
            `;
        }

        return `
        <div class="sop-item-card active" style="background:rgba(59, 130, 246, 0.05); border-color:var(--primary);"
             ondragstart="window.dragStartItem(event, ${index})" ondragend="window.dragEndItem(event)" ondragover="window.dragOverItem(event)" ondragleave="window.dragLeaveItem(event)" ondrop="window.dropItem(event, ${index})">
            
            <div class="sop-drag-handle" style="opacity:1; cursor:grab;" onmousedown="this.parentElement.setAttribute('draggable', true)" onmouseup="this.parentElement.removeAttribute('draggable')"></div>
            
            <div style="display:flex; flex-direction:column; width:100%;">
                
                <!-- Top Row (Title + Toolbar) -->
                <div style="display:flex; align-items:flex-start; width:100%;">
                    
                    <!-- Op/Ned pile -->
                    <div style="display:flex; flex-direction:column; gap:4px; margin-right:16px;">
                        <button class="sop-action-btn" style="padding:2px 8px; font-size:12px;" onclick="window.moveItem(${index}, -1)">▲</button>
                        <button class="sop-action-btn" style="padding:2px 8px; font-size:12px;" onclick="window.moveItem(${index}, 1)">▼</button>
                    </div>

                    <!-- Titel Input -->
                    <div style="display:flex; flex:1; margin-top:6px; margin-left:8px;">
                        ${item.type === 'textfield' ? `
                            <input type="text" class="sop-field-name-input" value="${item.title || ''}" placeholder="Titel (Valgfri)" style="font-size:20px; font-weight:800;" oninput="window.updateItemField('${item.id}', 'title', this.value)">
                        ` : `
                            <input type="text" class="sop-field-name-input" value="${item.title || ''}" placeholder="Indtast tekst..." oninput="window.updateItemField('${item.id}', 'title', this.value)" onkeydown="if(event.key === 'Enter') { window.addBuilderItem('${item.type}'); return false; }">
                        `}
                    </div>

                    <!-- Højre part (Toolbar, uden required) -->
                    <div style="display:flex; align-items:center; gap:20px; background:rgba(0,0,0,0.2); padding:8px 16px; border-radius:12px; margin-left:16px;">
                        ${typeSelector}
                        
                        <div style="width:1px; height:20px; background:var(--border);"></div>
                        
                        <div class="sop-actions" style="opacity:1;">
                            <button class="sop-action-btn" title="Link/URL">🔗</button>
                            <button class="sop-action-btn" title="Vedhæft fil">📎</button>
                            <button class="sop-action-btn delete" onclick="window.deleteItem('${item.id}')" title="Slet">🗑️</button>
                        </div>
                    </div>
                </div>

                <!-- Bottom Row (Kun Textfield) - Fuld Bredde -->
                ${item.type === 'textfield' ? `
                    <div style="margin-top:16px; padding-left:46px;">
                        <div style="border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; background:rgba(0,0,0,0.1);">
                            <textarea class="sop-field-desc-input" placeholder="Tekst / Beskrivelse (Skriv en roman hvis du vil...)" style="height:80px;" oninput="window.updateItemField('${item.id}', 'description', this.value)">${item.description || ''}</textarea>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');

    // Animate toolbar to align with active item
    setTimeout(() => {
        const activeEl = document.querySelector('.sop-item-card.active');
        const toolbar = document.getElementById('sopFloatingToolbar');
        if (activeEl && toolbar) {
            toolbar.style.top = activeEl.offsetTop + 'px';
        }
    }, 50);
}


// EXPOSE GLOBALS
window.fetchProcedures = fetchProcedures;
window.selectProcedure = selectProcedure;
window.initSopBuilderState = initSopBuilderState;
window.editSopBuilder = editSopBuilder;
window.addBuilderItem = addBuilderItem;
window.updateItemField = updateItemField;
window.updateItemType = updateItemType;
window.deleteItem = deleteItem;
window.moveItem = moveItem;
window.saveSopToDB = saveSopToDB;
