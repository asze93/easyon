/**
 * EASYON DIAMOND AUTH SERVICE (v84.0) 🔒🚀
 * Alt omkring login, signup og profil-synkronisering.
 */

import { state } from '../core/app-state.js';
import { showSnackbar, showLoading, setLoading, showView, updateLandingUI } from '../ui/ui-helpers.js';
import { fetchStats, fetchTasks, fetchRequests, fetchTeam, fetchAssets, fetchLocations, fetchCategories } from './api-service.js';

export async function handleAuth(e) {
    if (e) e.preventDefault();
    const btn = e.submitter || document.getElementById('authBtn');
    if (btn.disabled) return;

    setLoading(btn, true);
    let authTimedOut = false;
    const authTimeout = setTimeout(() => {
        authTimedOut = true;
        setLoading(btn, false);
        showSnackbar("Login timeout: Kunne ikke forbinde til serveren. Prøv igen.");
    }, 8000);

    try {
        const email = document.getElementById('auth_email_input').value.trim();
        const pass = document.getElementById('auth_password_input').value;
        const loginFirma = document.getElementById('auth_login_firma_input')?.value.trim() || "";

        if (state.authMode === 'signup') {
            const firstName = document.getElementById('auth_first_name_input').value;
            const lastName = document.getElementById('auth_last_name_input').value;
            const { data, error } = await state.supabaseClient.auth.signUp({
                email, password: pass,
                options: { data: { full_name: `${firstName} ${lastName}` } }
            });
            if (error) throw error;
            showView('wizard');
        } else {
            // Safety Check: Is Supabase ready? 🛰️
            if (!state.supabaseClient) {
                console.warn("Supabase client not initialized yet. Retrying...");
                throw new Error("Systemet vågner stadig... Prøv igen om 2 sekunder. 💎🛰️");
            }

            const { data: result, error: rpcError } = await state.supabaseClient.rpc('universal_diamond_login', {
                f_name: loginFirma,
                login_id: email,
                pin_code: pass
            });

            if (authTimedOut) return;
            clearTimeout(authTimeout);

            if (rpcError) throw new Error("Database fejl: " + rpcError.message);
            if (result && result.status === 'error') throw new Error(result.message);

            if (result && result.status === 'success') {
                localStorage.setItem('easyon_session_profile', JSON.stringify(result));
                localStorage.setItem('easyon_firma_id', result.firma_id);
                await loadDashboard(result);
            } else {
                throw new Error("Kunne ikke logge ind. Uventet svar fra serveren.");
            }
        }
    } catch (err) {
        if (!authTimedOut) {
            clearTimeout(authTimeout);
            showSnackbar(err.message || "Login fejlede.");
            setLoading(btn, false);
        }
    } finally {
        if (!authTimedOut) setLoading(btn, false);
    }
}

export async function loadDashboard(providedProfile = null) {
    console.log("--- DASHBOARD LOADING (MODULAR) ---");
    let profile = providedProfile;
    if (!profile && state.currentUser?.id) {
        const { data } = await state.supabaseClient.from('brugere').select('*, firmaer(navn)').eq('id', state.currentUser.id).maybeSingle();
        if (data) profile = data;
    }

    if (profile) {
        state.currentFirmaId = profile.firma_id;
        const lowRole = (profile.rolle || "").toLowerCase();
        state.isGlobalAdmin = lowRole.includes('admin');
        state.isSuperUser = state.isGlobalAdmin || lowRole.includes('superbruger');

        localStorage.setItem('easyon_user_role', lowRole);
        localStorage.setItem('easyon_session_profile', JSON.stringify(profile));
        localStorage.setItem('easyon_firma_id', state.currentFirmaId);

        // Smart Name Mapping 👋✨
        const displayName = profile.full_name || (profile.fornavn ? `${profile.fornavn} ${profile.efternavn || ''}` : null) || profile.navn || profile.email || "Bruger";
        
        const { data: f } = await state.supabaseClient.from('firmaer').select('navn').eq('id', state.currentFirmaId).maybeSingle();
        const displayFirma = f?.navn || "EasyON";
        
        document.querySelectorAll('.adminName').forEach(el => el.innerText = displayName);
        
        // Populate Identity Display (Email • Role • Firma)
        const idDisplay = document.getElementById('user-display-identity');
        if (idDisplay) {
            idDisplay.innerText = `${profile.email || ''} • ${lowRole.toUpperCase()} • ${displayFirma}`;
        }

        showView('dashboard');
        updateLandingUI(); // Update landing page state 🧭
        document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !state.isGlobalAdmin));

        // INITIALIZE ALL DATA (FROM API-SERVICE)
        fetchStats(); 
        fetchTasks(); 
        fetchRequests(); 
        fetchTeam();
        fetchAssets();
        fetchLocations();
        fetchCategories();
    } else {
        showView('landing');
    }
}

export async function logout() {
    showSnackbar("Logger ud...");
    if (state.supabaseClient) await state.supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    updateLandingUI(); // Reset landing page state 🧭
    showView('landing');
    setTimeout(() => { location.reload(); }, 500);
}

// ---------------- WIZARD ----------------
export async function nextWizard(step, btn) {
    if (step === 2) {
        const bizName = (document.getElementById('bizName')?.value || "").trim();
        const bizIndustry = document.getElementById('bizIndustry')?.value;
        const bizAddress = document.getElementById('bizAddress')?.value;
        const bizPhone = document.getElementById('bizPhone')?.value;
        const bizCVR = document.getElementById('bizCVR')?.value;

        if (!bizName) { showSnackbar("Firmanavn er påkrævet."); return; }

        setLoading(btn, true);
        try {
            // 1. Opret firmaet (Databasen vil fejle hvis navnet findes pga. UNIQUE constraint)
            const { data: firma, error: fError } = await state.supabaseClient.from('firmaer').insert({ 
                navn: bizName,
                branche: bizIndustry,
                adresse: bizAddress,
                telefon: bizPhone,
                cvr_nummer: bizCVR
            }).select().maybeSingle();

            if (fError) {
                if (fError.code === '23505') throw new Error("Dette firmanavn er allerede optaget. Vælg et andet!");
                throw fError;
            }

            // 2. Knyt den nuværende Auth bruger til det nye firma
            const { data: { user } } = await state.supabaseClient.auth.getUser();
            if (user) {
                const profileData = {
                    id: user.id, 
                    email: user.email, 
                    firma_id: firma.id,
                    navn: user.user_metadata?.full_name || user.email,
                    rolle: 'admin.master'
                };
                await state.supabaseClient.from('brugere').insert(profileData);
                
                // 3. ✨ INITIALIZE DEFAULT DATA (For a premium first impression) ✨
                // Opret en hoved-lokation
                const { data: loc } = await state.supabaseClient.from('lokationer').insert({
                    firma_id: firma.id,
                    navn: 'Hovedkontor / Produktion',
                    beskrivelse: 'Virksomhedens primære lokation.'
                }).select().maybeSingle();

                // Opret standard kategorier
                await state.supabaseClient.from('kategorier').insert([
                    { firma_id: firma.id, navn: 'Produktionsudstyr', farve: '3B82F6' },
                    { firma_id: firma.id, navn: 'Ejendomsdrift', farve: '10B981' },
                    { firma_id: firma.id, navn: 'IT & Hardware', farve: '8B5CF6' }
                ]);

                // 4. Login succes! Gem i session og send direkte til dashboard
                localStorage.setItem('easyon_session_profile', JSON.stringify(profileData));
                localStorage.setItem('easyon_firma_id', firma.id);
                loadDashboard(profileData);
            }
        } catch (err) {
            showSnackbar("Fejl: " + err.message);
        } finally {
            setLoading(btn, false);
        }
    }
}

// EXPOSE GLOBALS for Legacy HTML support
window.handleAuth = handleAuth;
window.logout = logout;
window.nextWizard = nextWizard;
window.loadDashboard = loadDashboard;
