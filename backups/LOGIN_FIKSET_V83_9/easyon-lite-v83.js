/**
 * EASYON ELITE v83 - ULTIMATE HEROIC RESTORE 💎🚀
 * Alt-i-én stabiliseret version med Fuld Splitview og Diamond Rescue Logic.
 */

let supabaseClient;
let currentUser = null;
let currentView = 'landing';
let currentFirmaSettings = {};
let isGlobalAdmin = false;
let isSuperUser = false;
let authMode = 'login';
let currentFirmaId = null;

// DIAMOND ELITE STATE
let allCategories = [];
let allAssets = [];
let allLocations = [];
let selectedTaskTags = [];
let focusedSuggestionIndex = -1;
let sopSteps = [];
let currentSopId = null;
let currentStepId = null;
let profileLoading = false;

// ---------------- LOADING SCREEN ----------------
function showLoading(isLoading) {
    profileLoading = isLoading;
    const loader = document.getElementById('eliteLoader');
    if (!loader) {
        if (!isLoading) return;
        // Opret loader dynamisk hvis den mangler
        const div = document.createElement('div');
        div.id = 'eliteLoader';
        div.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:#0b0e14; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; color:white; font-family:inherit; transition: opacity 0.5s;';
        div.innerHTML = `
            <div class="pulse-loader" style="width:80px; height:80px; border-radius:50%; background:radial-gradient(circle, var(--accent) 0%, transparent 70%); margin-bottom:20px; animation: pulse 2s infinite;"></div>
            <div style="font-size:24px; font-weight:800; letter-spacing:2px; margin-bottom:10px;">EASYON <span style="color:var(--accent);">ELITE</span></div>
            <div class="text-muted" style="font-size:14px; opacity:0.7;">Gør dit dashboard klar...</div>
            <style>
                @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.3; } 50% { transform: scale(1.2); opacity: 0.8; } 100% { transform: scale(0.8); opacity: 0.3; } }
            </style>
        `;
        document.body.appendChild(div);
        return;
    }
    loader.style.opacity = isLoading ? '1' : '0';
    loader.style.pointerEvents = isLoading ? 'all' : 'none';
}

// ---------------- UI HELPERS ----------------
function togglePassVisibility(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.type = (input.type === 'password' ? 'text' : 'password');
}

function showSnackbar(msg, code = null) {
    const sb = document.getElementById('snackbar');
    if (!sb) return;
    let fullMsg = msg;
    if (code) fullMsg += ` (Fejlkode: ${code})`;
    sb.innerText = fullMsg;
    sb.className = 'snackbar show';
    setTimeout(() => { sb.className = sb.className.replace('show', ''); }, 4000);
}

function setLoading(btn, isLoading, originalText) {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = 'Arbejder...';
        btn.disabled = true;
    } else {
        btn.innerText = originalText || btn.dataset.originalText || 'Fortsæt';
        btn.disabled = false;
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    if (viewId === 'dashboard') {
        document.body.classList.add('dashboard-mode');
    } else {
        document.body.classList.remove('dashboard-mode');
        updateNavbar();
    }
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
    if (typeof SUPABASE_URL === 'undefined') {
        console.error("SUPABASE_URL er ikke defineret! Tjek config.js");
        return;
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Tjek om vi allerede har en gemt session
    const saved = localStorage.getItem('easyon_session_profile');
    if (saved) {
        try {
            const profile = JSON.parse(saved);
            loadDashboard(profile);
        } catch(e) { localStorage.clear(); }
    } else {
        showView('landing');
    }
}

function updateNavbar() {
    const guestNav = document.getElementById('guestNav');
    const userNav = document.getElementById('userNav');
    const guestHero = document.getElementById('guestHeroBtns');
    const userHero = document.getElementById('userHeroBtns');

    const profile = localStorage.getItem('easyon_session_profile');
    if (profile) {
        guestNav?.classList.add('hidden');
        userNav?.classList.remove('hidden');
        guestHero?.classList.add('hidden');
        userHero?.classList.remove('hidden');
    } else {
        guestNav?.classList.remove('hidden');
        userNav?.classList.add('hidden');
        guestHero?.classList.remove('hidden');
        userHero?.classList.add('hidden');
    }
}

// ---------------- AUTHENTICATION ----------------
function toggleAuthMode(forcedMode) {
    if (forcedMode) authMode = forcedMode;
    else authMode = (authMode === 'login' ? 'signup' : 'login');

    if (authMode === 'signup') {
        localStorage.clear();
        sessionStorage.clear();
    }

    const authTitle = document.getElementById('authTitle'), authBtn = document.getElementById('authBtn'),
        authEmailLabel = document.getElementById('authEmailLabel'), authEmail = document.getElementById('auth_email_input'),
        toggleText = document.getElementById('toggleText'), toggleLink = document.getElementById('toggleLink'),
        passConfirmGroup = document.getElementById('passConfirmGroup'), nameGroup = document.getElementById('nameGroup'),
        firmaGroup = document.getElementById('loginFirmaGroup');

    const fields = ['auth_email_input', 'auth_password_input', 'auth_pass_confirm_input', 'auth_first_name_input', 'auth_last_name_input', 'auth_login_firma_input'];
    fields.forEach(f => { const el = document.getElementById(f); if (el) el.value = ""; });

    if (authMode === 'signup') {
        authTitle.innerHTML = 'Opret din <span>EasyON</span> konto';
        authEmailLabel.innerText = 'E-mail adresse';
        authBtn.innerText = 'Næste: Firma info';
        toggleText.innerText = 'Har du allerede en konto?';
        toggleLink.innerText = 'Log ind her';
        if (passConfirmGroup) passConfirmGroup.classList.remove('hidden');
        if (nameGroup) nameGroup.classList.remove('hidden');
        if (firmaGroup) firmaGroup.classList.add('hidden');
    } else {
        authTitle.innerHTML = 'Log ind på <span>EasyON</span>';
        authEmailLabel.innerText = 'Login / Medarbejder ID';
        authBtn.innerText = 'Log ind';
        toggleText.innerText = 'Har du ikke en konto?';
        toggleLink.innerText = 'Opret her';
        if (passConfirmGroup) passConfirmGroup.classList.add('hidden');
        if (nameGroup) nameGroup.classList.add('hidden');
        if (firmaGroup) firmaGroup.classList.remove('hidden');
    }
    showView('auth');
}

async function handleAuth(e) {
    if (e) e.preventDefault();
    const btn = e.submitter || document.getElementById('authBtn');
    if (btn.disabled) return;

    setLoading(btn, true);
    let authTimedOut = false;
    const authTimeout = setTimeout(() => {
        authTimedOut = true;
        setLoading(btn, false);
        showSnackbar("Login timeout: Kunne ikke forbinde til serveren. Prøv igen.");
    }, 8000); // 8 sekunders timeout

    try {
        const email = document.getElementById('auth_email_input').value.trim();
        const pass = document.getElementById('auth_password_input').value;
        const loginFirma = document.getElementById('auth_login_firma_input')?.value.trim() || "";

        if (authMode === 'signup') {
             // Signup køres stadig via standard Auth (Kun for nye Master Admins)
             clearTimeout(authTimeout);
             const firstName = document.getElementById('auth_first_name_input').value;
             const lastName = document.getElementById('auth_last_name_input').value;
             const { data, error } = await supabaseClient.auth.signUp({
                 email, password: pass,
                 options: { data: { full_name: `${firstName} ${lastName}` } }
             });
             if (error) throw error;
             showView('verify-email');
        } else {
             // UNIVERSAL DIAMOND LOGIN (Både Master og Tekniker)
             const { data: result, error: rpcError } = await supabaseClient.rpc('universal_diamond_login', {
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
    }
}

async function loadDashboard(providedProfile = null) {
    console.log("--- DASHBOARD LOADING ---");
    let profile = providedProfile;
    if (!profile && currentUser?.id) {
        console.log("Henter profil via Auth ID...");
        const { data } = await supabaseClient.from('brugere').select('*, firmaer(navn)').eq('id', currentUser.id).maybeSingle();
        if (data) profile = data;
    }

    if (profile) {
        console.log("Dashboard profil klar:", profile.navn);
        currentFirmaId = profile.firma_id;
        const lowRole = (profile.rolle || "").toLowerCase();
        isGlobalAdmin = lowRole.includes('admin');
        isSuperUser = isGlobalAdmin || lowRole.includes('superbruger');

        localStorage.setItem('easyon_user_role', lowRole);
        localStorage.setItem('easyon_session_profile', JSON.stringify(profile));
        localStorage.setItem('easyon_firma_id', currentFirmaId);

        console.log("Opdaterer UI...");
        const { data: f } = await supabaseClient.from('firmaer').select('navn').eq('id', currentFirmaId).maybeSingle();
        document.querySelectorAll('.adminName').forEach(el => el.innerText = profile.navn + " - " + (f?.navn || "EasyON"));

        showView('dashboard');
        document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isGlobalAdmin));

        console.log("Henter oversigts data...");
        fetchStats(); fetchTasks(); fetchRequests(); fetchTeam(); initDiamondElite();
    } else {
        console.log("Ingen profil fundet i loadDashboard.");
        const activeView = document.querySelector('.view.active')?.id;
        if (activeView !== 'view-wizard' && activeView !== 'view-verify-email' && activeView !== 'view-auth') {
            showView('landing');
        }
    }
}

async function logout() {
    showSnackbar("Logger ud...");
    if (supabaseClient) await supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    showView('landing');
    setTimeout(() => {
        location.reload();
    }, 500);
}

// ---------------- WIZARD ----------------
async function nextWizard(step, btn) {
    if (step === 2) {
        const bizName = document.getElementById('bizName').value || "";
        if (!bizName) { showSnackbar("Firmanavn er påkrævet."); return; }

        try {
            const { data: firma, error: fError } = await supabaseClient.from('firmaer').insert({ navn: bizName }).select().maybeSingle();
            if (fError) throw fError;

            currentFirmaId = firma.id;
            localStorage.setItem('easyon_firma_id', firma.id);
            localStorage.setItem('easyon_user_role', 'admin.admin');

            const profileData = {
                id: currentUser.id, email: currentUser.email, firma_id: firma.id,
                navn: currentUser.user_metadata.full_name || "Admin", rolle: 'admin.admin',
                arbejdsnummer: 'master', adgangskode: '1234'
            };

            await supabaseClient.from('brugere').insert(profileData);
            await supabaseClient.from('firma_indstillinger').upsert({ firma_id: firma.id });

            showSnackbar("Systemet er klar!");
            setTimeout(() => { location.reload(); }, 1000);
        } catch (e) { showSnackbar("Fejl: " + e.message); }
    }
}

function dashTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(n => n.classList.remove('active'));
    document.getElementById('dash-' + tabId)?.classList.add('active');
    document.querySelectorAll('.dash-nav[data-tab="' + tabId + '"]').forEach(n => n.classList.add('active'));
}

function dashNavTab(e, tabId) {
    if (e) e.preventDefault();
    const adminTabs = ['team', 'indstillinger', 'categories', 'locations', 'assets', 'lager', 'kpi'];
    if (adminTabs.includes(tabId) && !isGlobalAdmin) { showSnackbar("Ingen adgang."); return; }

    if (document.getElementById('dashboardSidebar')) document.getElementById('dashboardSidebar').classList.remove('mobile-open');
    if (tabId === 'tasks') fetchTasks();
    if (tabId === 'requests') fetchRequests();
    if (tabId === 'lager') fetchLager();
    if (tabId === 'assets') fetchAssets();
    if (tabId === 'locations') fetchLocations();
    if (tabId === 'categories') fetchCategories();
    if (tabId === 'team') fetchTeam();
    if (tabId === 'kpi') fetchKpiSettings();
    if (tabId === 'statistics' || tabId === 'overview') fetchStats();
    dashTab(tabId);
}

async function fetchLocations() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('lokationer').select('*').eq('firma_id', currentFirmaId).order('navn');
    const list = document.getElementById('locationsList'); if (!list) return; list.innerHTML = "";
    if (data?.length === 0) list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen lokationer oprettet.</p>';
    data?.forEach(l => {
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.id = `loc-item-${l.id}`;
        div.onclick = () => selectLocation(l);
        div.innerHTML = `<div style="font-weight:800;">${l.navn}</div><div style="font-size:12px; color:var(--text-muted);">📍 ${l.beskrivelse || 'Lokation'}</div>`;
        list.appendChild(div);
    });
}

async function fetchTeam() {
    try {
        if (!currentFirmaId) return;
        const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId).order('fornavn');
        const list = document.getElementById('teamList'); if (!list) return; list.innerHTML = "";
        if (data?.length === 0) list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen medarbejdere oprettet.</p>';
        data?.forEach(u => {
            const div = document.createElement('div');
            div.className = 'list-card-item';
            div.id = `user-item-${u.id}`;
            div.onclick = () => selectTeamMember(u);
            constDisplayName = u.fornavn ? `${u.fornavn} ${u.efternavn || ''}` : u.navn;
            div.innerHTML = `<div style="font-weight:800;">${constDisplayName}</div><div style="font-size:12px; color:var(--text-muted);">${u.rolle} • ID: ${u.arbejdsnummer}</div>`;
            list.appendChild(div);
        });
    } catch (e) { console.warn("Team Fetch Error:", e); }
}

async function editTeamMember(id) {
    try {
        const { data: u } = await supabaseClient.from('brugere').select('*').eq('id', id).maybeSingle();
        if (u) {
            document.getElementById('teamId').value = u.id;
            document.getElementById('teamFirstName').value = u.fornavn || u.navn || '';
            document.getElementById('teamLastName').value = u.efternavn || '';
            document.getElementById('teamPhone').value = u.telefon || '';
            document.getElementById('teamEmail').value = u.email || '';
            document.getElementById('teamNr').value = u.arbejdsnummer || '';
            document.getElementById('teamPin').value = u.adgangskode || '';
            document.getElementById('teamRolle').value = u.rolle || 'tekniker';
            openModal('modal-team');
        }
    } catch (e) {
        showSnackbar("Kunne ikke hente bruger: " + e.message);
    }
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    try {
        const id = document.getElementById('teamId').value;
        const fornavn = document.getElementById('teamFirstName').value;
        const efternavn = document.getElementById('teamLastName').value;
        const userData = {
            firma_id: currentFirmaId,
            fornavn: fornavn,
            efternavn: efternavn,
            navn: `${fornavn} ${efternavn}`.trim(),
            email: document.getElementById('teamEmail').value || null,
            telefon: document.getElementById('teamPhone').value || null,
            arbejdsnummer: document.getElementById('teamNr').value,
            adgangskode: document.getElementById('teamPin').value,
            rolle: document.getElementById('teamRolle').value
        };

        if (id) await supabaseClient.from('brugere').update(userData).eq('id', id);
        else await supabaseClient.from('brugere').insert(userData);

        showSnackbar("Medarbejder gemt og synkroniseret! 🚀");
        closeAllModals();
        fetchTeam();
    } catch (err) {
        showSnackbar("Fejl ved oprettelse: " + err.message);
    } finally {
        setLoading(btn, false);
    }
}

function selectLocation(l) {
    document.querySelectorAll('#locationsList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`loc-item-${l.id}`)?.classList.add('active');
    const preview = document.getElementById('locationsPreview'); if (!preview) return;
    preview.innerHTML = `<h1 style="font-size:32px; font-weight:800;">${l.navn}</h1><p class="text-muted">${l.beskrivelse || ''}</p><div style="display:flex; gap:12px; margin-top:30px;"><button class="btn-outline">📝 Rediger</button></div>`;
}

async function fetchCategories() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('kategorier').select('*').eq('firma_id', currentFirmaId).order('navn');
    const list = document.getElementById('categoriesList'); if (!list) return; list.innerHTML = "";
    if (data?.length === 0) list.innerHTML = '<p class="text-muted" style="padding:20px;">Ingen kategorier oprettet.</p>';
    data?.forEach(c => {
        const div = document.createElement('div');
        div.className = 'list-card-item';
        div.id = `cat-item-${c.id}`;
        div.onclick = () => selectCategory(c);
        div.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:#${c.farve || 'ccc'}; border-radius:50%;"></div><div style="font-weight:800;">${c.navn}</div></div>`;
        list.appendChild(div);
    });
}

function selectCategory(c) {
    document.querySelectorAll('#categoriesList .list-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`cat-item-${c.id}`)?.classList.add('active');
    const preview = document.getElementById('categoriesPreview'); if (!preview) return;
    preview.innerHTML = `<h1 style="font-size:32px; font-weight:800;">${c.navn}</h1><div style="display:flex; gap:12px; margin-top:30px;"><button class="btn-outline">📝 Rediger</button></div>`;
}

// ---------------- CRUD / SUBMITS ----------------
async function handleTaskSubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('taskId').value;
    const taskData = {
        firma_id: currentFirmaId,
        titel: document.getElementById('taskTitle').value,
        beskrivelse: document.getElementById('taskDesc').value,
        prioritet: parseInt(document.getElementById('taskPriority').value) || 1,
        asset_id: document.getElementById('taskAssetId').value || null,
        lokation_id: document.getElementById('taskLocId').value || null,
        medarbejder_id: null // Tilføj hvis valgt
    };
    if (id) await supabaseClient.from('opgaver').update(taskData).eq('id', id);
    else await supabaseClient.from('opgaver').insert({ ...taskData });
    setLoading(btn, false); closeAllModals(); fetchTasks(); showSnackbar("Opgave gemt! 💎");
}

async function handleAssetSubmit(e) {
    e.preventDefault();
    const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('assetId').value;
    const assetData = {
        firma_id: currentFirmaId, 
        navn: document.getElementById('assetName').value,
        lokation_id: document.getElementById('assetLoc').value || null,
        parent_asset_id: document.getElementById('assetParent').value || null,
        beskrivelse: document.getElementById('assetDesc')?.value || ""
    };
    if (id) await supabaseClient.from('assets').update(assetData).eq('id', id);
    else await supabaseClient.from('assets').insert(assetData);
    setLoading(btn, false); closeAllModals(); fetchAssets(); showSnackbar("Maskine gemt!");
}

async function fetchLager() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('lager').select('*').eq('firma_id', currentFirmaId).order('navn');
    console.log("Lager hentet:", data?.length);
    // Her kan du implementere visning hvis du har et lager tab
}

async function convertRequestToTask(id) {
    showLoading(true);
    try {
        const { data: req } = await supabaseClient.from('anmodninger').select('*').eq('id', id).maybeSingle();
        if (req) {
            await supabaseClient.from('opgaver').insert({
                firma_id: currentFirmaId,
                titel: req.titel,
                beskrivelse: req.beskrivelse,
                asset_id: req.asset_id
            });
            await supabaseClient.from('anmodninger').delete().eq('id', id);
            showSnackbar("Anmodning er nu lavet til en opgave! 🚀");
            fetchRequests();
            fetchTasks();
        }
    } catch (e) {
        showSnackbar("Kunne ikke konvertere: " + e.message);
    } finally {
        showLoading(false);
    }
}

// ---------------- GLOBAL MODALS ----------------
function openModal(id, reset = false) {
    const m = document.getElementById(id); if (!m) return;
    if (reset) m.querySelectorAll('form').forEach(f => f.reset());
    m.classList.remove('hidden'); document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeAllModals() {
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.getElementById('modal-overlay').classList.add('hidden');
}

function showLoading(isLoading) {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.toggle('hidden', !isLoading);
}

function setupEliteEventListeners() {
    const catInput = document.getElementById('categoryTagInput');
    if (catInput) {
        catInput.addEventListener('focus', () => showSuggestions('category', catInput.value));
        catInput.addEventListener('input', (e) => showSuggestions('category', e.target.value));
    }
    const assetInput = document.getElementById('taskAssetSearch');
    if (assetInput) {
        assetInput.addEventListener('focus', () => showSuggestions('asset', assetInput.value));
        assetInput.addEventListener('input', (e) => showSuggestions('asset', e.target.value));
    }
    const locInput = document.getElementById('taskLocSearch');
    if (locInput) {
        locInput.addEventListener('focus', () => showSuggestions('location', locInput.value));
        locInput.addEventListener('input', (e) => showSuggestions('location', e.target.value));
    }
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tag-container')) document.querySelectorAll('.suggestion-list').forEach(el => el.classList.remove('show'));
    });
}

function showSuggestions(type, query) {
    let results = [];
    let listEl = document.getElementById(`${type}Suggestions`);
    if (!listEl) return;
    if (type === 'category') results = allCategories.filter(c => c.navn.toLowerCase().includes(query.toLowerCase()));
    else if (type === 'asset') results = allAssets.filter(a => a.navn.toLowerCase().includes(query.toLowerCase()));
    else if (type === 'location') results = allLocations.filter(l => l.navn.toLowerCase().includes(query.toLowerCase()));

    if (results.length === 0) { listEl.classList.remove('show'); return; }
    listEl.innerHTML = '';
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerText = item.navn;
        div.onclick = () => {
            if (type === 'category') addCategoryTag(item.navn);
            else {
                const searchInput = document.getElementById(`task${type.charAt(0).toUpperCase() + type.slice(1)}Search`);
                const idInput = document.getElementById(`task${type.charAt(0).toUpperCase() + type.slice(1)}Id`);
                if (searchInput) searchInput.value = item.navn;
                if (idInput) idInput.value = item.id;
            }
            listEl.classList.remove('show');
        };
        listEl.appendChild(div);
    });
    listEl.classList.add('show');
}

function addCategoryTag(name) {
    if (!selectedTaskTags.includes(name)) { selectedTaskTags.push(name); renderTaskTags(); }
    document.getElementById('categoryTagInput').value = '';
}

function renderTaskTags() {
    const container = document.getElementById('categoryTagContainer');
    if (!container) return;
    container.querySelectorAll('.tag').forEach(t => t.remove());
    selectedTaskTags.forEach(name => {
        const tag = document.createElement('div'); tag.className = 'tag';
        tag.innerHTML = `${name} <span onclick="removeCategoryTag('${name}')">✕</span>`;
        container.insertBefore(tag, document.getElementById('categoryTagInput'));
    });
}

function removeCategoryTag(name) {
    selectedTaskTags = selectedTaskTags.filter(t => t !== name); renderTaskTags();
}

function setTaskPriority(val) {
    document.getElementById('taskPriority').value = val;
    document.querySelectorAll('.prio-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.prio == val));
}

async function fetchProcedures() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('procedurer').select('*').eq('firma_id', currentFirmaId);
    const list = document.getElementById('sopTemplateList'); if (!list) return; list.innerHTML = "";
    data?.forEach(s => {
        const div = document.createElement('div'); div.className = 'list-card-item';
        div.innerHTML = `<strong>${s.titel}</strong><div style="font-size:12px;">${s.trin?.length || 0} trin</div>`;
        list.appendChild(div);
    });
}

async function fetchKpiSettings() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('kpi_konfiguration').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) {
        if (document.getElementById('kpi_svartid')) document.getElementById('kpi_svartid').checked = data.kpi_svartid;
    }
}
