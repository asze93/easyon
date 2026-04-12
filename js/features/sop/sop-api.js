/**
 * EASYON DIAMOND SOP API (v84.0) 🧠📊
 * Handles data fetching and persistence for SOPs.
 */

import { state } from '../../core/app-state.js';
import { setLoading, showSnackbar } from '../../ui/ui-helpers.js';

export async function fetchAllProcedures() {
    if (!state.currentFirmaId) return [];
    try {
        const { data } = await state.supabaseClient.from('procedurer').select('*').eq('firma_id', state.currentFirmaId).order('titel');
        return data || [];
    } catch (e) {
        console.warn("SOP Data Fetch Error:", e);
        return [];
    }
}

export async function saveProcedure(sopData) {
    if (!state.currentFirmaId) return null;
    setLoading(true);
    try {
        const payload = {
            ...sopData,
            firma_id: state.currentFirmaId,
            updated_at: new Date()
        };

        let result;
        if (sopData.id) {
            result = await state.supabaseClient.from('procedurer').update(payload).eq('id', sopData.id).select();
        } else {
            result = await state.supabaseClient.from('procedurer').insert([payload]).select();
        }

        if (result.error) throw result.error;
        showSnackbar("Procedure gemt! 💾✔️");
        return result.data[0];
    } catch (e) {
        console.error("SOP Save Error:", e);
        showSnackbar("Kunne ikke gemme proceduren. ❌", "error");
        return null;
    } finally {
        setLoading(false);
    }
}

export async function deleteProcedure(sopId) {
    if (!confirm("Er du sikker på, at du vil slette denne procedure? 🗑️")) return false;
    try {
        const { error } = await state.supabaseClient.from('procedurer').delete().eq('id', sopId);
        if (error) throw error;
        showSnackbar("Procedure slettet. 🗑️");
        return true;
    } catch (e) {
        console.warn("SOP Delete Error:", e);
        return false;
    }
}
