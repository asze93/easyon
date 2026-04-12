/**
 * EASYON DIAMOND CATEGORY MANAGER (v84.0) 🏷️💎🚀
 * Alt omkring opgavekategorier og farvekoder.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, openModal, closeAllModals, setLoading, showMobileDetail } from '../ui/ui-helpers.js';
import { fetchCategories, fetchStats } from '../services/api-service.js';

export function selectCategory(c) {
    document.querySelectorAll('#categoriesList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`cat-item-${c.id}`)?.classList.add('active');
    const preview = document.getElementById('categoriesPreview'); if (!preview) return;

    // Trigger mobile drill-down
    showMobileDetail('categories');

    preview.innerHTML = `
        <!-- Mobile Back Button -->
        <div class="mobile-back-btn" onclick="hideMobileDetail('categories')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            Tilbage til listen
        </div>

        <h1 style="font-size:32px; font-weight:800;">${c.navn}</h1>
        <div style="display:flex; gap:12px; margin-top:30px;">
            <button class="btn-primary" onclick='editCategory(${JSON.stringify(c).replace(/'/g, "&#39;")})'>📝 Rediger</button>
            <button class="btn-outline" onclick="confirmDelete('${c.id}', 'kategorier')">🗑️ Slet</button>
        </div>
    `;
}


export function editCategory(c) {
    document.getElementById('catId').value = c.id;
    document.getElementById('catName').value = c.navn;
    document.getElementById('catColor').value = '#' + (c.farve || 'ffffff');
    openModal('modal-category');
}

export async function handleCategorySubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('catId').value;
    const data = {
        firma_id: state.currentFirmaId,
        navn: document.getElementById('catName').value,
        farve: document.getElementById('catColor').value.replace('#', '')
    };
    try {
        if (id) await state.supabaseClient.from('kategorier').update(data).eq('id', id);
        else await state.supabaseClient.from('kategorier').insert(data);
        fetchCategories(); 
        closeAllModals(); 
        showSnackbar("Kategori gemt! 🏷️"); 
    } catch (err) {
        showSnackbar("Kunne ikke gemme kategori: " + err.message);
    } finally {
        setLoading(btn, false);
    }
}

// EXPOSE GLOBALS for Legacy HTML support
window.selectCategory = selectCategory;
window.editCategory = editCategory;
window.handleCategorySubmit = handleCategorySubmit;
