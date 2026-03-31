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
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadDashboard();
    } else {
        showView('landing');
    }
}

// ---------------- NAVIGATION ----------------
function showView(viewId) {
    console.log("Skifter til view:", viewId);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }
    
    // UI Updates
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

    if (authMode === 'signup') {
        title.innerText = "Opret Admin Konto";
        sub.innerText = "Start dit firmas transformation i dag";
        btn.innerText = "Tilmeld mig";
        toggle.innerText = "Har du allerede en konto?";
        nameGroup.classList.remove('hidden');
    } else {
        title.innerText = "Log ind på EasyON";
        sub.innerText = "Indtast dine oplysninger nedenfor";
        btn.innerText = "Log ind";
        toggle.innerText = "Har du ikke en konto?";
        nameGroup.classList.add('hidden');
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
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: pass,
                options: { data: { full_name: name } }
            });
            if (error) throw error;
            currentUser = data.user;
            showView('wizard');
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
    localStorage.removeItem('supabase.auth.token');
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
        "Forbinder til sikker cloud...",
        "Opretter firma-id: " + currentFirmaId,
        "Konfigurerer databasetabeller...",
        "Tilføjer maskine: " + asset,
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
            placering: loc || "Hovedafdeling",
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
            .eq('rolle', 'admin') // Simple check
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
    document.getElementById('dash-' + tab).classList.add('active');
    
    document.querySelectorAll('.sidebar-links a').forEach(a => a.classList.remove('active'));
    if (event && event.currentTarget && event.currentTarget.tagName === 'A') {
        event.currentTarget.classList.add('active');
    }

    if (tab === 'team') fetchTeam();
    if (tab === 'assets') fetchAssets();
    if (tab === 'tasks') fetchTasks();
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

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ---------------- TECHNICIAN LOGIC ----------------
function showTechnicianWelcome(user) {
    document.getElementById('techNameDisplay').innerText = user.navn;
    document.getElementById('techFirmaDisplay').innerText = user.firma_id;
    document.getElementById('techNrDisplay').innerText = user.arbejdsnummer;
    
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('userNav').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = user.navn;
    
    showView('tech');
}
