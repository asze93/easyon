/**
 * EASYON DIAMOND API SERVICE (v84.0) 🛰️📊
 * Den direkte linje til dine data i Supabase.
 */

import { state } from '../core/app-state.js';
import { showSnackbar } from '../ui/ui-helpers.js';

export async function fetchStats() {
    if (!state.currentFirmaId) return;
    try {
        const { count: tasks } = await state.supabaseClient.from('opgaver').select('*', { count: 'exact' }).eq('firma_id', state.currentFirmaId);
        const { count: assets } = await state.supabaseClient.from('assets').select('*', { count: 'exact' }).eq('firma_id', state.currentFirmaId);
        const { count: reqs } = await state.supabaseClient.from('anmodninger').select('*', { count: 'exact' }).eq('firma_id', state.currentFirmaId);

        if (document.getElementById('stat-active-tasks')) document.getElementById('stat-active-tasks').innerText = tasks || 0;
        if (document.getElementById('stat-total-assets')) document.getElementById('stat-total-assets').innerText = assets || 0;
        if (document.getElementById('stat-pending-requests')) document.getElementById('stat-pending-requests').innerText = reqs || 0;
    } catch (e) {
        console.warn("Stats Fetch Error:", e);
    }
}

export async function fetchTasks() {
    if (!state.currentFirmaId) return;
    try {
        const { data } = await state.supabaseClient.from('opgaver')
            .select('*, assets(navn), lokationer(navn)') // JOIN lokationer 📍
            .eq('firma_id', state.currentFirmaId)
            .order('created_at', { ascending: false });
        const list = document.getElementById('tasksList'); 
        if (!list) return; 
        list.innerHTML = "";
        
        if (data?.length === 0) {
            list.innerHTML = `
                <div style="padding:40px; text-align:center; opacity:0.5;">
                    <div style="font-size:32px; margin-bottom:12px;">📋</div>
                    <div style="font-weight:700; font-size:14px; color:var(--text-muted);">Ingen aktive opgaver</div>
                    <p style="font-size:12px; margin-top:4px;">Klik på '+ Ny' for at oprette din første opgave.</p>
                </div>`;
            return;
        }

        data?.forEach(t => {
            const div = document.createElement('div');
            div.className = 'list-card-item';
            div.id = `task-item-${t.id}`;
            div.onclick = () => { if (window.selectTask) window.selectTask(t); };
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="font-weight:800;">${t.titel}</div>
                    <div class="badge prio-${t.prioritet == 3 ? 'høj' : (t.prioritet == 2 ? 'middel' : 'lav')}">${t.prioritet == 3 ? 'Høj' : (t.prioritet == 2 ? 'Middel' : 'Lav')}</div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:10px;">
                    <div>
                        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">🚜 Maskine</div>
                        <div style="font-weight:700;">${t.assets?.navn || 'Ingen maskine'}</div>
                    </div>
                    <div>
                        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">📍 Lokation</div>
                        <div style="font-weight:700;">${t.lokationer?.navn || 'Ingen lokation'}</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.warn("Tasks Fetch Error:", e);
    }
}

export async function fetchRequests() {
    if (!state.currentFirmaId) return;
    try {
        const { data } = await state.supabaseClient.from('anmodninger').select('*, assets(navn)').eq('firma_id', state.currentFirmaId).order('created_at', { ascending: false });
        const list = document.getElementById('requestsList'); 
        if (!list) return; 
        list.innerHTML = "";
        
        if (data?.length === 0) {
            list.innerHTML = `
                <div style="padding:40px; text-align:center; opacity:0.5;">
                    <div style="font-size:32px; margin-bottom:12px;">⚡</div>
                    <div style="font-weight:700; font-size:14px; color:var(--text-muted);">Ingen anmodninger</div>
                </div>`;
            return;
        }

        data?.forEach(r => {
            const div = document.createElement('div');
            div.className = 'list-card-item';
            div.id = `req-item-${r.id}`;
            div.onclick = () => { if (window.selectRequest) window.selectRequest(r); };
            div.innerHTML = `<div style="font-weight:800;">${r.titel}</div><div style="font-size:12px; color:var(--text-muted);">${r.assets?.navn || 'Maskine ukendt'}</div>`;
            list.appendChild(div);
        });
    } catch (e) {
        console.warn("Requests Fetch Error:", e);
    }
}

export async function fetchTeam() {
    if (!state.currentFirmaId) return;
    try {
        const { data } = await state.supabaseClient.from('brugere').select('*').eq('firma_id', state.currentFirmaId).order('fornavn');
        const list = document.getElementById('teamList'); 
        if (!list) return; 
        list.innerHTML = "";
        
        if (data?.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen medarbejdere oprettet.</p>';
        } else {
            data?.forEach(u => {
                const div = document.createElement('div');
                div.className = 'list-card-item';
                div.id = `user-item-${u.id}`;
                div.onclick = () => { if (window.selectTeamMember) window.selectTeamMember(u); };
                const name = u.fornavn ? `${u.fornavn} ${u.efternavn || ''}` : (u.navn || u.email);
                div.innerHTML = `<div style="font-weight:800;">${name}</div><div style="font-size:12px; color:var(--text-muted);">${u.rolle} • ID: ${u.arbejdsnummer}</div>`;
                list.appendChild(div);
            });
        }
        
        // Populate task assignee dropdown
        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">-- Vælg specifik tekniker --</option>';
            data?.forEach(u => {
                const name = u.fornavn ? `${u.fornavn} ${u.efternavn || ''}` : (u.navn || u.email);
                assigneeSelect.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
    } catch (e) {
        console.warn("Team Fetch Error:", e);
    }
}

export async function fetchLocations() {
    if (!state.currentFirmaId) return;
    try {
        const { data } = await state.supabaseClient.from('lokationer').select('*').eq('firma_id', state.currentFirmaId).order('navn');
        state.allLocations = data || [];

        // Udfyld alle lokations-vælgere (inkl. den nye til hierarki)
        ['assetLoc', 'taskLocSearch', 'locParent', 'lagerLokation'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.tagName === 'SELECT') {
                const currentVal = el.value;
                el.innerHTML = id === 'locParent' ? '<option value="">-- Ingen (Hovedlokation) --</option>' : '<option value="">Vælg lokation...</option>';
                data?.forEach(l => {
                    // Undgå at en lokation kan være forælder til sig selv (hvis vi er i edit mode)
                    const activeLocId = document.getElementById('locId')?.value;
                    if (id === 'locParent' && l.id === activeLocId) return;
                    
                    el.innerHTML += `<option value="${l.id}">${l.navn}</option>`;
                });
                el.value = currentVal;
            }
        });

        const list = document.getElementById('locationsList');
        if (!list) return;
        list.innerHTML = "";
        if (data?.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen lokationer oprettet.</p>';
            return;
        }
        data.forEach(l => {
            const div = document.createElement('div');
            div.className = 'list-card-item';
            div.id = `loc-item-${l.id}`;
            div.onclick = () => { if (window.selectLocation) window.selectLocation(l); };
            div.innerHTML = `<div style="font-weight:800;">${l.navn}</div><div style="font-size:12px; color:var(--text-muted);">📍 ${l.beskrivelse || 'Lokation'}</div>`;
            list.appendChild(div);
        });
    } catch (e) { console.warn("Locations Fetch Error:", e); }
}

export async function fetchCategories() {
    if (!state.currentFirmaId) return;
    try {
        const { data } = await state.supabaseClient.from('kategorier').select('*').eq('firma_id', state.currentFirmaId).order('navn');
        const list = document.getElementById('categoriesList'); if (!list) return; list.innerHTML = "";
        if (data?.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen kategorier oprettet.</p>';
        } else {
            data.forEach(c => {
                const div = document.createElement('div');
                div.className = 'list-card-item';
                div.id = `cat-item-${c.id}`;
                div.onclick = () => { if (window.selectCategory) window.selectCategory(c); };
                div.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:#${c.farve || 'ccc'}; border-radius:50%;"></div><div style="font-weight:800;">${c.navn}</div></div>`;
                list.appendChild(div);
            });
        }
        
        // Populate asset category dropdown
        const assetCatSelect = document.getElementById('assetCategory');
        if (assetCatSelect) {
            assetCatSelect.innerHTML = '<option value="">Vælg kategori...</option>';
            data?.forEach(c => {
                assetCatSelect.innerHTML += `<option value="${c.id}">${c.navn}</option>`;
            });
        }
    } catch (e) { console.warn("Categories Fetch Error:", e); }
}

export async function fetchAssets() {
    if (!state.currentFirmaId) return [];
    try {
        const { data } = await state.supabaseClient.from('assets').select('*, lokationer(navn)').eq('firma_id', state.currentFirmaId).order('navn');
        state.allAssets = data || [];
        return state.allAssets;
    } catch (e) { 
        console.warn("Assets Fetch Error:", e);
        return [];
    }
}

export async function fetchLager() {
    if (!state.currentFirmaId) return [];
    try {
        const { data } = await state.supabaseClient.from('lager').select('*').eq('firma_id', state.currentFirmaId).order('navn');
        return data || [];
    } catch (e) { 
        console.warn("Lager Fetch Error:", e);
        return [];
    }
}

/**
 * Diamond Recursive Path Engine 🛰️🏗️
 * Forstår stier som 'Hal 1 > Reol A > Plads 4' og opretter hierarkiet.
 */
export async function ensureLocationPath(pathStr) {
    if (!pathStr || pathStr.trim() === '') return null;
    const parts = pathStr.split('>').map(p => p.trim());
    let currentParentId = null;

    for (const part of parts) {
        let loc = state.allLocations.find(l => 
            l.navn.toLowerCase() === part.toLowerCase() && 
            l.parent_id === currentParentId
        );

        if (!loc) {
            const { data, error } = await state.supabaseClient.from('lokationer').insert({
                firma_id: state.currentFirmaId,
                navn: part,
                parent_id: currentParentId
            }).select().single();
            
            if (error) throw error;
            loc = data;
            state.allLocations.push(loc);
        }
        currentParentId = loc.id;
    }
    return currentParentId;
}

export async function ensureCategory(name) {
    if (!name) return null;
    let cat = state.allCategories?.find(c => c.navn.toLowerCase() === name.trim().toLowerCase());
    if (!cat) {
        const { data, error } = await state.supabaseClient.from('kategorier').insert({
            firma_id: state.currentFirmaId,
            navn: name.trim()
        }).select().single();
        if (error) return null;
        cat = data;
        if (state.allCategories) state.allCategories.push(cat);
    }
    return cat.id;
}

export async function exportToCsv(type) {
    showSnackbar(`Forbereder eksport af ${type}... ⏳`);
    const table = type === 'assets' ? 'assets' : 'lager';
    const { data } = await state.supabaseClient.from(table).select('*').eq('firma_id', state.currentFirmaId);
    
    if (!data || data.length === 0) {
        showSnackbar("Ingen data at eksportere!");
        return;
    }

    const headers = Object.keys(data[0]).join(',');
    const csv = [headers, ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `easyon_${type}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSnackbar("Eksport færdig! 📉");
}

window.exportToCsv = exportToCsv;
