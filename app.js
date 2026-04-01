// EASYON SAAS WEB PLATFORM - CORE LOGIC (MaintainX Inspired)
let supabaseClient;
let currentUser = null;
let currentFirmaId = null;
let kraeverAnmodningReview = false; // Global indstilling
let authMode = 'login'; 

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    checkSession();
});

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
}

async function checkSession() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        updateNavUI();
        
        // isolation fix: filter by logged-in user email
        const { data } = await supabaseClient.from('brugere')
            .select('firma_id')
            .filter('rolle', 'in', '("admin", "admin.admin")')
            .eq('email', session.user.email)
            .maybeSingle();

        if (data && data.firma_id) {
            currentFirmaId = data.firma_id;
            await fetchIndstillinger();
            loadDashboard();
        } else {
            showView('wizard');
        }
    } else {
        updateNavUI();
        showView('landing');
    }
}

async function updateNavUI() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const guest = document.getElementById('guestNav');
    const user = document.getElementById('userNav');
    if (session) {
        guest.classList.add('hidden');
        user.classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = "Hej, " + (session.user.user_metadata?.full_name || "Bruger");
    } else {
        guest.classList.remove('hidden');
        user.classList.add('hidden');
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Toggle dashboard-mode for SPA effect
    if (viewId === 'dashboard') document.body.classList.add('dashboard-mode');
    else document.body.classList.remove('dashboard-mode');

    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        if (viewId !== 'dashboard') window.scrollTo(0, 0);
    }
}

function toggleAuthMode(forcedMode) {
    if (forcedMode) authMode = forcedMode;
    else authMode = (authMode === 'login' ? 'signup' : 'login');
    
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('authBtn');
    const authEmailLabel = document.getElementById('authEmailLabel');
    const authEmail = document.getElementById('authEmail');
    const toggleText = document.getElementById('toggleText');
    const toggleLink = document.getElementById('toggleLink');
    const passConfirmGroup = document.getElementById('passConfirmGroup');
    const signupOnlyGroup = document.getElementById('signupOnlyGroup');
    const nameGroup = document.getElementById('nameGroup');
    const firmaGroup = document.getElementById('loginFirmaGroup');

    if (authMode === 'signup') {
        authTitle.innerText = 'Opret din EasyON konto';
        authEmailLabel.innerText = 'E-mail adresse';
        authEmail.placeholder = 'navn@firma.dk';
        authBtn.innerText = 'Næste: Firma info';
        toggleText.innerText = 'Har du allerede en konto?';
        toggleLink.innerText = 'Log ind her';
        if (passConfirmGroup) passConfirmGroup.classList.remove('hidden');
        if (signupOnlyGroup) signupOnlyGroup.classList.remove('hidden');
        if (nameGroup) nameGroup.classList.remove('hidden');
        if (firmaGroup) firmaGroup.classList.add('hidden');
    } else {
        authTitle.innerText = 'Log ind på EasyON';
        authEmailLabel.innerText = 'Login-ID (ID eller E-mail)';
        authEmail.placeholder = 'E-mail eller medarbejder-nr.';
        authBtn.innerText = 'Log ind';
        toggleText.innerText = 'Har du ikke en konto?';
        toggleLink.innerText = 'Opret her';
        if (passConfirmGroup) passConfirmGroup.classList.add('hidden');
        if (signupOnlyGroup) signupOnlyGroup.classList.add('hidden');
        if (nameGroup) nameGroup.classList.add('hidden');
        if (firmaGroup) firmaGroup.classList.remove('hidden');
    }
    showView('auth');
}

// ---------------- AUTH LOGIC ----------------
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;

    try {
        if (authMode === 'signup') {
            const firstName = document.getElementById('authFirstName').value;
            const lastName = document.getElementById('authLastName').value;
            const companyName = document.getElementById('authCompanyName').value;
            const passConfirm = document.getElementById('authPassConfirm').value;

            if (pass.length < 6) throw new Error("Adgangskoden skal være mindst 6 tegn lang.");
            if (pass !== passConfirm) throw new Error("Adgangskoderne er ikke ens.");

            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: pass,
                options: { data: { full_name: `${firstName} ${lastName}`, company: companyName } }
            });
            
            if (error) {
                // Graceful signup: If user exists, just try to sign them in
                if (error.message.includes("already registered") || error.status === 400) {
                    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
                    if (signInError) throw signInError;
                    checkSession(); 
                    return;
                }
                throw error;
            }
            
            if (data.session) {
                currentUser = data.session.user; // Ensure current user is set
                showView('wizard');
            } else {
                showView('verify-email');
            }
        } else {
            const loginFirma = document.getElementById('authLoginFirma')?.value || "";
            
            if (email.includes('@')) {
                // Regular email login (Admin)
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
                if (error) throw error;
                checkSession(); 
            } else {
                // 1. First, find the Firma-ID based on the company name
                const { data: firmaData, error: firmaErr } = await supabaseClient.from('firmaer')
                    .select('id')
                    .ilike('navn', loginFirma)
                    .maybeSingle();
                
                if (firmaErr || !firmaData) {
                    throw new Error("Kunne ikke finde firmaet: " + loginFirma);
                }

                const targetFirmaId = firmaData.id;

                // 2. Try to find if this is a Company Admin
                const { data: adminUser } = await supabaseClient.from('brugere')
                    .select('email, rolle')
                    .eq('firma_id', targetFirmaId)
                    .eq('arbejdsnummer', email) 
                    .eq('rolle', 'admin.admin') // Or 'admin'
                    .maybeSingle();

                if (adminUser) {
                    // It's an admin - use their email to sign in via Supabase
                    const { data, error } = await supabaseClient.auth.signInWithPassword({ 
                        email: adminUser.email, 
                        password: pass 
                    });
                    if (error) throw error;
                    checkSession();
                } else {
                    // 3. Try Technician/Member Login (Database check)
                    const { data, error } = await supabaseClient.from('brugere')
                        .select('*')
                        .eq('firma_id', targetFirmaId)
                        .eq('arbejdsnummer', email)
                        .eq('adgangskode', pass)
                        .maybeSingle();
                    
                    if (error || !data) throw new Error("Ugyldigt login. Tjek Firmanavn, Medarbejder-ID og PIN.");
                    
                    currentFirmaId = data.firma_id;
                    loadDashboard();
                    showSnackbar("Velkommen, " + data.navn + "!");
                }
            }
        }
    } catch (err) {
        alert("Fejl: " + err.message);
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentFirmaId = null;
    location.reload();
}

// ---------------- DASHBOARD & NAVIGATION ----------------
async function loadDashboard() {
    showView('dashboard');
    
    const { data: profile } = await supabaseClient.from('brugere')
        .select('navn, arbejdsnummer, firma_id')
        .eq('email', currentUser.email)
        .filter('rolle', 'in', '("admin", "admin.admin")')
        .maybeSingle();

    if (profile) {
        currentFirmaId = profile.firma_id;
        const userRole = profile.rolle;
        console.log("Dashboard loaded for firma:", currentFirmaId, "Rolle:", userRole);
        
        const displayName = `${profile.arbejdsnummer} | ${profile.navn}`;
        document.querySelectorAll('.adminName').forEach(el => el.innerText = displayName);
        
        // RBAC: Show/Hide based on role 'admin.admin' vs others
        const isAdmin = (userRole === 'admin.admin');
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('hidden', !isAdmin);
        });
    } else {
        console.error("Kunne ikke finde profil for bruger:", currentUser.email);
    }
    
    // Initial data fetch
    fetchStats();
    fetchTasks();
    fetchRequests();
    fetchAssets();
    fetchLocations();
    fetchTeam();
    fetchCategories();
    fetchIndstillinger();
    
    dashTab('overview');
}

function dashTab(tab) {
    // Isolated Tab Switching
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(a => a.classList.remove('active'));
    
    const target = document.getElementById('dash-' + tab);
    if (target) {
        target.classList.add('active');
        // Reset scroll within the isolated container only
        const container = document.getElementById('dashMain');
        if (container) container.scrollTop = 0;
    }
    
    document.querySelectorAll('.dash-nav').forEach(a => {
        if (a.getAttribute('data-tab') === tab) a.classList.add('active');
    });

    // Smart data loading based on tab
    if (tab === 'overview') fetchStats();
    if (tab === 'tasks') fetchTasks();
    if (tab === 'requests') fetchRequests();
    if (tab === 'assets') fetchAssets();
    if (tab === 'locations') fetchLocations();
    if (tab === 'team') fetchTeam();
    if (tab === 'categories') fetchCategories();
    if (tab === 'indstillinger') fetchIndstillinger();
    if (tab === 'statistics') renderStatistics();
}

function dashNavTab(e, tab) {
    if (e) e.preventDefault();
    dashTab(tab);
}

// ---------------- FOUNDATION: CATEGORIES ----------------
async function fetchCategories() {
    const { data } = await supabaseClient.from('kategorier').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('categoriesBody');
    if (data && data.length > 0) {
        body.innerHTML = data.map(c => `
            <tr>
                <td><strong>${c.navn}</strong></td>
                <td><div style="width:20px; height:20px; border-radius:4px; background:${c.farve};"></div></td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td><button class="btn-outline btn-xs" onclick="deleteItem('kategorier', '${c.id}', fetchCategories)">Slet</button></td>
            </tr>
        `).join('');
    } else {
        body.innerHTML = `<tr><td colspan="4" style="text-align:center;">Ingen kategorier. <a href="#" onclick="seedCategories()">Tryk her for at tilføje standard kategorier.</a></td></tr>`;
    }
}

async function seedCategories() {
    const standards = ['Damage', 'Electrical', 'Fleet', 'Mechanical', 'Preventive', 'Safety', 'SOP', 'Inspection', 'Refrigeration'];
    const payload = standards.map(s => ({ navn: s, firma_id: currentFirmaId }));
    await supabaseClient.from('kategorier').insert(payload);
    fetchCategories();
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const navn = document.getElementById('catName').value;
    const farve = document.getElementById('catColor').value;
    const { error } = await supabaseClient.from('kategorier').insert({ navn, farve, firma_id: currentFirmaId });
    if (!error) { closeAllModals(); fetchCategories(); showSnackbar("Kategori oprettet!"); }
}

// ---------------- OPERATIONS: REQUESTS ----------------
async function fetchRequests() {
    const { data } = await supabaseClient.from('anmodninger').select('*').eq('firma_id', currentFirmaId).order('created_at', { ascending: false });
    const body = document.getElementById('requestsBody');
    body.innerHTML = (data || []).map(r => `
        <tr>
            <td><strong>${r.titel}</strong></td>
            <td>${r.opretter_navn || 'Operatør'}</td>
            <td>${new Date(r.created_at).toLocaleDateString()}</td>
            <td><span class="badge status-${r.status.toLowerCase()}">${r.status}</span></td>
            <td>
                ${r.status === 'Afventer' ? `
                    <button class="btn-primary btn-xs" onclick="approveRequest('${r.id}')">Godkend</button>
                    <button class="btn-outline btn-xs" onclick="rejectRequest('${r.id}')">Afvis</button>
                ` : `
                    <button class="btn-outline btn-xs" onclick="deleteItem('anmodninger', '${r.id}', fetchRequests)">Slet</button>
                `}
            </td>
        </tr>
    `).join('');
}

async function rejectRequest(id) {
    if (confirm("Vil du afvise denne anmodning?")) {
        await supabaseClient.from('anmodninger').update({ status: 'Afvist' }).eq('id', id);
        fetchRequests();
        showSnackbar("Anmodning afvist.");
    }
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    const payload = {
        titel: document.getElementById('reqTitle').value,
        asset_navn: document.getElementById('reqAsset').value,
        beskrivelse: document.getElementById('reqDesc').value,
        firma_id: currentFirmaId,
        status: kraeverAnmodningReview ? 'Afventer' : 'Godkendt'
    };
    const { error } = await supabaseClient.from('anmodninger').insert(payload);
    if (!error) {
        closeAllModals();
        fetchRequests();
        showSnackbar("Anmodning indsendt!");
        if (!kraeverAnmodningReview) {
            // Skab automatisk Work Order, hvis review er slået fra? 
            // Eller bare lad admin gøre det. Logikken her følger brugerens ønske om Review Toggle.
        }
    }
}

async function approveRequest(id) {
    await supabaseClient.from('anmodninger').update({ status: 'Godkendt' }).eq('id', id);
    fetchRequests();
    // Her kunne vi åbne Modal-Task for at færdiggøre WO oprettelsen fra anmodningen
    showSnackbar("Anmodning godkendt!");
}

async function fetchTeam() {
    const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('teamBody');
    body.innerHTML = (data || []).map(p => `
        <tr>
            <td><strong>${p.navn}</strong></td>
            <td>${p.arbejdsnummer}</td>
            <td><span class="badge status-godkendt">${p.rolle}</span></td>
            <td>
                <button class="btn-outline btn-xs" onclick="editTeam('${p.id}')">Rediger</button>
                <button class="btn-outline btn-xs" onclick="deleteItem('brugere', '${p.id}', fetchTeam)">Slet</button>
            </td>
        </tr>
    `).join('');
}

async function editTeam(id) {
    const { data } = await supabaseClient.from('brugere').select('*').eq('id', id).maybeSingle();
    if (data) {
        document.getElementById('teamName').value = data.navn;
        document.getElementById('teamNr').value = data.arbejdsnummer;
        document.getElementById('teamRolle').value = data.rolle;
        document.getElementById('teamPin').value = data.adgangskode;
        openModal('modal-team');
    }
}

// ---------------- OPERATIONS: WORK ORDERS ----------------
async function fetchTasks() {
    const { data } = await supabaseClient.from('opgaver').select('*').eq('firma_id', currentFirmaId).order('id', { ascending: false });
    const body = document.getElementById('tasksBody');
    body.innerHTML = (data || []).map(t => `
        <tr>
            <td><strong>${t.titel}</strong></td>
            <td>${t.maskine_navn || '-'}</td>
            <td><span class="badge prio-${t.prioritet}">${t.prioritet == 3 ? 'Kritisk' : t.prioritet == 2 ? 'Høj' : 'Normal'}</span></td>
            <td>${t.kategori_navn || '-'}</td>
            <td>
                <button class="btn-outline btn-xs" onclick="editTask('${t.id}')">Se</button>
                <button class="btn-outline btn-xs" onclick="deleteItem('opgaver', '${t.id}', fetchTasks)" title="Slet">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function editTask(id) {
    const { data } = await supabaseClient.from('opgaver').select('*').eq('id', id).maybeSingle();
    if (data) {
        document.getElementById('taskId').value = data.id;
        document.getElementById('taskTitle').value = data.titel;
        document.getElementById('taskCategory').value = data.kategori_navn || '';
        document.getElementById('taskAsset').value = data.maskine_navn || '';
        document.getElementById('taskAssignee').value = data.tildelt_titel || '';
        document.getElementById('taskDesc').value = data.beskrivelse || '';
        openModal('modal-task');
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const payload = {
        titel: document.getElementById('taskTitle').value,
        kategori_navn: document.getElementById('taskCategory').value,
        maskine_navn: document.getElementById('taskAsset').value,
        placering: document.getElementById('taskLoc').value,
        tildelt_titel: document.getElementById('taskAssignee').value,
        beskrivelse: document.getElementById('taskDesc').value,
        firma_id: currentFirmaId,
        status: 'Afventer'
    };
    
    let res;
    if (id) res = await supabaseClient.from('opgaver').update(payload).eq('id', id);
    else res = await supabaseClient.from('opgaver').insert(payload);
    
    if (!res.error) { closeAllModals(); fetchTasks(); showSnackbar("Arbejdsordre gemt!"); }
}

// ---------------- FOUNDATION: ASSETS & LOCATIONS ----------------
async function fetchAssets() {
    const { data } = await supabaseClient.from('maskiner').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('assetsBody');
    if (!body) return;
    body.innerHTML = (data || []).map(a => `
        <div class="asset-card">
            <div class="asset-img" style="background-image: url('${a.billede_path || 'easyon_app_icon.png'}')"></div>
            <div class="asset-info">
                <h3>${a.navn}</h3>
                <p class="text-muted">${a.placering || 'Ingen lokation'}</p>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn-outline btn-xs" onclick="editAsset('${a.id}')">Rediger</button>
                    <button class="btn-outline btn-xs" onclick="deleteItem('maskiner', '${a.id}', fetchAssets)" title="Slet">🗑️ Slet</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function editAsset(id) {
    const { data } = await supabaseClient.from('maskiner').select('*').eq('id', id).maybeSingle();
    if (data) {
        document.getElementById('assetId').value = data.id;
        document.getElementById('assetName').value = data.navn;
        document.getElementById('assetLoc').value = data.placering || '';
        openModal('modal-asset');
    }
}

async function handleAssetSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('assetId').value;
    const payload = {
        navn: document.getElementById('assetName').value,
        placering: document.getElementById('assetLoc').value,
        firma_id: currentFirmaId
    };
    let res;
    if (id) res = await supabaseClient.from('maskiner').update(payload).eq('id', id);
    else res = await supabaseClient.from('maskiner').insert(payload);
    
    if (!res.error) { closeAllModals(); fetchAssets(); showSnackbar("Asset gemt!"); }
}

async function handleLocationSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('locId').value;
    const payload = {
        navn: document.getElementById('locName').value,
        beskrivelse: document.getElementById('locDesc').value,
        firma_id: currentFirmaId
    };
    let res;
    if (id) res = await supabaseClient.from('lokationer').update(payload).eq('id', id);
    else res = await supabaseClient.from('lokationer').insert(payload);
    
    if (!res.error) { closeAllModals(); fetchLocations(); showSnackbar("Lokation gemt!"); }
}
async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const teamIdEl = document.getElementById('teamId');
    const id = teamIdEl ? teamIdEl.value : "";

    if (!currentFirmaId) {
        alert("Fejl: Dit Firma-ID er ikke indlæst korrekt. Prøv at genindlæse siden (F5).");
        return;
    }

    const payload = {
        navn: document.getElementById('teamName').value,
        arbejdsnummer: document.getElementById('teamNr').value,
        rolle: document.getElementById('teamRolle').value,
        adgangskode: document.getElementById('teamPin').value,
        firma_id: currentFirmaId
    };
    
    console.log("Forsøger at gemme:", payload);
    
    try {
        let res;
        if (id) {
            res = await supabaseClient.from('brugere').update(payload).eq('id', id);
        } else {
            res = await supabaseClient.from('brugere').insert(payload);
        }
        
        if (res.error) {
            throw res.error;
        } else {
            closeAllModals(); 
            fetchTeam(); 
            showSnackbar("Medarbejder gemt!");
        }
    } catch (err) {
        console.error("Fejl i handleTeamSubmit:", err);
        alert("Kunne ikke gemme: " + err.message);
    }
}

async function fetchLocations() {
    const { data } = await supabaseClient.from('lokationer').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('locationsBody');
    body.innerHTML = (data || []).map(l => `
        <tr>
            <td><strong>${l.navn}</strong></td>
            <td>${l.beskrivelse || '-'}</td>
            <td>
                <button class="btn-outline btn-xs" onclick="editLocation('${l.id}')">Rediger</button>
                <button class="btn-outline btn-xs" onclick="deleteItem('lokationer', '${l.id}', fetchLocations)">Slet</button>
            </td>
        </tr>
    `).join('');
}

async function editLocation(id) {
    const { data } = await supabaseClient.from('lokationer').select('*').eq('id', id).maybeSingle();
    if (data) {
        document.getElementById('locName').value = data.navn;
        document.getElementById('locDesc').value = data.beskrivelse || '';
        openModal('modal-location');
    }
}

// ---------------- MODAL HELPERS ----------------
async function openModal(id, isNew = false) {
    const modal = document.getElementById(id);
    document.getElementById('modal-overlay').classList.remove('hidden');
    modal.classList.remove('hidden');
    
    if (isNew) {
        // Reset form if it exists
        const form = modal.querySelector('form');
        if (form) form.reset();
        // Manually clear hidden IDs
        const hiddenIds = ['taskId', 'assetId', 'locId', 'teamId'];
        hiddenIds.forEach(hid => {
            const el = document.getElementById(hid);
            if (el) el.value = '';
        });
    }

    // Prep dropdowns for specific modals
    if (id === 'modal-task' || id === 'modal-request' || id === 'modal-asset') {
        populateDropdowns();
    }
}

function closeAllModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
}

async function populateDropdowns() {
    // Assets
    const { data: assets } = await supabaseClient.from('maskiner').select('navn').eq('firma_id', currentFirmaId);
    const assetSelects = [document.getElementById('taskAsset'), document.getElementById('reqAsset')];
    assetSelects.forEach(s => {
        if (s) s.innerHTML = '<option value="">Vælg maskine...</option>' + (assets || []).map(a => `<option value="${a.navn}">${a.navn}</option>`).join('');
    });

    // Categories
    const { data: cats } = await supabaseClient.from('kategorier').select('navn').eq('firma_id', currentFirmaId);
    const catSelect = document.getElementById('taskCategory');
    if (catSelect) catSelect.innerHTML = '<option value="">Vælg kategori...</option>' + (cats || []).map(c => `<option value="${c.navn}">${c.navn}</option>`).join('');

    // Teams/People
    const { data: people } = await supabaseClient.from('brugere').select('navn, arbejdsnummer').eq('firma_id', currentFirmaId);
    const teamSelect = document.getElementById('taskAssignee');
    if (teamSelect) teamSelect.innerHTML = '<option value="">Tildel til...</option>' + (people || []).map(p => `<option value="${p.navn}">${p.navn} (${p.arbejdsnummer})</option>`).join('');

    // Locations (for Asset modal)
    const { data: locs } = await supabaseClient.from('lokationer').select('navn').eq('firma_id', currentFirmaId);
    const locSelect = document.getElementById('assetLoc');
    if (locSelect) locSelect.innerHTML = '<option value="">Vælg lokation...</option>' + (locs || []).map(l => `<option value="${l.navn}">${l.navn}</option>`).join('');
}

async function autoFillLocation() {
    const assetName = document.getElementById('taskAsset').value;
    if (!assetName) return;
    const { data } = await supabaseClient.from('maskiner').select('placering').eq('navn', assetName).eq('firma_id', currentFirmaId).maybeSingle();
    if (data) document.getElementById('taskLoc').value = data.placering || 'Ukendt';
}

// ---------------- SYSTEM SETTINGS ----------------
async function fetchIndstillinger() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('firma_indstillinger').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) {
        kraeverAnmodningReview = data.kraever_anmodning_review;
        const toggle = document.getElementById('kraever_review');
        if (toggle) toggle.checked = kraeverAnmodningReview;
        
        const setLoc = document.getElementById('set_lokationer');
        if (setLoc) setLoc.checked = data.aktiver_lokationer;
        
        const setSop = document.getElementById('set_sop');
        if (setSop) setSop.checked = data.aktiver_sop;
    }
}

async function saveIndstillinger() {
    const payload = {
        firma_id: currentFirmaId,
        kraever_anmodning_review: document.getElementById('kraever_review').checked,
        aktiver_lokationer: document.getElementById('set_lokationer').checked,
        aktiver_sop: document.getElementById('set_sop').checked
    };
    await supabaseClient.from('firma_indstillinger').upsert(payload);
    kraeverAnmodningReview = payload.kraever_anmodning_review;
    showSnackbar("Indstillinger gemt!");
}

// ---------------- UTILS ----------------
function showSnackbar(msg) {
    const sb = document.getElementById('snackbar');
    sb.innerText = msg;
    sb.classList.add('show');
    setTimeout(() => sb.classList.remove('show'), 3000);
}

async function deleteItem(table, id, callback) {
    if (confirm("Er du sikker?")) {
        await supabaseClient.from(table).delete().eq('id', id);
        callback();
        showSnackbar("Slettet!");
    }
}

// ---------------- STATS & CHARTS ----------------
async function fetchStats() {
    if (!currentFirmaId) return;
    
    // Quick counts for the Overview cards
    const { count: taskCount } = await supabaseClient.from('opgaver').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId).eq('status', 'Afventer');
    const { count: reqCount } = await supabaseClient.from('anmodninger').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId).eq('status', 'Afventer');
    const { count: assetCount } = await supabaseClient.from('maskiner').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);

    document.getElementById('stat-tasks').innerText = taskCount || 0;
    document.getElementById('stat-requests').innerText = reqCount || 0;
    document.getElementById('stat-assets').innerText = assetCount || 0;
}

async function renderStatistics() {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;

    // Fetch categorical data for the chart
    const { data: cats } = await supabaseClient.from('kategorier').select('navn, farve');
    const { data: tasks } = await supabaseClient.from('opgaver').select('kategori_navn').eq('firma_id', currentFirmaId);

    const labels = (cats || []).map(c => c.navn);
    const colors = (cats || []).map(c => c.farve || '#3b82f6');
    const counts = labels.map(l => (tasks || []).filter(t => t.kategori_navn === l).length);

    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Ingen data'],
            datasets: [{
                label: 'Arbejdsordrer pr. kategori',
                data: counts.length ? counts : [0],
                backgroundColor: colors.length ? colors : ['#3b82f6'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#334155' } }, x: { grid: { display: false } } }
        }
    });
}
// ---------------- WIZARD / ONBOARDING ----------------
async function nextWizard(step) {
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
    finishSetup();
}

async function finishSetup() {
    const status = document.getElementById('wizardStatus');
    try {
        status.innerText = "Behandler firmaoplysninger...";
        
        // 1. Create Company
        const bizName = document.getElementById('bizName').value || "Mit Firma";
        const bizInd = document.getElementById('bizIndustry').value;
        const bizAddr = document.getElementById('bizAddress').value;
        const bizCVR = document.getElementById('bizCVR').value;
        
        const { data: newFirma, error: firmaErr } = await supabaseClient.from('firmaer').insert({
            navn: bizName,
            branche: bizInd,
            adresse: bizAddr,
            cvr_nummer: bizCVR
        }).select().single();
        
        if (firmaErr) throw firmaErr;
        currentFirmaId = newFirma.id;

        // 2. Create Admin User Link
        status.innerText = "Kobler din profil til firmaet...";
        const loginId = currentUser.user_metadata?.company || bizName;
        
        // isolation fix: ensure loginId is unique
        const { data: existing } = await supabaseClient.from('brugere').select('id').eq('arbejdsnummer', loginId).maybeSingle();
        if (existing) throw new Error("Dette firmanavn/login-id er allerede optaget. Vælg venligst et andet.");

        const { error: userErr } = await supabaseClient.from('brugere').insert({
            firma_id: currentFirmaId,
            navn: currentUser.user_metadata?.full_name || "Admin",
            email: currentUser.email,
            rolle: 'admin.admin',
            arbejdsnummer: loginId,
            adgangskode: 'AUTH' 
        });
        if (userErr) throw userErr;

        // 3. Create Default Settings
        await supabaseClient.from('firma_indstillinger').insert({ firma_id: currentFirmaId });

        // 5. Done!
        status.innerText = "Alt er klar! Åbner dashboard...";
        setTimeout(() => loadDashboard(), 1500);

    } catch (err) {
        alert("Fejl under opsætning: " + err.message);
        document.getElementById('step3').classList.add('hidden');
        document.getElementById('step1').classList.remove('hidden');
    }
}
