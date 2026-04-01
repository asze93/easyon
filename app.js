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
        
        const { data } = await supabaseClient.from('brugere').select('firma_id').eq('rolle', 'admin').limit(1).maybeSingle();
        if (data && data.firma_id) {
            currentFirmaId = data.firma_id;
            await fetchIndstillinger(); // Hent globale indstillinger tidligt
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
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
}

function toggleAuthMode(forcedMode) {
    if (forcedMode) authMode = forcedMode;
    else authMode = authMode === 'login' ? 'signup' : 'login';
    
    // UI updates for auth card (reusing existing logic)
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('authBtn');
    if (authMode === 'signup') {
        title.innerText = "Opret Admin Konto";
        btn.innerText = "Tilmeld mig";
        document.getElementById('nameGroup').classList.remove('hidden');
        document.getElementById('passConfirmGroup').classList.remove('hidden');
    } else {
        title.innerText = "Log ind på EasyON";
        btn.innerText = "Log ind";
        document.getElementById('nameGroup').classList.add('hidden');
        document.getElementById('passConfirmGroup').classList.add('hidden');
    }
    showView('auth');
}

// ---------------- AUTH LOGIC ----------------
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    const name = document.getElementById('authName').value;

    try {
        if (authMode === 'signup') {
            const passConfirm = document.getElementById('authPassConfirm').value;
            if (pass.length < 6) throw new Error("Adgangskoden skal være mindst 6 tegn lang.");
            if (pass !== passConfirm) throw new Error("Adgangskoderne er ikke ens.");

            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: pass,
                options: { data: { full_name: name } }
            });
            if (error) throw error;
            if (data.session) showView('wizard');
            else showView('verify-email');
        } else {
            if (email.includes('@')) {
                // Admin login (Supabase Auth)
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
                if (error) throw error;
                checkSession(); 
            } else {
                // Technician login (Database check)
                const { data, error } = await supabaseClient.from('brugere').select('*').eq('arbejdsnummer', email).eq('adgangskode', pass).maybeSingle();
                if (error || !data) throw new Error("Ugyldigt login. Tjek nr. og PIN.");
                
                // Allow anyone to enter dashboard for demo
                currentFirmaId = data.firma_id;
                loadDashboard();
                showSnackbar("Velkommen, " + data.navn + "!");
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
    dashTab('overview');
}

function dashTab(tab) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(a => a.classList.remove('active'));
    
    const target = document.getElementById('dash-' + tab);
    if (target) target.classList.add('active');
    
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
                ` : '-'}
            </td>
        </tr>
    `).join('');
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

async function rejectRequest(id) {
    await supabaseClient.from('anmodninger').update({ status: 'Afvist' }).eq('id', id);
    fetchRequests();
    showSnackbar("Anmodning afvist.");
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
            <td><button class="btn-outline btn-xs" onclick="editTask('${t.id}')">Se</button></td>
        </tr>
    `).join('');
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
    body.innerHTML = (data || []).map(a => `
        <div class="asset-card">
            <div class="asset-img" style="background-image: url('${a.billede_path || 'easyon_app_icon.png'}')"></div>
            <div class="asset-info">
                <h3>${a.navn}</h3>
                <p class="text-muted">${a.placering || 'Ingen lokation'}</p>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn-outline btn-xs" onclick="editAsset('${a.id}')">Rediger</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function fetchLocations() {
    const { data } = await supabaseClient.from('lokationer').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('locationsBody');
    body.innerHTML = (data || []).map(l => `
        <tr>
            <td><strong>${l.navn}</strong></td>
            <td>${l.beskrivelse || '-'}</td>
            <td><button class="btn-outline btn-xs" onclick="deleteItem('lokationer', '${l.id}', fetchLocations)">Slet</button></td>
        </tr>
    `).join('');
}

// ---------------- MODAL HELPERS ----------------
async function openModal(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    
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
