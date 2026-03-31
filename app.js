// EASYON SAAS WEB PLATFORM - CORE LOGIC
let supabaseClient;
let currentUser = null;
let currentFirmaId = null;
let authMode = 'login'; // 'login' or 'signup'

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    checkSession();
});

function initSupabase() {
    // CDN exposes 'supabase' as a global
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase SDK ikke fundet!");
    }
}

async function checkSession() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        
        // We need to check if this Admin has already set up a firma
        const { data } = await supabaseClient
            .from('brugere')
            .select('firma_id')
            .eq('rolle', 'admin')
            .limit(1)
            .maybeSingle();

        if (data && data.firma_id) {
            currentFirmaId = data.firma_id;
            await loadDashboard();
        } else {
            // New admin, needs to complete wizard
            showView('wizard');
        }
    } else {
        showView('landing');
    }
}

// ---------------- NAVIGATION ----------------
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
    
    // Header UI updates
    if (viewId === 'landing') {
        document.getElementById('guestNav').classList.remove('hidden');
        document.getElementById('userNav').classList.add('hidden');
    }
}

function toggleAuthMode(forcedMode) {
    if (forcedMode) authMode = forcedMode;
    else authMode = authMode === 'login' ? 'signup' : 'login';

    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSub');
    const btn = document.getElementById('authBtn');
    const toggle = document.getElementById('toggleText');
    const nameGroup = document.getElementById('nameGroup');
    const passConfirmGroup = document.getElementById('passConfirmGroup');

    if (authMode === 'signup') {
        title.innerText = "Opret Admin Konto";
        sub.innerText = "Start dit firmas transformation i dag";
        btn.innerText = "Tilmeld mig";
        toggle.innerText = "Har du allerede en konto?";
        document.getElementById('toggleLink').innerText = "Log ind her";
        nameGroup.classList.remove('hidden');
        passConfirmGroup.classList.remove('hidden');
        document.getElementById('authPassConfirm').setAttribute('required', 'true');
    } else {
        title.innerText = "Log ind på EasyON";
        sub.innerText = "Indtast dine oplysninger nedenfor";
        btn.innerText = "Log ind";
        toggle.innerText = "Har du ikke en konto?";
        document.getElementById('toggleLink').innerText = "Opret her";
        nameGroup.classList.add('hidden');
        passConfirmGroup.classList.add('hidden');
        document.getElementById('authPassConfirm').removeAttribute('required');
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
            
            // Validation
            if (pass.length < 6) throw new Error("Adgangskoden skal være mindst 6 tegn lang.");
            if (pass !== passConfirm) throw new Error("Adgangskoderne er ikke ens. Tjek venligst din indtastning.");

            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: pass,
                options: { data: { full_name: name } }
            });
            if (error) throw error;
            
            currentUser = data.user;
            // Hvis session er returneret, er e-mail bekræftelse slået fra. Bypass Verify!
            if (data.session) {
                showView('wizard');
            } else {
                showView('verify-email');
            }
        } else {
            if (email.includes('@')) {
                // Admin Login
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: pass
                });
                if (error) throw error;
                currentUser = data.user;
                loadDashboard();
            } else {
                // Technician Login (Work ID + PIN)
                const { data, error } = await supabaseClient
                    .from('brugere')
                    .select()
                    .eq('arbejdsnummer', email)
                    .eq('adgangskode', pass)
                    .maybeSingle();

                if (error || !data) throw new Error("Ugyldigt medarbejder nr. eller PIN");
                showTechnicianWelcome(data);
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

// ---------------- WIZARD LOGIC ----------------
function nextWizard(step) {
    document.querySelectorAll('.wizard-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('step' + step).classList.remove('hidden');
    
    document.querySelectorAll('.wizard-steps .step').forEach(s => {
        if (parseInt(s.dataset.step) <= step) s.classList.add('active');
        else s.classList.remove('active');
    });

    if (step === 3) startCloudProvisioning();
}

async function startCloudProvisioning() {
    const bizName = document.getElementById('bizName').value;
    const asset = document.getElementById('firstAsset').value;
    const loc = document.getElementById('firstLoc').value;
    const status = document.getElementById('wizardStatus');
    
    currentFirmaId = "FID_" + Math.random().toString(36).substr(2, 6).toUpperCase();

    const tasks = [
        "Opretter firma-id: " + currentFirmaId,
        "Opsætter databasetabeller...",
        "Konfigurerer " + asset + "...",
        "Færdiggør Admin rettigheder...",
        "Klar!"
    ];

    for (let t of tasks) {
        status.innerText = t;
        await new Promise(r => setTimeout(r, 600));
    }

    try {
        // Create Admin Profile
        await supabaseClient.from('brugere').insert({
            navn: currentUser.user_metadata.full_name || "Admin",
            arbejdsnummer: "100",
            adgangskode: "1234",
            rolle: 'admin',
            firma_id: currentFirmaId,
            afdeling: 'Ledelse'
        });

        // Create First Asset
        await supabaseClient.from('maskiner').insert({
            navn: asset,
            placering: loc || "Produktion",
            firma_id: currentFirmaId,
            qr_kode_id: "QR_" + Date.now()
        });

        loadDashboard();
    } catch (err) {
        alert("Opsætning fejlede: " + err.message);
    }
}

// ---------------- DASHBOARD LOGIC ----------------
async function loadDashboard() {
    showView('dashboard');
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('userNav').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = currentUser.email || "Admin";

    // Fetch firmaId if not set
    if (!currentFirmaId) {
        const { data } = await supabaseClient
            .from('brugere')
            .select('firma_id')
            .eq('rolle', 'admin')
            .limit(1)
            .maybeSingle();
        if (data) currentFirmaId = data.firma_id;
    }

    await fetchStats();
    dashTab('overview');
}

async function fetchStats() {
    if (!currentFirmaId) return;

    const { count: tasksCount } = await supabaseClient.from('opgaver').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
    const { count: assetsCount } = await supabaseClient.from('maskiner').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
    const { count: usersCount } = await supabaseClient.from('brugere').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);

    const cards = document.querySelectorAll('.stat-card h3');
    if (cards.length >= 3) {
        cards[0].innerText = tasksCount || 0;
        cards[1].innerText = assetsCount || 0;
        cards[2].innerText = usersCount || 0;
    }
}

function dashTab(tab) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-links a').forEach(a => a.classList.remove('active'));
    
    const targetTab = document.getElementById('dash-' + tab);
    if (targetTab) targetTab.classList.add('active');

    // Update sidebar active state
    document.querySelectorAll('.sidebar-links a').forEach(a => {
        if (a.getAttribute('data-tab') === tab) a.classList.add('active');
    });

    if (tab === 'locations') fetchLocations();
    if (tab === 'team') fetchTeam();
    if (tab === 'assets') {
        fetchAssets();
        fetchLocations(); // For dropdowns later
    }
    if (tab === 'tasks') {
        fetchTasks();
        fetchAssets(); // For dropdowns
    }
}

async function fetchTeam() {
    const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('teamBody');
    body.innerHTML = (data || []).map(u => `
        <tr>
            <td>${u.navn}</td>
            <td>${u.arbejdsnummer}</td>
            <td><span class="badge ${u.rolle}">${u.rolle}</span></td>
            <td><button class="btn-xs" onclick="deleteUser('${u.id}')">Slet</button></td>
        </tr>
    `).join('');
}

async function fetchAssets() {
    const { data } = await supabaseClient.from('maskiner').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('assetsBody');
    body.innerHTML = (data || []).map(a => `
        <div class="asset-card">
            <div class="asset-img" style="background-image: url('${a.billede_path || 'placeholder.jpg'}')"></div>
            <div class="asset-info">
                <h3>${a.navn}</h3>
                <p>${a.placering}</p>
                <button class="btn-outline btn-sm" onclick="showQR('${a.navn}', '${a.qr_kode_id}')">QR Kode</button>
            </div>
        </div>
    `).join('');
}

async function fetchTasks() {
    const { data } = await supabaseClient.from('opgaver').select('*').eq('firma_id', currentFirmaId).order('id', { ascending: false });
    const body = document.getElementById('tasksBody');
    body.innerHTML = (data || []).map(t => `
        <div class="task-row">
            <div><strong>${t.titel}</strong><br><small>${t.status}</small></div>
            <div class="prio-${t.prioritet}">${t.prioritet == 3 ? 'Høj' : 'Normal'}</div>
        </div>
    `).join('');
}

function showQR(name, id) {
    document.getElementById('qrTitle').innerText = name;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${id}`;
    document.getElementById('qrImage').innerHTML = `<img src="${qrUrl}" alt="QR">`;
    document.getElementById('qr-modal').classList.remove('hidden');
}

// ---------------- MANAGEMENT LOGIC ----------------
function openModal(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    
    if (id === 'modal-asset') populateLocationsDropdown();
    if (id === 'modal-task') populateAssetsDropdown();
}

function closeAllModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
}

async function fetchLocations() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('lokationer').select('*').eq('firma_id', currentFirmaId);
    const body = document.getElementById('locationsBody');
    if (body) {
        body.innerHTML = (data || []).map(l => `
            <tr>
                <td><strong>${l.navn}</strong></td>
                <td>${l.beskrivelse || '-'}</td>
                <td><button class="btn-xs" onclick="deleteItem('lokationer', '${l.id}', fetchLocations)">Slet</button></td>
            </tr>
        `).join('');
    }
}

async function handleLocationSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('locName').value;
    const desc = document.getElementById('locDesc').value;

    const { error } = await supabaseClient.from('lokationer').insert({
        navn: name,
        beskrivelse: desc,
        firma_id: currentFirmaId
    });

    if (!error) {
        closeAllModals();
        fetchLocations();
        e.target.reset();
        showSnackbar("Lokation gemt succesfuldt");
    } else {
        showSnackbar("Fejl ved gemning af lokation");
    }
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const num = document.getElementById('userNum').value;
    const role = document.getElementById('userRole').value;
    const pin = document.getElementById('userPin').value;

    const { error } = await supabaseClient.from('brugere').insert({
        navn: name,
        arbejdsnummer: num,
        adgangskode: pin,
        rolle: role,
        firma_id: currentFirmaId,
        afdeling: 'Produktion'
    });

    if (!error) {
        closeAllModals();
        fetchTeam();
        e.target.reset();
        showSnackbar("Medarbejder oprettet succesfuldt");
    } else {
        showSnackbar("Fejl ved oprettelse af medarbejder");
    }
}

async function handleAssetSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('assetName').value;
    const loc = document.getElementById('assetLoc').value;

    const { error } = await supabaseClient.from('maskiner').insert({
        navn: name,
        placering: loc,
        firma_id: currentFirmaId,
        qr_kode_id: "QR_" + Date.now()
    });

    if (!error) {
        closeAllModals();
        fetchAssets();
        e.target.reset();
        showSnackbar("Asset oprettet succesfuldt");
    } else {
        showSnackbar("Fejl ved oprettelse af asset");
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('taskTitle').value;
    const asset = document.getElementById('taskAsset').value;
    const prio = document.getElementById('taskPrio').value;
    const desc = document.getElementById('taskDesc').value;

    const { error } = await supabaseClient.from('opgaver').insert({
        titel: title,
        maskine_navn: asset,
        prioritet: parseInt(prio),
        beskrivelse: desc,
        firma_id: currentFirmaId,
        status: 'Afventer',
        dato: new Date().toISOString()
    });

    if (!error) {
        closeAllModals();
        fetchTasks();
        e.target.reset();
        showSnackbar("Opgave oprettet succesfuldt");
    } else {
        showSnackbar("Fejl ved oprettelse af opgave");
    }
}

async function populateLocationsDropdown() {
    const { data } = await supabaseClient.from('lokationer').select('navn').eq('firma_id', currentFirmaId);
    const select = document.getElementById('assetLoc');
    select.innerHTML = '<option value="">Vælg lokation...</option>' + 
        (data || []).map(l => `<option value="${l.navn}">${l.navn}</option>`).join('');
}

async function populateAssetsDropdown() {
    const { data } = await supabaseClient.from('maskiner').select('navn').eq('firma_id', currentFirmaId);
    const select = document.getElementById('taskAsset');
    select.innerHTML = '<option value="">Vælg maskine...</option>' + 
        (data || []).map(a => `<option value="${a.navn}">${a.navn}</option>`).join('');
}

async function deleteItem(table, id, callback) {
    if (!confirm("Er du sikker?")) return;
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (!error) {
        callback();
        showSnackbar("Element slettet");
    } else {
        showSnackbar("Kunne ikke slette elementet");
    }
}

function showSnackbar(message) {
    const sb = document.getElementById("snackbar");
    if (!sb) return;
    sb.innerText = message;
    sb.className = "snackbar show";
    setTimeout(() => {
        sb.className = sb.className.replace("show", "");
    }, 3000);
}
