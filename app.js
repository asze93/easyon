// EASYON SAAS WEB PLATFORM - CORE LOGIC
let supabaseClient;
let currentUser = null;
let currentFirmaId = null;
let authMode = 'login'; // 'login' or 'signup'
let chartAssigneeInst = null;
let chartStatusInst = null;
let chartTimelineInst = null;

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
        
        // Vis bruger-navigation og skjul gæste-navigation
        document.getElementById('guestNav').classList.add('hidden');
        document.getElementById('userNav').classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = "Hej, " + (currentUser.user_metadata?.full_name || "Bruger");

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
        updateNavUI();
        showView('landing');
    }
}

// Opdater kun header UI uden at omdirigere
async function updateNavUI() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        document.getElementById('guestNav').classList.add('hidden');
        document.getElementById('userNav').classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = "Hej, " + (session.user.user_metadata?.full_name || "Bruger");
    } else {
        document.getElementById('guestNav').classList.remove('hidden');
        document.getElementById('userNav').classList.add('hidden');
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
    
    // Sørg for at den øverste menu er opdateret livedynamisk
    if (viewId === 'landing') {
        updateNavUI();
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
    if (tab === 'statistics') {
        renderStatistics();
    }
}

async function fetchTeam() {
    const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
    window.teamUsers = data;
    const body = document.getElementById('teamBody');
    body.innerHTML = (data || []).map(u => `
        <tr>
            <td>${u.navn}</td>
            <td>${u.arbejdsnummer}</td>
            <td><span class="badge ${u.rolle}">${u.rolle}</span></td>
            <td>
                <button class="btn-xs" onclick="editUser('${u.id}')">Rediger</button>
                <button class="btn-xs" onclick="deleteItem('brugere', '${u.id}', fetchTeam)">Slet</button>
            </td>
        </tr>
    `).join('');
}

function editUser(id) {
    const user = window.teamUsers.find(u => u.id === id);
    if (!user) return;
    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.navn;
    document.getElementById('userNum').value = user.arbejdsnummer;
    document.getElementById('userPin').value = user.adgangskode;
    document.getElementById('userRole').value = user.rolle.toLowerCase();
    document.getElementById('userTitle').value = user.titel || '';

    // Genopbyg dynamiske telefonnumre
    document.getElementById('dynamicPhoneContainer').innerHTML = '';
    if (user.ekstra_info && Array.isArray(user.ekstra_info)) {
        user.ekstra_info.forEach(info => addPhoneField(info.navn, info.nummer));
    }
    
    const titleEl = document.querySelector('#modal-team h3');
    if(titleEl) titleEl.innerText = "Rediger Medarbejder";
    
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-team').classList.remove('hidden');
}

async function fetchAssets() {
    const { data } = await supabaseClient.from('maskiner').select('*').eq('firma_id', currentFirmaId);
    window.currentAssets = data || [];
    const body = document.getElementById('assetsBody');
    body.innerHTML = window.currentAssets.map(a => `
        <div class="asset-card">
            <div class="asset-img" style="background-image: url('${a.billede_path || 'placeholder.jpg'}')"></div>
            <div class="asset-info">
                <h3>${a.navn}</h3>
                <p>${a.placering || ''}</p>
                ${a.sop_link ? `<a href="${a.sop_link}" target="_blank" style="text-decoration:none;font-size:12px;color:var(--primary);display:block;margin-bottom:5px;">SOP / Manual Link 🔗</a>` : ''}
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;">
                    <button class="btn-outline btn-sm" onclick="showQR('${a.navn}', '${a.qr_kode_id}')">QR</button>
                    <button class="btn-outline btn-sm" onclick="editAsset('${a.id}')">Rediger</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function fetchTasks() {
    const { data } = await supabaseClient.from('opgaver').select('*').eq('firma_id', currentFirmaId).order('id', { ascending: false });
    window.currentTasks = data || [];
    const body = document.getElementById('tasksBody');
    body.innerHTML = window.currentTasks.map(t => `
        <div class="task-row" style="display:flex;align-items:center;">
            <div style="flex:1;"><strong>${t.titel}</strong><br><small>${t.status} | Maskine: ${t.maskine_navn || '-'}</small></div>
            <div class="prio-${t.prioritet}" style="margin-right: 15px;">${t.prioritet == 3 ? 'Høj' : 'Normal'}</div>
            <button class="btn-outline btn-sm" onclick="editTask('${t.id}')">Rediger</button>
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
    if (id === 'modal-team') {
        document.getElementById('userId').value = '';
        const form = document.querySelector('#modal-team form');
        if (form) form.reset();
        document.getElementById('dynamicPhoneContainer').innerHTML = ''; // Nulstil dynamiske telefoner
        const titleEl = document.querySelector('#modal-team h3');
        if(titleEl) titleEl.innerText = "Tilføj Medarbejder";
    }

    if (id === 'modal-location') {
        document.getElementById('locId').value = '';
        const form = document.querySelector('#modal-location form');
        if(form) form.reset();
        document.querySelector('#modal-location h3').innerText = "Tilføj Lokation";
    }

    if (id === 'modal-asset') {
        document.getElementById('assetId').value = '';
        const form = document.querySelector('#modal-asset form');
        if(form) form.reset();
        document.querySelector('#modal-asset h3').innerText = "Opret Asset (Maskine)";
        populateLocationsDropdown();
    }

    if (id === 'modal-task') {
        document.getElementById('taskId').value = '';
        const formT = document.querySelector('#modal-task form');
        if (formT) formT.reset();
        document.getElementById('dynamicAssigneeContainer').innerHTML = '';
        addAssigneeField(); // Tilføj den første tomme person
        document.querySelector('#modal-task h3').innerText = "Ny Arbejdsordre";
        populateAssetsDropdown();
        populateTaskDropdowns();
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
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
    window.currentLocations = data || [];
    const body = document.getElementById('locationsBody');
    if (body) {
        body.innerHTML = window.currentLocations.map(l => `
            <tr>
                <td><strong>${l.navn}</strong></td>
                <td>${l.beskrivelse || '-'}</td>
                <td>
                    <button class="btn-xs" onclick="editLocation('${l.id}')">Rediger</button>
                    <button class="btn-xs" style="background:var(--danger);color:white;" onclick="deleteItem('lokationer', '${l.id}', fetchLocations)">Slet</button>
                </td>
            </tr>
        `).join('');
    }
}

async function handleLocationSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('locId').value;
    const name = document.getElementById('locName').value;
    const desc = document.getElementById('locDesc').value;

    const payload = {
        navn: name,
        beskrivelse: desc,
        firma_id: currentFirmaId
    };

    let error;
    if (id) {
        const res = await supabaseClient.from('lokationer').update(payload).eq('id', id);
        error = res.error;
    } else {
        const res = await supabaseClient.from('lokationer').insert(payload);
        error = res.error;
    }

    if (!error) {
        closeAllModals();
        fetchLocations();
        e.target.reset();
        showSnackbar(id ? "Lokation opdateret succesfuldt" : "Lokation gemt succesfuldt");
    } else {
        console.error("DB Error:", error);
        showSnackbar("Fejl: " + (error.message || "Kunne ikke gemme lokation"));
    }
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const name = document.getElementById('userName').value;
    const num = document.getElementById('userNum').value;
    const role = document.getElementById('userRole').value;
    const pin = document.getElementById('userPin').value;
    const title = document.getElementById('userTitle').value;

    const phoneItems = document.querySelectorAll('.dynamic-phone');
    const ekstraInfo = [];
    phoneItems.forEach(item => {
        const pName = item.querySelector('.phone-name').value;
        const pNum = item.querySelector('.phone-num').value;
        if(pName || pNum) ekstraInfo.push({ navn: pName, nummer: pNum });
    });

    const payload = {
        navn: name,
        arbejdsnummer: num,
        adgangskode: pin,
        rolle: role,
        firma_id: currentFirmaId,
        titel: title,
        ekstra_info: ekstraInfo
    };

    let error;
    if (id) {
        const res = await supabaseClient.from('brugere').update(payload).eq('id', id);
        error = res.error;
    } else {
        const res = await supabaseClient.from('brugere').insert(payload);
        error = res.error;
    }

    if (!error) {
        closeAllModals();
        fetchTeam();
        e.target.reset();
        showSnackbar(id ? "Medarbejder opdateret succesfuldt" : "Medarbejder oprettet succesfuldt");
    } else {
        console.error("DB Error:", error);
        showSnackbar("Fejl: " + (error.message || "Kunne ikke gemme"));
    }
}

async function handleAssetSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('assetId').value;
    const name = document.getElementById('assetName').value;
    const loc = document.getElementById('assetLoc').value;
    const sop = document.getElementById('assetSop').value;

    // Auto-opret lokation, hvis den gæstes/skrives manuelt og ikke findes
    if (loc) {
        const { data: locData } = await supabaseClient.from('lokationer').select('id').eq('navn', loc).eq('firma_id', currentFirmaId).maybeSingle();
        if (!locData) {
            await supabaseClient.from('lokationer').insert({ navn: loc, beskrivelse: 'Automatisk oprettet', firma_id: currentFirmaId });
        }
    }

    const payload = {
        navn: name,
        placering: loc,
        firma_id: currentFirmaId,
        sop_link: sop || null
    };

    let error;
    if (id) {
        const res = await supabaseClient.from('maskiner').update(payload).eq('id', id);
        error = res.error;
    } else {
        payload.qr_kode_id = "QR_" + Date.now();
        const res = await supabaseClient.from('maskiner').insert(payload);
        error = res.error;
    }

    if (!error) {
        closeAllModals();
        fetchAssets();
        e.target.reset();
        showSnackbar(id ? "Asset opdateret succesfuldt" : "Asset oprettet succesfuldt");
    } else {
        showSnackbar("Fejl ved gemning af asset");
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const desc = document.getElementById('taskDesc').value;
    const reqName = document.getElementById('taskRequester').value;
    const prioNode = document.querySelector('input[name="taskPrio"]:checked');
    const prio = prioNode ? prioNode.value : "1";
    const loc = document.getElementById('taskLoc').value;
    const asset = document.getElementById('taskAsset').value;
    
    // Tildelinger opsamling
    let signees = [];
    
    // 1. Afdeling
    const dept = document.getElementById('taskDept').value;
    if(dept.trim()) signees.push(dept.trim());
    
    // 2. Titel
    const titleAssign = document.getElementById('taskTitleAssign').value;
    if(titleAssign.trim()) signees.push(titleAssign.trim());

    // 3. Personer
    const assigneeInputs = document.querySelectorAll('.taskAssigneeInput');
    assigneeInputs.forEach(input => {
        if(input.value.trim() !== '') signees.push(input.value.trim());
    });
    
    const assignee = signees.length > 0 ? signees.join(', ') : null;

    // Auto-opret maskine, hvis den skrives manuelt og ikke findes
    if (asset) {
        const { data: assetData } = await supabaseClient.from('maskiner').select('id').eq('navn', asset).eq('firma_id', currentFirmaId).maybeSingle();
        if (!assetData) {
            await supabaseClient.from('maskiner').insert({
                navn: asset,
                placering: 'Oprettet fra opgave',
                firma_id: currentFirmaId,
                qr_kode_id: "QR_" + Date.now()
            });
        }
    }
    
    const payload = {
        titel: title,
        maskine_navn: asset,
        prioritet: parseInt(prio),
        beskrivelse: desc,
        firma_id: currentFirmaId,
        tildelt_titel: assignee || null,
        opretter_navn: reqName || null,
        placering: loc || null
    };

    let error;
    if (id) {
        const res = await supabaseClient.from('opgaver').update(payload).eq('id', id);
        error = res.error;
    } else {
        // Kun sæt 'status' ved oprettelse, overskriv den ikke ved redigering hvis de har ændret den fra appen!
        payload.status = 'Afventer';
        const res = await supabaseClient.from('opgaver').insert(payload);
        error = res.error;
    }

    if (!error) {
        closeAllModals();
        fetchTasks();
        e.target.reset();
        showSnackbar(id ? "Opgave opdateret succesfuldt" : "Opgave oprettet succesfuldt");
    } else {
        console.error("DB Error:", error);
        showSnackbar("Fejl: " + (error.message || "Kunne ikke gemme opgave"));
    }
}

async function populateLocationsDropdown() {
    const { data } = await supabaseClient.from('lokationer').select('navn').eq('firma_id', currentFirmaId);
    const datalist = document.getElementById('assetLocOptions');
    datalist.innerHTML = (data || []).map(l => `<option value="${l.navn}">`).join('');
}

async function populateAssetsDropdown() {
    const { data } = await supabaseClient.from('maskiner').select('navn').eq('firma_id', currentFirmaId);
    const datalist = document.getElementById('taskAssetOptions');
    datalist.innerHTML = (data || []).map(a => `<option value="${a.navn}">`).join('');
}

async function populateTaskDropdowns() {
    const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
    if (!data) return;
    
    const uniqueDepts = [...new Set(data.filter(u => u.afdeling).map(u => u.afdeling))];
    const deptList = document.getElementById('taskDeptOptions');
    if (deptList) deptList.innerHTML = uniqueDepts.map(d => `<option value="${d}">`).join('');
    
    const uniqueTitles = [...new Set(data.filter(u => u.titel).map(u => u.titel))];
    const titleList = document.getElementById('taskTitleOptions');
    if (titleList) titleList.innerHTML = uniqueTitles.map(t => `<option value="${t}">`).join('');
    
    const personList = document.getElementById('taskPersonOptions');
    if (personList) {
        personList.innerHTML = data.map(u => {
            const display = `${u.navn} (${u.arbejdsnummer})`;
            return `<option value="${display}">`;
        }).join('');
    }
    
    const { data: locs } = await supabaseClient.from('lokationer').select('navn').eq('firma_id', currentFirmaId);
    const locList = document.getElementById('taskLocOptionsAssign');
    if(locList && locs) {
        locList.innerHTML = locs.map(l => `<option value="${l.navn}">`).join('');
    }
}

function addPhoneField(navn = '', nummer = '') {
    const container = document.getElementById('dynamicPhoneContainer');
    const div = document.createElement('div');
    div.className = 'input-group dynamic-phone';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <input type="text" class="phone-name" placeholder="Navn (f.eks. Mobil)" value="${navn}" required style="flex: 1;">
        <input type="text" class="phone-num" placeholder="Nummer" value="${nummer}" required style="flex: 2;">
        <button type="button" class="btn-xs" style="background:var(--danger);color:white;" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(div);
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

function addAssigneeField(val = '') {
    const container = document.getElementById('dynamicAssigneeContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'assignee-row';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <input list="taskPersonOptions" class="taskAssigneeInput" placeholder="Søg person..." style="flex:1;" value="${val}">
        <button type="button" class="btn-xs" style="background:var(--danger);color:white;" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(div);
}

// ---------------- EDIT FUNCTIONS ----------------
function editLocation(id) {
    const loc = window.currentLocations.find(l => l.id === id);
    if (!loc) return;
    document.getElementById('locId').value = loc.id;
    document.getElementById('locName').value = loc.navn;
    document.getElementById('locDesc').value = loc.beskrivelse || '';
    document.querySelector('#modal-location h3').innerText = "Rediger Lokation";
    
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-location').classList.remove('hidden');
}

function editAsset(id) {
    const asset = window.currentAssets.find(a => a.id === id);
    if (!asset) return;
    document.getElementById('assetId').value = asset.id;
    document.getElementById('assetName').value = asset.navn;
    document.getElementById('assetLoc').value = asset.placering || '';
    document.getElementById('assetSop').value = asset.sop_link || '';
    document.querySelector('#modal-asset h3').innerText = "Rediger Maskine";
    populateLocationsDropdown();
    
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-asset').classList.remove('hidden');
}

function editTask(id) {
    const task = window.currentTasks.find(t => t.id === id);
    if (!task) return;
    
    const formT = document.querySelector('#modal-task form');
    if (formT) formT.reset();
    
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.titel;
    document.getElementById('taskDesc').value = task.beskrivelse || '';
    document.getElementById('taskRequester').value = task.opretter_navn || '';
    document.getElementById('taskLoc').value = task.placering || '';
    document.getElementById('taskAsset').value = task.maskine_navn || '';
    
    const prioNode = document.querySelector(`input[name="taskPrio"][value="${task.prioritet}"]`);
    if(prioNode) prioNode.checked = true;
    
    document.getElementById('dynamicAssigneeContainer').innerHTML = '';
    const tildelinger = task.tildelt_titel ? task.tildelt_titel.split(',').map(s => s.trim()) : [];
    if(tildelinger.length === 0) {
        addAssigneeField();
    } else {
        tildelinger.forEach(t => addAssigneeField(t));
    }

    document.querySelector('#modal-task h3').innerText = "Rediger Opgave";
    populateAssetsDropdown();
    populateTaskDropdowns();
    
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-task').classList.remove('hidden');
}

// ---------------- AUTO FILL & EVENT LISTENERS ----------------
document.addEventListener('DOMContentLoaded', () => {
    // Asset change -> Lokation Auto-fill
    const taskAssetInput = document.getElementById('taskAsset');
    if (taskAssetInput) {
        taskAssetInput.addEventListener('change', async (e) => {
            const assetName = e.target.value;
            if(!assetName || !currentFirmaId) return;
            const { data } = await supabaseClient.from('maskiner').select('placering').eq('navn', assetName).eq('firma_id', currentFirmaId).maybeSingle();
            if(data && data.placering) {
                const locInput = document.getElementById('taskLoc');
                // Sæt kun hvis feltet er tomt
                if(locInput && !locInput.value) {
                    locInput.value = data.placering;
                }
            }
        });
    }

    // Person search -> Titel & Afdeling Auto-fill (tilføjes på dynamic container)
    const container = document.getElementById('dynamicAssigneeContainer');
    if(container) {
        container.addEventListener('change', async (e) => {
            if(e.target && e.target.classList.contains('taskAssigneeInput')) {
                const val = e.target.value;
                if(!val || !currentFirmaId) return;
                // Ex: "Palle (621)"
                let realNum = val;
                if(val.includes('(') && val.includes(')')) {
                    realNum = val.split('(')[1].replace(')','').trim();
                }
                const { data } = await supabaseClient.from('brugere').select('titel, afdeling').eq('arbejdsnummer', realNum).eq('firma_id', currentFirmaId).maybeSingle();
                if(data) {
                    const tInput = document.getElementById('taskTitleAssign');
                    const dInput = document.getElementById('taskDept');
                    if(tInput && !tInput.value && data.titel) tInput.value = data.titel;
                    if(dInput && !dInput.value && data.afdeling) dInput.value = data.afdeling;
                }
            }
        });
    }
});

// ---------------- STATISTICS LOGIC ----------------
async function renderStatistics() {
    if (!supabaseClient || !currentFirmaId) return;

    // Hent alle opgaver fra Supabase
    const { data: tasks } = await supabaseClient.from('opgaver').select('status, oprettet_dato, tildelt_titel').eq('firma_id', currentFirmaId);
    if (!tasks || tasks.length === 0) return;

    const assigneeMap = {};
    const statusMap = { 'Venter': 0, 'Pause': 0, 'I gang': 0, 'Færdig': 0 };
    const dateMap = {};

    const today = new Date();
    today.setHours(0,0,0,0);
    // Skab seneste 7 dage som 0
    for(let i=6; i>=0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dateMap[d.toISOString().split('T')[0]] = 0;
    }

    // Byg kort
    tasks.forEach(t => {
        // Assignee
        const ass = (t.tildelt_titel && t.tildelt_titel.trim() !== "") ? t.tildelt_titel : 'Ufordelt';
        assigneeMap[ass] = (assigneeMap[ass] || 0) + 1;
        
        // Status
        const st = t.status || 'Venter';
        if (statusMap[st] !== undefined) statusMap[st]++;
        else statusMap[st] = 1;

        // Timeline (Dage)
        if (t.oprettet_dato) {
            const tDate = t.oprettet_dato.split('T')[0];
            if (dateMap[tDate] !== undefined) dateMap[tDate]++;
        }
    });

    if (typeof Chart === 'undefined') return;

    // 1. Doughnut: Afdeling / Titel
    const ctxA = document.getElementById('chartAssignee');
    if(chartAssigneeInst) chartAssigneeInst.destroy();
    chartAssigneeInst = new Chart(ctxA, {
        type: 'doughnut',
        data: {
            labels: Object.keys(assigneeMap),
            datasets: [{
                data: Object.values(assigneeMap),
                backgroundColor: ['#1E88E5', '#43A047', '#FFB300', '#E53935', '#E91E63', '#00ACC1', '#8E24AA']
            }]
        },
        options: { plugins: { legend: { position: 'right' } } }
    });

    // 2. Pie: Status
    const ctxS = document.getElementById('chartStatus');
    if(chartStatusInst) chartStatusInst.destroy();
    chartStatusInst = new Chart(ctxS, {
        type: 'pie',
        data: {
            labels: Object.keys(statusMap),
            datasets: [{
                data: Object.values(statusMap),
                backgroundColor: ['#9E9E9E', '#FFB300', '#1E88E5', '#43A047']
            }]
        },
        options: { plugins: { legend: { position: 'right' } } }
    });

    // 3. Bar Chart: Timeline (Dage)
    const ctxT = document.getElementById('chartTimeline');
    if(chartTimelineInst) chartTimelineInst.destroy();
    chartTimelineInst = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: Object.keys(dateMap),
            datasets: [{
                label: 'Nye Opgaver oprettet',
                data: Object.values(dateMap),
                backgroundColor: '#1E88E5',
                borderRadius: 4
            }]
        },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}
