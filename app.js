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
    // CDN exposes 'supabase' as a global, we use it to create our client
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------------- NAVIGATION ----------------
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.add('active');
    
    // Reset wizard if going to landing
    if (viewId === 'landing') {
        document.getElementById('guestNav').classList.remove('hidden');
        document.getElementById('userNav').classList.add('hidden');
    }
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
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
        btn.innerText = "Fortsæt";
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

    if (authMode === 'signup') {
        // 1. Sign up in Supabase Auth (for Admins)
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: pass,
            options: { data: { full_name: name } }
        });

        if (error) return alert("Fejl ved oprettelse: " + error.message);
        
        currentUser = data.user;
        showView('wizard'); // Start transformation
    } else {
        // 1. Check if it's an Admin (Email) or Technician (Number)
        if (email.includes('@')) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: pass
            });
            if (error) return alert("Login fejlede: " + error.message);
            currentUser = data.user;
            loadDashboard();
        } else {
            // Technician PIN logic
            const { data, error } = await supabase
                .from('brugere')
                .select()
                .eq('arbejdsnummer', email)
                .eq('adgangskode', pass)
                .maybeSingle();

            if (error || !data) return alert("Ugyldig medarbejder nr. eller PIN");
            
            showTechnicianWelcome(data);
        }
    }
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    showView('landing');
}

// ---------------- WIZARD LOGIC ----------------
function nextWizard(step) {
    document.querySelectorAll('.wizard-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('step' + step).classList.remove('hidden');
    
    // Update steps
    document.querySelectorAll('.wizard-steps .step').forEach(s => {
        if (parseInt(s.dataset.step) <= step) s.classList.add('active');
        else s.classList.remove('active');
    });

    if (step === 3) startCloudProvisioning();
}

async function startCloudProvisioning() {
    const bizName = document.getElementById('bizName').value;
    const asset = document.getElementById('firstAsset').value;
    const status = document.getElementById('wizardStatus');
    
    currentFirmaId = "FID_" + Math.random().toString(36).substr(2, 6).toUpperCase();

    const tasks = [
        "Opretter sikker cloud-database...",
        "Opsætter virksomheds-profil: " + bizName,
        "Konfigurerer " + asset + " i systemet...",
        "Færdiggør Admin rettigheder...",
        "Klar!"
    ];

    for (let i = 0; i < tasks.length; i++) {
        status.innerText = tasks[i];
        await new Promise(r => setTimeout(r, 800));
    }

    // ACTUALLY CREATE THE DATA
    try {
        // Add Admin to 'brugere' table
        await supabaseClient.from('brugere').insert({
            navn: currentUser.user_metadata.full_name,
            arbejdsnummer: "001", // Default for admin
            adgangskode: "1234", // Simple default
            rolle: 'admin',
            firma_id: currentFirmaId,
            afdeling: "Ledelse"
        });

        // Add first asset
        await supabaseClient.from('maskiner').insert({
            navn: asset,
            placering: document.getElementById('firstLoc').value || "Hovedhal",
            firma_id: currentFirmaId,
            qr_kode_id: "QR_" + Date.now()
        });

        loadDashboard();
    } catch (err) {
        alert("En fejl opstod under opsætning: " + err.message);
    }
}

// ---------------- DASHBOARD LOGIC ----------------
async function loadDashboard() {
    showView('dashboard');
    document.getElementById('guestNav').classList.add('hidden');
    document.getElementById('userNav').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = currentUser.email;

    // Load team
    fetchTeam();
}

function dashTab(tab) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('dash-' + tab).classList.add('active');
    
    document.querySelectorAll('.sidebar-links a').forEach(a => a.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

async function fetchTeam() {
    // We need to find the firma_id for this admin
    const { data } = await supabase
        .from('brugere')
        .select('firma_id')
        .eq('rolle', 'admin')
        .limit(1)
        .single();
    
    if (data) {
        currentFirmaId = data.firma_id;
        const { data: team } = await supabase
            .from('brugere')
            .select('*')
            .eq('firma_id', currentFirmaId);
            
        renderTeam(team);
    }
}

function renderTeam(team) {
    const body = document.getElementById('teamBody');
    body.innerHTML = team.map(u => `
        <tr>
            <td>${u.navn}</td>
            <td>${u.arbejdsnummer}</td>
            <td><span class="badge ${u.rolle}">${u.rolle}</span></td>
            <td><button class="btn-xs">Rediger</button></td>
        </tr>
    `).join('');
}

function openAddUser() {
    const name = prompt("Navn på medarbejder:");
    const nr = prompt("Arbejdsnummer (f.eks. 110):");
    const pin = prompt("PIN-kode (4 cifre):");
    
    if (name && nr && pin) {
        addUser(name, nr, pin);
    }
}

async function addUser(name, nr, pin) {
    const { error } = await supabaseClient.from('brugere').insert({
        navn: name,
        arbejdsnummer: nr,
        adgangskode: pin,
        rolle: 'bruger',
        firma_id: currentFirmaId,
        afdeling: 'Produktion'
    });
    
    if (error) alert("Kunne ikke tilføje bruger: " + error.message);
    else fetchTeam();
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
