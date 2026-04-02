let supabaseClient;
let currentUser = null;
let currentView = 'landing';
let currentFirmaSettings = {};
let isGlobalAdmin = false;
let kraeverAnmodningReview = true;
let authMode = 'login'; 
let currentFirmaId = null;

// ---------------- UI HELPERS ----------------
function togglePassVisibility(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = (input.type === 'password' ? 'text' : 'password');
}

function showSnackbar(msg) {
    const sb = document.getElementById('snackbar');
    if (!sb) return;
    sb.innerText = msg;
    sb.className = 'snackbar show';
    setTimeout(() => { sb.className = sb.className.replace('show', ''); }, 3000);
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    if (viewId === 'dashboard') document.body.classList.add('dashboard-mode');
    else document.body.classList.remove('dashboard-mode');
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        if (viewId !== 'dashboard') window.scrollTo(0, 0);
    }
}

// ---------------- INITIALIZATION ----------------
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

function initSupabase() {
    const { createClient } = supabase;
    // USE ACTUAL CONFIG.JS CONSTANTS
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
            loadDashboard();
        } else {
            const savedProfile = localStorage.getItem('easyon_session_profile');
            if (savedProfile) {
                 loadDashboard(JSON.parse(savedProfile));
            } else {
                 showView('landing');
            }
        }
    });
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    if (currentUser) loadDashboard();
}

// ---------------- AUTHENTICATION ----------------
function toggleAuthMode(forcedMode) {
    if (forcedMode) authMode = forcedMode;
    else authMode = (authMode === 'login' ? 'signup' : 'login');
    const authTitle = document.getElementById('authTitle'), authBtn = document.getElementById('authBtn'),
          authEmailLabel = document.getElementById('authEmailLabel'), authEmail = document.getElementById('authEmail'),
          toggleText = document.getElementById('toggleText'), toggleLink = document.getElementById('toggleLink'),
          passConfirmGroup = document.getElementById('passConfirmGroup'), nameGroup = document.getElementById('nameGroup'),
          firmaGroup = document.getElementById('loginFirmaGroup');
    const fields = ['authEmail', 'authPass', 'authPassConfirm', 'authFirstName', 'authLastName', 'authCompanyName', 'authLoginFirma'];
    fields.forEach(f => { const el = document.getElementById(f); if (el) el.value = ""; });
    if (authMode === 'signup') {
        authTitle.innerText = 'Opret din EasyON konto'; authEmailLabel.innerText = 'E-mail adresse';
        authEmail.placeholder = 'navn@firma.dk'; authBtn.innerText = 'Næste: Firma info';
        toggleText.innerText = 'Har du allerede en konto?'; toggleLink.innerText = 'Log ind her';
        if (passConfirmGroup) passConfirmGroup.classList.remove('hidden');
        if (nameGroup) nameGroup.classList.remove('hidden');
        if (firmaGroup) firmaGroup.classList.add('hidden');
    } else {
        authTitle.innerText = 'Log ind på EasyON'; authEmailLabel.innerText = 'Login-ID (ID eller E-mail)';
        authEmail.placeholder = 'E-mail eller medarbejder-nr.'; authBtn.innerText = 'Log ind';
        toggleText.innerText = 'Har du ikke en konto?'; toggleLink.innerText = 'Opret her';
        if (passConfirmGroup) passConfirmGroup.classList.add('hidden');
        if (nameGroup) nameGroup.classList.add('hidden');
        if (firmaGroup) firmaGroup.classList.remove('hidden');
    }
    showView('auth');
}

async function handleAuth(e) {
    e.preventDefault();
    const btn = e.submitter || document.getElementById('authBtn');
    const oldText = btn.innerText;
    btn.innerText = "Logger ind...";
    btn.disabled = true;

    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    
    try {
        if (authMode === 'signup') {
            const firstName = document.getElementById('authFirstName').value, lastName = document.getElementById('authLastName').value,
                  companyName = document.getElementById('authCompanyName').value, passConfirm = document.getElementById('authPassConfirm').value;
            if (pass.length < 6) throw new Error("Adgangskoden skal være mindst 6 tegn lang.");
            if (pass !== passConfirm) throw new Error("Adgangskoderne er ikke ens!");
            
            const { data, error } = await supabaseClient.auth.signUp({
                email: email, password: pass,
                options: { data: { full_name: `${firstName} ${lastName}`, company: companyName } }
            });
            if (error) throw error;
            if (data.session) { currentUser = data.session.user; showView('wizard'); }
            else showView('verify-email');
        } else {
            const loginFirma = document.getElementById('authLoginFirma')?.value || "";
            
            // 1. Prøv Email-login direkte hvis der er et @
            if (email.includes('@')) {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
                if (error) throw error;
                // session-change listener tager sig af resten
            } else {
                // 2. Medarbejder-login (Firma + ID + Kode)
                if (!loginFirma) throw new Error("Venligst indtast firmanavn.");
                
                const { data: firmaData, error: fErr } = await supabaseClient.from('firmaer').select('id').ilike('navn', loginFirma).maybeSingle();
                if (!firmaData) throw new Error("Firmaet blev ikke fundet.");

                // Tjek direkte i brugere tabellen
                const { data: profile, error: pErr } = await supabaseClient.from('brugere')
                    .select('*')
                    .eq('firma_id', firmaData.id)
                    .eq('arbejdsnummer', email)
                    .eq('adgangskode', pass)
                    .maybeSingle();

                if (profile) {
                    // Fundet via ID + Kode! Gem profil lokalt og log ind.
                    localStorage.setItem('easyon_session_profile', JSON.stringify(profile));
                    localStorage.setItem('firmaId', profile.firma_id);
                    localStorage.setItem('brugerNavn', profile.navn);
                    localStorage.setItem('brugerRolle', profile.rolle);
                    loadDashboard(profile);
                } else {
                    // 3. Fallback: Er det en admin der bruger sit ID men har en rigtig Auth-kode?
                    const { data: adminUser } = await supabaseClient.from('brugere')
                        .select('email, adgangskode')
                        .eq('firma_id', firmaData.id)
                        .eq('arbejdsnummer', email)
                        .maybeSingle();

                    if (adminUser && adminUser.adgangskode === 'AUTH') {
                        const { error: aErr } = await supabaseClient.auth.signInWithPassword({ email: adminUser.email, password: pass });
                        if (aErr) throw new Error("Forkert adgangskode til admin-konto.");
                    } else {
                        throw new Error("ERROR V2: Ugyldig kombination af firma, ID og kode.");
                    }
                }
            }
        }
    } catch (err) { 
        showSnackbar(err.message); 
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
}

// ---------------- WIZARD ----------------
async function nextWizard(step, btn) {
    if (step === 2) {
        const bizName = document.getElementById('bizName').value || "", bizInd = document.getElementById('bizIndustry').value || "",
              bizAddr = document.getElementById('bizAddress').value || "", bizPhone = document.getElementById('bizPhone').value || "",
              bizCVR = document.getElementById('bizCVR').value || "";
        
        if (!bizName) { showSnackbar("Firmanavn er påkrævet."); return; }
        
        // Update Indicators
        const ind1 = document.getElementById('stepIndicator1'), ind2 = document.getElementById('stepIndicator2');
        if (ind1) ind1.classList.remove('active');
        if (ind2) ind2.classList.add('active');

        document.getElementById('step1').classList.add('hidden');
        document.getElementById('step2').classList.remove('hidden');
        try {
            const { data: firma, error: fError } = await supabaseClient.from('firmaer').insert({ 
                navn: bizName, adresse: bizAddr, telefon: bizPhone, cvr_nummer: bizCVR, branche: bizInd 
            }).select().maybeSingle();
            if (fError) throw fError;
            if (!firma) throw new Error("Firmaet kunne ikke oprettes.");
            
            // Persistence: Critical first step
            localStorage.setItem('easyon_firma_id', firma.id);
            localStorage.setItem('easyon_user_role', 'admin.admin');
            currentFirmaId = firma.id;

            const fullName = currentUser.user_metadata.full_name || "Admin";
            const profileData = {
                id: currentUser.id, // Linking to Auth UID is safer
                email: currentUser.email,
                firma_id: firma.id, 
                navn: fullName, 
                rolle: 'admin.admin', 
                arbejdsnummer: 'master', 
                adgangskode: '1234' 
            };
            
            // Try insert. If row exists (from some previous state), update it.
            const { error: insertErr } = await supabaseClient.from('brugere').insert(profileData);
            if (insertErr) {
                console.warn("Profile Insert failed, retrying update:", insertErr.message);
                await supabaseClient.from('brugere').update(profileData).eq('email', currentUser.email);
            }

            await supabaseClient.from('firma_indstillinger').upsert({ firma_id: firma.id });
            
            showSnackbar("Systemet er klar!");
            setTimeout(() => { location.reload(); }, 1000);
        } catch (e) { 
            showSnackbar("Fejl: " + e.message); 
            console.error("Wizard Error:", e);
            btn.innerText = "Prøv igen"; btn.disabled = false;
            document.getElementById('step2').classList.add('hidden'); 
            document.getElementById('step1').classList.remove('hidden'); 
            if (ind2) ind2.classList.remove('active');
            if (ind1) ind1.classList.add('active');
        }
    }
}

// ---------------- DASHBOARD & DATA ----------------
async function loadDashboard(providedProfile = null) {
    showView('dashboard');
    let profile = providedProfile;
    if (!profile && currentUser) {
        for (let i = 0; i < 3; i++) {
            const { data } = await supabaseClient.from('brugere').select('*').eq('email', currentUser.email).maybeSingle();
            if (data) { profile = data; break; }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    if (profile) {
        currentFirmaId = profile.firma_id;
        const lowRole = (profile.rolle || "").toLowerCase();
        
        isGlobalAdmin = lowRole.includes('admin');
        isSuperUser = isGlobalAdmin || lowRole.includes('superbruger');

        localStorage.setItem('easyon_user_role', lowRole);
        localStorage.setItem('easyon_session_profile', JSON.stringify(profile));
        localStorage.setItem('easyon_firma_id', currentFirmaId);
        
        const { data: f } = await supabaseClient.from('firmaer').select('navn').eq('id', currentFirmaId).maybeSingle();
        document.querySelectorAll('.adminName').forEach(el => el.innerText = profile.navn + " - " + (f?.navn || "EasyON"));
    } else { 
        // FALLBACK: Check LocalStorage if database is slow or offline
        const savedFirmaId = localStorage.getItem('easyon_firma_id');
        const savedRole = localStorage.getItem('easyon_user_role') || "";
        
        if (savedFirmaId && currentUser) {
            currentFirmaId = savedFirmaId;
            isGlobalAdmin = savedRole.includes('admin');
            isSuperUser = isGlobalAdmin || savedRole.includes('superbruger');
        } else {
            isGlobalAdmin = false;
            isSuperUser = false; 
        }
    }
    
    // UI Visibility Toggles
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isGlobalAdmin));
    
    // Foundation & System categories are Admin-only
    fetchStats(); fetchTasks(); fetchRequests(); fetchTeam(); dashTab('overview');
}

function dashTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(n => n.classList.remove('active'));
    const t = document.getElementById('dash-' + tabId); if (t) t.classList.add('active');
    document.querySelectorAll('.dash-nav[data-tab="'+tabId+'"]').forEach(n => n.classList.add('active'));
}

function dashNavTab(e, tabId) {
    if (e) e.preventDefault();
    const adminTabs = ['team', 'indstillinger', 'categories', 'locations', 'assets', 'lager', 'kpi'];
    const superUserTabs = ['tasks', 'requests', 'statistics', 'overview'];
    
    if (adminTabs.includes(tabId) && !isGlobalAdmin) { 
        showSnackbar("Ingen adgang - kun for Administratorer."); 
        return; 
    }
    if (tabId === 'lager') fetchLager();
    if (tabId === 'kpi') fetchKpiSettings();
    if (tabId === 'statistics') loadDashboardStats();
    dashTab(tabId);
}

function applyKpiSettings(settings) {
    if (!settings) return;
    const cards = {
        'kpi_svartid': 'card-svartid',
        'kpi_materiale': 'card-materiale',
        'kpi_maskin': 'card-maskin',
        'kpi_fordeling': 'card-fordeling'
    };
    let anyVisible = false;
    if (settings.vis_svartid) { document.getElementById('card-svartid')?.classList.remove('hidden'); anyVisible = true; }
    else { document.getElementById('card-svartid')?.classList.add('hidden'); }
    
    if (settings.vis_materialeforbrug) { document.getElementById('card-materiale')?.classList.remove('hidden'); anyVisible = true; }
    else { document.getElementById('card-materiale')?.classList.add('hidden'); }
    
    if (settings.vis_maskinstilstand) { document.getElementById('card-maskin')?.classList.remove('hidden'); anyVisible = true; }
    else { document.getElementById('card-maskin')?.classList.add('hidden'); }
    
    if (settings.vis_opgave_fordeling) { document.getElementById('card-fordeling')?.classList.remove('hidden'); anyVisible = true; }
    else { document.getElementById('card-fordeling')?.classList.add('hidden'); }
    
    document.getElementById('no-kpi-msg')?.classList.toggle('hidden', anyVisible);
}

async function fetchKpiSettings() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('kpi_konfiguration').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) {
        document.getElementById('kpi_svartid').checked = data.vis_svartid;
        document.getElementById('kpi_materiale').checked = data.vis_materialeforbrug;
        document.getElementById('kpi_maskin').checked = data.vis_maskinstilstand;
        document.getElementById('kpi_fordeling').checked = data.vis_opgave_fordeling;
        applyKpiSettings(data);
    }
}

async function saveKpiSettings() {
    const s = {
        firma_id: currentFirmaId,
        vis_svartid: document.getElementById('kpi_svartid').checked,
        vis_materialeforbrug: document.getElementById('kpi_materiale').checked,
        vis_maskinstilstand: document.getElementById('kpi_maskin').checked,
        vis_opgave_fordeling: document.getElementById('kpi_fordeling').checked,
        opdateret_at: new Date().toISOString()
    };
    await supabaseClient.from('kpi_konfiguration').upsert(s, { onConflict: 'firma_id' });
    applyKpiSettings(s);
    showSnackbar("KPI indstillinger gemt!");
}

// ---------------- FETCHERS ----------------
async function fetchStats() {
    const { count: tasks } = await supabaseClient.from('opgaver').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
    const { count: assets } = await supabaseClient.from('assets').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
    const { count: reqs } = await supabaseClient.from('anmodninger').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
    const elTasks = document.getElementById('stat-active-tasks'), elAssets = document.getElementById('stat-total-assets'), elReqs = document.getElementById('stat-pending-requests');
    if (elTasks) elTasks.innerText = tasks || 0; if (elAssets) elAssets.innerText = assets || 0; if (elReqs) elReqs.innerText = reqs || 0;
}

async function fetchTeam() {
    const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
    const b = document.getElementById('teamBody'); if (!b) return; b.innerHTML = "";
    data?.forEach(u => {
        b.innerHTML += `<tr><td>${u.navn}</td><td>${u.arbejdsnummer}</td><td>${u.rolle}</td><td><button class="btn-outline btn-sm" onclick="deleteTeamMember('${u.id}')">Slet</button></td></tr>`;
    });
}

async function fetchTasks() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('opgaver').select('*').eq('firma_id', currentFirmaId).order('created_at', { ascending: false });
    const b = document.getElementById('tasksBody'); if (!b) return; b.innerHTML = "";
    data?.forEach(t => {
        const actionLabel = isSuperUser ? 'Åbn' : 'Vis';
        const priorityLabel = (t.prioritet == 3) ? 'Høj' : (t.prioritet == 2 ? 'Middel' : 'Lav');
        b.innerHTML += `<tr>
            <td>${t.titel}</td>
            <td>${t.asset_navn || '-'}</td>
            <td><span class="badge prio-${priorityLabel.toLowerCase()}">${priorityLabel}</span></td>
            <td>${t.kategori || '-'}</td>
            <td><button class="btn-outline btn-sm" onclick="editTask('${t.id}')">${actionLabel}</button></td>
        </tr>`;
    });
}

async function fetchRequests() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('anmodninger').select('*').eq('firma_id', currentFirmaId).order('created_at', { ascending: false });
    const b = document.getElementById('requestsBody'); if (!b) return; b.innerHTML = "";
    data?.forEach(r => {
        b.innerHTML += `<tr><td>${r.titel}</td><td>${r.beskrivelse}</td><td><button class="btn-primary btn-sm" onclick="convertRequest('${r.id}')">Lav til Opgave</button></td></tr>`;
    });
}

// ---------------- MODALS & CRUD ----------------
// ---------------- MODALS & HELPERS ----------------
function openModal(id, reset = false) {
    const m = document.getElementById(id); if (!m) return;
    if (reset) {
        m.querySelectorAll('form').forEach(f => f.reset());
        m.querySelectorAll('input, textarea, select').forEach(i => i.disabled = false);
        const saveBtn = m.querySelector('button[type="submit"]');
        if (saveBtn) saveBtn.style.display = 'block';
    }
    m.classList.remove('hidden'); document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeAllModals() {
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.getElementById('modal-overlay').classList.add('hidden');
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('teamName').value, nr = document.getElementById('teamNr').value, role = document.getElementById('teamRolle').value;
    const { error } = await supabaseClient.from('brugere').insert({ firma_id: currentFirmaId, navn: name, arbejdsnummer: nr, rolle: role, adgangskode: '1234' });
    if (error) showSnackbar("Fejl: " + error.message); else { showSnackbar("Medlem tilføjet!"); closeAllModals(); fetchTeam(); }
}

async function deleteTeamMember(id) {
    if (!confirm("Slet dette medlem?")) return;
    await supabaseClient.from('brugere').delete().eq('id', id); fetchTeam();
}

async function editTask(id) {
    const { data } = await supabaseClient.from('opgaver').select('*').eq('id', id).maybeSingle();
    if (!data) return;
    
    // Fill Modal
    document.getElementById('taskId').value = data.id;
    document.getElementById('taskTitle').value = data.titel || "";
    document.getElementById('taskDesc').value = data.beskrivelse || "";
    document.getElementById('taskStatus').value = data.status || "Venter";
    
    // If not SuperUser, disable the fields (View-only mode)
    const formInputs = document.getElementById('modal-task').querySelectorAll('input, textarea, select');
    formInputs.forEach(input => input.disabled = !isSuperUser);
    const saveBtn = document.getElementById('modal-task').querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.style.display = isSuperUser ? 'block' : 'none';

    openModal('modal-task');
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    if (!isSuperUser && document.getElementById('taskId').value) {
        showSnackbar("Du har ikke rettigheder til at ændre denne opgave.");
        return;
    }
    
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const desc = document.getElementById('taskDesc').value;
    const status = document.getElementById('taskStatus').value;
    
    const taskData = {
        firma_id: currentFirmaId,
        titel: title,
        beskrivelse: desc,
        status: status
    };

    let result;
    if (id) {
        result = await supabaseClient.from('opgaver').update(taskData).eq('id', id);
    } else {
        result = await supabaseClient.from('opgaver').insert(taskData);
    }
    
    if (result.error) showSnackbar("Fejl: " + result.error.message);
    else { showSnackbar(id ? "Opgave opdateret!" : "Opgave oprettet!"); closeAllModals(); fetchTasks(); }
}

// ---------------- ASSETS & LOCATIONS ----------------
async function fetchAssets() {
    const { data } = await supabaseClient.from('assets').select('*').eq('firma_id', currentFirmaId);
    const b = document.getElementById('assetsBody'); if (b) {
        b.innerHTML = "";
        data?.forEach(a => b.innerHTML += `<tr><td>${a.navn}</td><td>${a.lokation_id || 'Ingen'}</td><td><button class="btn-outline btn-sm">Rediger</button></td></tr>`);
    }
}
async function fetchCategories() {
    const { data } = await supabaseClient.from('kategorier').select('*').eq('firma_id', currentFirmaId);
    const b = document.getElementById('categoriesBody'); if (b) {
        b.innerHTML = "";
        data?.forEach(c => b.innerHTML += `<tr><td>${c.navn}</td><td><span style="background:${c.farve}; width:20px; height:20px; display:inline-block; border-radius:50%"></span></td><td>${new Date(c.created_at).toLocaleDateString()}</td></tr>`);
    }
}
async function fetchIndstillinger() {
    const { data } = await supabaseClient.from('firma_indstillinger').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) {
        document.getElementById('kraever_review').checked = data.kraever_anmodning_review;
        document.getElementById('set_lokationer').checked = data.aktiver_lokationer;
        document.getElementById('set_sop').checked = data.aktiver_sop;
    }
}

async function saveIndstillinger() {
    const rev = document.getElementById('kraever_review').checked, lok = document.getElementById('set_lokationer').checked, sop = document.getElementById('set_sop').checked;
    await supabaseClient.from('firma_indstillinger').upsert({ firma_id: currentFirmaId, kraever_anmodning_review: rev, aktiver_lokationer: lok, aktiver_sop: sop });
    showSnackbar("Indstillinger gemt!");
}
async function fetchLager() {
    const { data } = await supabaseClient.from('lager').select('*').eq('firma_id', currentFirmaId).order('navn');
    const b = document.getElementById('lagerBody'); if (!b) return; b.innerHTML = "";
    data?.forEach(item => {
        const isLow = item.antal_paa_lager <= item.minimums_beholdning;
        const rowStyle = isLow ? 'background-color: #ffebee; font-weight: bold; color: #c62828;' : '';
        b.innerHTML += `<tr style="${rowStyle}">
            <td>${item.navn}</td>
            <td>${item.lokation_tekst || '-'}</td>
            <td>${item.antal_paa_lager} ${item.enhed || 'stk'}</td>
            <td>${item.minimums_beholdning}</td>
            <td><code>${item.stregkode_sscc || '-'}</code></td>
            <td>
                <button class="btn-outline btn-sm" onclick="editLager('${item.id}')">✏️</button>
                <button class="btn-outline btn-sm" onclick="deleteLager('${item.id}')">🗑️</button>
            </td>
        </tr>`;
    });
}

async function handleLagerSubmit(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('lagerId').value;
    const itemData = {
        navn: document.getElementById('lagerNavn').value,
        lokation_tekst: document.getElementById('lagerLokation').value,
        antal_paa_lager: parseInt(document.getElementById('lagerAntal').value),
        minimums_beholdning: parseInt(document.getElementById('lagerMin').value),
        stregkode_sscc: document.getElementById('lagerCode').value,
        firma_id: currentFirmaId
    };

    let result;
    if (id) {
        result = await supabaseClient.from('lager').update(itemData).eq('id', id);
    } else {
        result = await supabaseClient.from('lager').insert(itemData);
    }

    if (result.error) showSnackbar("Fejl: " + result.error.message);
    else {
        showSnackbar(id ? "Reservedel opdateret!" : "Reservedel tilføjet!");
        closeAllModals();
        fetchLager();
    }
}

async function editLager(id) {
    const { data } = await supabaseClient.from('lager').select('*').eq('id', id).maybeSingle();
    if (data) {
        document.getElementById('lagerId').value = data.id;
        document.getElementById('lagerNavn').value = data.navn;
        document.getElementById('lagerLokation').value = data.lokation_tekst;
        document.getElementById('lagerAntal').value = data.antal_paa_lager;
        document.getElementById('lagerMin').value = data.minimums_beholdning;
        document.getElementById('lagerCode').value = data.stregkode_sscc || "";
        openModal('modal-lager', false);
    }
}

async function deleteLager(id) {
    if (confirm("Er du sikker på du vil slette denne lagervare?")) {
        await supabaseClient.from('lager').delete().eq('id', id);
        fetchLager();
    }
}
