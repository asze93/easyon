let supabaseClient;
let currentUser = null;
let currentView = 'landing';
let currentFirmaSettings = {};
let isGlobalAdmin = false;
let isSuperUser = false; 
let kraeverAnmodningReview = true;
let authMode = 'login'; 
let currentFirmaId = localStorage.getItem('easyon_firma_id') || null;
let allCompanies = [];
let allLocations = [];
let allAssets = [];
let allCategories = []; // Global liste til tag-vælger
let tagSuggestionIndex = -1; // Til keyboard-navigation
let sopSteps = []; 
let currentFirma = null;
let isLoggingOut = false; // Afbryder til logout-løkker

// ---------------- SECURITY CHECK ----------------
if (window.location.protocol === 'file:') {
    setTimeout(() => {
        alert("⚠️ VIGTIGT: Du kører EasyON direkte fra en fil (file://). Browseren blokerer derfor din adgang til databasen.\n\nDu SKAL højreklikke på index.html i VS Code og vælge 'Open with Live Server' for at login kan virke!");
        showSnackbar("Brug 'Live Server' for at få forbindelse!");
    }, 1000);
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
    console.log("[NAV]: Switching to view:", viewId);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Specifik logik for Dashboard vs Landing
    if (viewId === 'dashboard' || viewId.startsWith('view-tasks') || viewId.startsWith('view-requests')) {
        document.body.classList.add('dashboard-mode');
    } else {
        document.body.classList.remove('dashboard-mode');
        updateNavbar(); 
    }

    const target = document.getElementById('view-' + viewId.replace('view-', ''));
    if (target) {
        target.classList.add('active');
        if (viewId !== 'dashboard') window.scrollTo(0, 0);
    } else {
        console.warn("[NAV]: View element not found:", 'view-' + viewId);
    }
}

// Alias for bagudkompatibilitet
function updateDashboardStats() { loadDashboardStats(); }

// ---------------- INITIALIZATION ----------------
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

function initSupabase() {
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    fetchAllCompanies();

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (isLoggingOut) return; // Stop alt hvis vi er ved at logge ud
        
        currentUser = session?.user || null;
        updateNavbar(); 
        
        if (event === 'SIGNED_OUT') {
            localStorage.clear();
            showView('landing');
            return;
        }

        if (currentUser) {
            console.log("[Auth State Change]: Session klar for", currentUser.email);
            await loadDashboard();
        } else {
             const savedProfile = localStorage.getItem('easyon_session_profile');
             if (savedProfile) {
                  await loadDashboard(JSON.parse(savedProfile));
             } else {
                  if (document.querySelector('.view.active')?.id !== 'view-auth') showView('landing');
             }
        }
    });
}

async function fetchAllCompanies() {
    try {
        const { data, error } = await supabaseClient.from('firmaer').select('id, navn');
        if (error) throw error;
        allCompanies = data || [];
        console.log("Turbo-Lookup klar (Firmaer indlæst):", allCompanies.length);
    } catch (err) {
        console.warn("Firma-prefetch fejlede:", err);
    }
}

function updateNavbar() {
    const guestNav = document.getElementById('guestNav');
    const userNav = document.getElementById('userNav');
    const nameDisplay = document.getElementById('userNameDisplay');

    if (currentUser) {
        guestNav?.classList.add('hidden');
        userNav?.classList.remove('hidden');
        if (nameDisplay) nameDisplay.innerText = currentUser.user_metadata?.full_name || currentUser.email;
    } else {
        guestNav?.classList.remove('hidden');
        userNav?.classList.add('hidden');
    }
}

async function logout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    console.log("[Auth]: Nuclear Logout...");
    
    // 1. Ryd ALT lokalt cache FØRST
    localStorage.clear();
    sessionStorage.clear();
    
    try {
        if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (e) {
        console.warn("SignOut fejlede, men cache er ryddet:", e);
    }
    
    // 2. Nulstil alle globale variable
    currentFirmaId = null;
    currentFirma = null;
    currentUser = null;
    allAssets = [];
    allLocations = [];
    allCategories = [];
    
    // 3. Tving genindlæsning til landingssiden
    window.location.href = 'index.html';
}

async function loadDashboardStats() {
    if (!currentFirmaId) return;
    try {
        const { count: tasks } = await supabaseClient.from('opgaver').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
        const { count: assets } = await supabaseClient.from('assets').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
        const { count: reqs } = await supabaseClient.from('anmodninger').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
        
        const elTasks = document.getElementById('stat-active-tasks'), elAssets = document.getElementById('stat-total-assets'), elReqs = document.getElementById('stat-pending-requests');
        if (elTasks) elTasks.innerText = tasks || 0; 
        if (elAssets) elAssets.innerText = assets || 0; 
        if (elReqs) elReqs.innerText = reqs || 0;
        
        loadCharts();
    } catch (err) {
        console.warn("Dashboard stats fetch failed:", err);
    }
}

function loadCharts() {
    if (window.Chart) {
        document.querySelectorAll('canvas').forEach(canvas => {
            if (canvas.id.startsWith('chart')) {
                new Chart(canvas, { type: 'line', data: { labels: ['M','T','O','T','F','L','S'], datasets: [{label: 'Aktivitet', data: [10, 15, 8, 12, 11, 2, 1], borderColor: 'rgb(75, 192, 192)', tension: 0.1}] } });
            }
        });
    }
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
    if (e) e.preventDefault();
    const btn = document.getElementById('authBtn');
    if (!btn) return;
    const oldText = btn.innerText;
    let currentPhase = "Starte...";
    btn.disabled = true;
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    const loginFirma = (document.getElementById('authLoginFirma')?.value || "").trim().toLowerCase();
    const setPhase = (txt) => { currentPhase = txt; btn.innerText = txt; };
    const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout v. ${currentPhase}`)), ms));

    try {
        if (authMode === 'signup') {
            // ... (signup logic placeholder, just keeping the same)
            setPhase("Opretter...");
            const firstName = document.getElementById('authFirstName').value, lastName = document.getElementById('authLastName').value,
                  companyName = document.getElementById('authCompanyName').value, passConfirm = document.getElementById('authPassConfirm').value;
            if (pass.length < 6) throw new Error("Adgangskoden skal være mindst 6 tegn lang.");
            if (pass !== passConfirm) throw new Error("Adgangskoderne er ikke ens!");
            const { data, error } = await Promise.race([supabaseClient.auth.signUp({ email, password: pass, options: { data: { full_name: `${firstName} ${lastName}`, company: companyName } } }), timeout(15000)]);
            if (error) throw error;
            if (data.session) { currentUser = data.session.user; showView('wizard'); }
            else showView('verify-email');
        } else {
            // NYT: Rydd session FØR login for at undgå hængende 'Logger ind...'
            if (currentUser) {
                await supabaseClient.auth.signOut();
                currentUser = null;
                localStorage.clear();
            }

            if (email.includes('@')) {
                setPhase("Email login...");
                const { error } = await Promise.race([supabaseClient.auth.signInWithPassword({ email, password: pass }), timeout(15000)]);
                if (error) throw error;
                // Session vil automatisk blive fanget af onAuthStateChange
            } else {
                if (!loginFirma) throw new Error("Firma mangler.");
                setPhase("Tjekker firma...");
                // Rest of technician login logic...
                let firmaData = allCompanies.find(f => f.navn.toLowerCase() === loginFirma);
                if (!firmaData) {
                    const { data } = await Promise.race([supabaseClient.from('firmaer').select('id').eq('navn', loginFirma).maybeSingle(), timeout(10000)]);
                    if (data) firmaData = data;
                }
                if (!firmaData) throw new Error(`Firmaet '${loginFirma}' blev ikke fundet.`);
                setPhase(`Tjekker ID ${email}...`);
                const { data: profile } = await Promise.race([supabaseClient.from('brugere').select('*').eq('firma_id', firmaData.id).eq('arbejdsnummer', email).eq('adgangskode', pass).maybeSingle(), timeout(10000)]);
                if (profile) {
                    localStorage.setItem('easyon_session_profile', JSON.stringify(profile));
                    localStorage.setItem('easyon_firma_id', profile.firma_id);
                    localStorage.setItem('easyon_user_role', profile.rolle?.toLowerCase() || "");
                    await loadDashboard(profile);
                } else { throw new Error("Fejl: ID eller kode er forkert."); }
            }
        }
    } catch (err) { 
        console.error("Auth error:", err);
        showSnackbar(err.message); 
        btn.innerText = oldText; btn.disabled = false;
    } finally { 
        // Vi nulstiller kun hvis det IKKE var en succes (for ellers skifter vi view)
        if (document.getElementById('authBtn').innerText === "Logger ind...") {
            btn.innerText = oldText; btn.disabled = false;
        }
    }
}

async function nextWizard(step, btn) {
    if (step === 2) {
        const bizName = document.getElementById('bizName').value || "", bizInd = document.getElementById('bizIndustry').value || "";
        if (!bizName) { showSnackbar("Firmanavn er påkrævet."); return; }
        try {
            const { data: firma, error: fError } = await supabaseClient.from('firmaer').insert({ navn: bizName, branche: bizInd }).select().maybeSingle();
            if (fError) throw fError;
            localStorage.setItem('easyon_firma_id', firma.id);
            currentFirmaId = firma.id;
            
            const profileData = { 
                id: currentUser.id, 
                email: currentUser.email, 
                firma_id: firma.id, 
                navn: currentUser.user_metadata.full_name || "Admin", 
                rolle: 'admin.admin', 
                arbejdsnummer: 'master', 
                adgangskode: '1234' 
            };
            
            await supabaseClient.from('brugere').upsert(profileData);
            await supabaseClient.from('firma_indstillinger').upsert({ firma_id: firma.id });
            
            console.log("[Wizard]: Master Profil oprettet korrekt.");
            location.reload();
        } catch (e) { showSnackbar("Fejl: " + e.message); }
    }
}

async function loadDashboard(providedProfile = null, retryCount = 0) {
    if (isLoggingOut) return;
    
    try {
        let profile = providedProfile;
        
        if (!profile && currentUser?.email) {
            console.log(`[Dashboard]: Henter profil (Forsøg ${retryCount + 1})...`);
            const { data, error } = await supabaseClient
                .from('brugere')
                .select('*')
                .eq('email', currentUser.email)
                .maybeSingle();

            if (error) {
                if (retryCount < 3 && (error.message.includes('lock') || error.message.includes('Timeout'))) {
                    console.warn("[Dashboard]: Database lockout. Prøver igen om 1 sek...");
                    await new Promise(r => setTimeout(r, 1000));
                    return loadDashboard(null, retryCount + 1);
                }
                throw error;
            }
            profile = data;
        }

        if (profile) {
            currentFirmaId = profile.firma_id;
            const lowRole = (profile.rolle || "").toLowerCase();
            
            isGlobalAdmin = lowRole.includes('admin') || currentUser?.email === 'asze@gmail.com' || currentUser?.email === 'peter@easyon.dk';
            isSuperUser = isGlobalAdmin || lowRole.includes('superbruger') || lowRole.includes('tekniker');
            
            if (currentFirmaId) localStorage.setItem('easyon_firma_id', currentFirmaId);
            
            // Opdater UI Profil Navn
            const f = allCompanies.find(fc => fc.id === currentFirmaId);
            document.querySelectorAll('.adminName').forEach(el => el.innerText = profile.navn + " - " + (f?.navn || "EasyON"));
            
            document.querySelectorAll('.admin-only').forEach(el => {
                el.classList.toggle('hidden', !isGlobalAdmin);
            });

            // Start dataindlæsning
            showView('view-dashboard');
            updateDashboardStats();
            fetchTasks();
            fetchRequests();
            fetchAssets();
            fetchLocations();
            fetchTeam();
            fetchLager();
            fetchCategories();
            fetchIndstillinger();
            fetchProcedures();
        } else {
            console.warn("[Dashboard]: Ingen profil -> Wizard");
            showView('view-wizard');
        }
    } catch (err) {
        console.error("[Dashboard]: Kritisk fejl:", err);
        if (retryCount < 2) {
            await new Promise(r => setTimeout(r, 2000));
            return loadDashboard(null, retryCount + 1);
        }
        showSnackbar("Kunne ikke forbinde til din profil. Prøv at genindlæse (F5).");
    }
}

async function updateDashboardStats() {
    if (!currentFirmaId) return;
    try {
        const { count: tasks } = await supabaseClient.from('opgaver').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
        const { count: assets } = await supabaseClient.from('assets').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
        const { count: reqs } = await supabaseClient.from('anmodninger').select('*', { count: 'exact', head: true }).eq('firma_id', currentFirmaId);
        
        const elTasks = document.getElementById('stat-active-tasks'), elAssets = document.getElementById('stat-total-assets'), elReqs = document.getElementById('stat-pending-requests');
        if (elTasks) elTasks.innerText = tasks || 0; 
        if (elAssets) elAssets.innerText = assets || 0; 
        if (elReqs) elReqs.innerText = reqs || 0;
    } catch (err) {
        console.warn("Dashboard stats fetch failed:", err);
    }
}

// ---------------- DATA FETCHERS (ELITE SPLIT-VIEW) ----------------
async function fetchTasks() {
    if (!currentFirmaId) return;
    const { data, error } = await supabaseClient.from('opgaver').select('*, lokationer(navn), assets(navn)').eq('firma_id', currentFirmaId).order('frist', { ascending: true });
    if (!error) renderTasks(data);
}

function renderTasks(tasks) {
    const list = document.getElementById('tasksListBody');
    if (!list) return;
    list.innerHTML = "";
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<div style="padding:40px; text-align:center;" class="text-muted">Ingen aktive opgaver.</div>';
        return;
    }
    tasks.forEach(t => {
        const priorityClass = t.prioritet == 4 ? 'prio-crit' : (t.prioritet == 3 ? 'prio-high' : '');
        const div = document.createElement('div');
        div.className = `task-card-item ${priorityClass}`;
        div.id = `task-row-${t.id}`;
        div.onclick = () => selectTask(t.id);
        div.innerHTML = `
            <div style="font-weight:700; margin-bottom:4px;">${t.titel}</div>
            <div style="font-size:12px; display:flex; gap:10px;" class="text-muted">
                <span>📍 ${t.lokationer?.navn || '-'}</span>
                <span>📅 ${t.frist || 'Ingen frist'}</span>
            </div>
            <div class="task-card-status">${t.status}</div>
        `;
        list.appendChild(div);
    });
}

async function selectTask(id) {
    document.querySelectorAll('.task-card-item').forEach(el => el.classList.remove('selected'));
    document.getElementById(`task-row-${id}`)?.classList.add('selected');

    const { data, error } = await supabaseClient.from('opgaver').select('*, lokationer(navn), assets(navn), medarbejdere(navn)').eq('id', id).single();
    if (error) return;

    const detail = document.getElementById('taskDetailView');
    detail.innerHTML = `
        <div class="detail-header" style="background:#FFF; padding:20px; border-bottom:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <h2 style="font-size:24px; font-weight:800;">${data.titel}</h2>
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <span class="badge" style="background:var(--primary-light); color:var(--primary); font-weight:700;">${data.status}</span>
                        ${renderMetadataTags(data.kategori_ids)}
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-outline" onclick="editTask('${data.id}')">Redigér</button>
                    ${data.status !== 'Færdig' ? `<button class="btn-primary" onclick="quickCompleteTask('${data.id}')">Færdiggør</button>` : ''}
                    <button class="btn-outline" style="color:var(--danger);" onclick="deleteTask('${data.id}')">Slet</button>
                </div>
            </div>
        </div>
        <div class="detail-body" style="padding:30px; background:#F8FAFC; overflow-y:auto; height:calc(100% - 100px);">
            <div class="detail-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:30px;">
                <div class="detail-info-card">
                    <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:5px;">Placering & Aktiv</label>
                    <div style="font-weight:600;">📍 ${data.lokationer?.navn || 'Ikke angivet'}</div>
                    <div style="font-size:13px; color:var(--text-muted);">🏗️ ${data.assets?.navn || 'Ingen maskine'}</div>
                </div>
                <div class="detail-info-card">
                    <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:5px;">Ansvarlig</label>
                    <div style="font-weight:600;">👤 ${data.medarbejdere?.navn || 'Ikke tildelt'}</div>
                    <div style="font-size:13px; color:var(--text-muted);">📅 Deadline: ${data.frist || '-'}</div>
                </div>
            </div>
            <div class="detail-info-card" style="margin-bottom:30px;">
                <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:5px;">Beskrivelse</label>
                <div style="line-height:1.6; color:var(--text-main);">${data.beskrivelse || 'Ingen beskrivelse tilføjet.'}</div>
            </div>
            ${data.billed_url ? `
                <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:10px;">Dokumentation</label>
                <img src="${data.billed_url}" style="width:100%; border-radius:12px; box-shadow:var(--shadow);">
            ` : ''}
        </div>
    `;
}

function renderMetadataTags(ids) {
    if (!ids || ids.length === 0) return "";
    return ids.map(id => {
        const c = allCategories.find(cat => cat.id === id);
        if (!c) return "";
        return `<span class="badge" style="background:${c.farve}20; color:${c.farve}; border:1px solid ${c.farve}40;">${c.navn}</span>`;
    }).join("");
}

async function quickCompleteTask(id) {
    const { error } = await supabaseClient.from('opgaver').update({ status: 'Færdig' }).eq('id', id);
    if (!error) { showSnackbar("Opgaver markeret som færdig!"); fetchTasks(); selectTask(id); }
}

async function fetchRequests() {
    if (!currentFirmaId) return;
    const { data, error } = await supabaseClient.from('anmodninger').select('*, lokationer(navn), assets(navn)').eq('firma_id', currentFirmaId).order('created_at', { ascending: false });
    if (!error) renderRequests(data);
}

function renderRequests(reqs) {
    const list = document.getElementById('requestsListBody');
    if (!list) return;
    list.innerHTML = "";
    reqs.forEach(r => {
        const div = document.createElement('div');
        div.className = 'task-card-item';
        div.id = `req-row-${r.id}`;
        div.onclick = () => selectRequest(r.id);
        div.innerHTML = `
            <div style="font-weight:700; margin-bottom:4px;">${r.titel}</div>
            <div style="font-size:12px;" class="text-muted">📍 ${r.lokationer?.navn || '-'} | 🕒 ${new Date(r.created_at).toLocaleDateString()}</div>
        `;
        list.appendChild(div);
    });
}

async function selectRequest(id) {
    document.querySelectorAll('.task-card-item').forEach(el => el.classList.remove('selected'));
    document.getElementById(`req-row-${id}`)?.classList.add('selected');

    const { data, error } = await supabaseClient.from('anmodninger').select('*, lokationer(navn), assets(navn)').eq('id', id).single();
    if (error) return;

    const detail = document.getElementById('requestDetailView');
    detail.innerHTML = `
        <div class="detail-header" style="background:#FFF; padding:20px; border-bottom:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <h2 style="font-size:24px; font-weight:800;">${data.titel}</h2>
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <span class="badge" style="background:var(--warning); color:#FFF;">${data.status || 'Ny anmodning'}</span>
                        ${renderMetadataTags(data.kategori_ids)}
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" onclick="convertRequestToTask('${data.id}')">Lav til Opgave</button>
                    <button class="btn-outline" style="color:var(--danger);" onclick="deleteRequest('${data.id}')">Afvis</button>
                </div>
            </div>
        </div>
        <div class="detail-body" style="padding:30px;">
            <div class="detail-info-card" style="margin-bottom:20px;">
                <label style="display:block; font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:5px;">Beskrivelse</label>
                <div>${data.beskrivelse || 'Ingen yderligere info.'}</div>
            </div>
            ${data.billed_url ? `<img src="${data.billed_url}" style="width:100%; border-radius:12px; margin-top:20px;">` : ''}
        </div>
    `;
}

// ---------------- DASHBOARD AGGREGATION ----------------

function dashTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(n => n.classList.remove('active'));
    document.getElementById('dash-' + tabId)?.classList.add('active');
    document.querySelectorAll('.dash-nav[data-tab="'+tabId+'"]').forEach(n => n.classList.add('active'));
}

function toggleSidebar(force) {
    const sidebar = document.getElementById('dashboardSidebar');
    if (!sidebar) return;
    if (force === true) sidebar.classList.add('mobile-open');
    else if (force === false) sidebar.classList.remove('mobile-open');
    else sidebar.classList.toggle('mobile-open');
}

function dashNavTab(e, tabId) {
    if (e) e.preventDefault();
    const bossOnlyTabs = ['team', 'indstillinger', 'kpi'];
    if (bossOnlyTabs.includes(tabId) && !isGlobalAdmin) { showSnackbar("Kun for Admins."); return; }
    if (!isSuperUser) { showSnackbar("Ingen adgang."); return; }
    toggleSidebar(false);
    if (tabId === 'lager') fetchLager();
    if (tabId === 'assets') fetchAssets();
    if (tabId === 'locations') fetchLocations();
    if (tabId === 'team') fetchTeam();
    if (tabId === 'categories') fetchCategories();
    if (tabId === 'procedures') fetchProcedures();
    dashTab(tabId);
}

// ---------------- DATA FETCHERS ----------------
let currentSopId = null;
async function fetchProcedures() {
    const list = document.getElementById('sopTemplateList'); if (!list) return;
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('procedurer').select('*').eq('firma_id', currentFirmaId).order('titel');
    list.innerHTML = (!data || data.length === 0) ? '<div style="padding:40px; text-align:center;" class="text-muted">Ingen procedurer fundet.</div>' : '';
    data?.forEach(sop => {
        const div = document.createElement('div'); div.className = 'sop-card-item'; div.id = `sop-item-${sop.id}`;
        div.onclick = () => selectSopFromLibrary(sop);
        div.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><div style="width:40px; height:40px; background:var(--glass); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px;">📄</div><div style="flex:1;"><div style="font-weight:700;">${sop.titel}</div><div style="font-size:12px; color:var(--text-muted);">${sop.trin?.length || 0} trin</div></div></div>`;
        list.appendChild(div);
    });
}
function selectSopFromLibrary(sop) {
    document.querySelectorAll('.sop-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`sop-item-${sop.id}`)?.classList.add('active');
    document.getElementById('sopLibraryPreview').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; padding:40px;"><div><h2 style="font-size:32px; font-weight:800; margin-bottom:8px;">${sop.titel}</h2><p class="text-muted">${sop.beskrivelse || ''}</p></div><div style="display:flex; gap:10px;"><button class="btn-outline" onclick="openSopEditor('${sop.id}')">Rediger</button><button class="btn-outline" style="color:var(--danger);" onclick="deleteSop('${sop.id}')">Slet</button></div></div>
        <div style="padding:0 40px;"><div style="background:#F8FAFC; padding:24px; border-radius:20px; border:1px solid var(--border);"><h4>Oversigt</h4><p>${sop.trin?.length || 0} trin</p></div></div>`;
}
async function deleteSop(id) { if (confirm("Slet?")) { await supabaseClient.from('procedurer').delete().eq('id', id); fetchProcedures(); } }

async function fetchTeam() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
    const b = document.getElementById('teamBody'); if (b) { b.innerHTML = ""; data?.forEach(u => b.innerHTML += `<tr><td>${u.navn}</td><td>${u.arbejdsnummer}</td><td>${u.rolle}</td><td><button onclick="editTeam('${u.id}')">Ret</button><button onclick="deleteTeamMember('${u.id}')">Slet</button></td></tr>`); }
}
async function handleTeamSubmit(e) {
    e.preventDefault(); const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('teamId').value, name = document.getElementById('teamName').value, nr = document.getElementById('teamNr').value, role = document.getElementById('teamRolle').value, pin = document.getElementById('teamPin').value;
    const d = { firma_id: currentFirmaId, navn: name, arbejdsnummer: nr, rolle: role, adgangskode: pin };
    if (id) d.id = id;
    const { error } = await supabaseClient.from('brugere').upsert(d, { onConflict: 'id' });
    setLoading(btn, false);
    if (!error) { closeAllModals(); fetchTeam(); showSnackbar("Gemt!"); }
    else { console.error("Team submit error:", error); showSnackbar("Gem fejlede: " + error.message); }
}

async function editTask(id) {
    console.log("[Opgave]: Henter data for redigering af ID:", id);
    const { data, error } = await supabaseClient.from('opgaver').select('*').eq('id', id).maybeSingle();
    if (error) { console.error("Fejl ved hentning af opgave:", error); return; }
    if (data) {
        await openModal('modal-task'); // Dette loader dropdowns osv.
        
        const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val || ''; };
        setVal('taskId', data.id);
        setVal('taskTitle', data.titel);
        setVal('taskDesc', data.beskrivelse);
        setVal('taskStatus', data.status);
        setVal('taskPriority', data.prioritet);
        setVal('taskDueDate', data.frist);
        setVal('taskLocation', data.lokation_id);
        setVal('taskAsset', data.asset_id);
        setVal('taskSop', data.sop_id);
        setVal('taskAssignee', data.medarbejder_id);
        setVal('taskPhotoUrl', data.billed_url);

        // Kategori-tags (UUID array)
        const hiddenInput = document.getElementById('taskCategoryIds');
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(data.kategori_ids || []);
            renderPickerTags('task', data.kategori_ids || []);
        }

        if (data.lokation_id) filterAssetsByLocation('task');
        
        if (data.billed_url) {
            const preview = document.getElementById('taskPhotoPreview');
            if (preview) preview.src = data.billed_url;
            document.getElementById('photoPlaceholder')?.classList.add('hidden');
            document.getElementById('photoPreviewContainer')?.classList.remove('hidden');
        }
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault(); 
    const btn = e.submitter; 
    setLoading(btn, true);

    if (!currentFirmaId) currentFirmaId = localStorage.getItem('easyon_firma_id');

    try {
        const id = document.getElementById('taskId').value, 
              title = document.getElementById('taskTitle').value, 
              desc = document.getElementById('taskDesc').value,
              status = document.getElementById('taskStatus')?.value || 'Venter',
              priority = document.getElementById('taskPriority').value,
              dueDate = document.getElementById('taskDueDate').value,
              rawCatIds = document.getElementById('taskCategoryIds').value || '[]',
              catIds = JSON.parse(rawCatIds),
              lokId = document.getElementById('taskLocation').value, 
              assetId = document.getElementById('taskAsset').value, 
              sopId = document.getElementById('taskSop').value, 
              userId = document.getElementById('taskAssignee').value,
              photoUrl = document.getElementById('taskPhotoUrl').value;

        const d = { 
            firma_id: currentFirmaId, 
            titel: title, 
            beskrivelse: desc, 
            status: status,
            prioritet: parseInt(priority) || 1,
            frist: dueDate || null,
            kategori_ids: catIds, 
            lokation_id: lokId || null, 
            asset_id: assetId || null, 
            sop_id: sopId || null, 
            medarbejder_id: userId || null,
            billed_url: photoUrl || null
        };

        if (!currentFirmaId) throw new Error("Intet Firmanavn fundet. Prøv at logge ud og ind igen.");

        const { error } = id ? 
            await supabaseClient.from('opgaver').update(d).eq('id', id) : 
            await supabaseClient.from('opgaver').insert([d]);
        
        if (error) throw error;
        
        closeAllModals(); 
        fetchTasks(); 
        updateDashboardStats(); 
        showSnackbar("Arbejdsordre gemt!"); 
        
    } catch (err) {
        console.error("TASK SUBMIT ERROR:", err);
        showSnackbar("Fejl ved gemning: " + err.message);
    } finally {
        setLoading(btn, false);
    }
}

// --- TAG PICKER LOGIC ---
function renderPickerTags(type, ids) {
    const container = document.getElementById(type === 'task' ? 'taskTagContainer' : 'reqTagContainer');
    if (!container) return;
    container.querySelectorAll('.tag-item').forEach(el => el.remove());
    ids.forEach(id => {
        const c = allCategories.find(cat => cat.id === id);
        if (c) {
            const tagEl = document.createElement('div');
            tagEl.className = 'tag-item';
            tagEl.id = `tag-${type}-${c.id}`;
            tagEl.innerHTML = `${c.navn} <span class="remove" onclick="removeTag('${c.id}', '${type}')">✕</span>`;
            container.insertBefore(tagEl, container.querySelector('.tag-input-field'));
        }
    });
}

function addTag(id, name, type) {
    const hiddenInput = document.getElementById(type === 'task' ? 'taskCategoryIds' : 'reqCategoryIds');
    let ids = JSON.parse(hiddenInput.value || '[]');
    if (!ids.includes(id)) {
        ids.push(id);
        hiddenInput.value = JSON.stringify(ids);
        renderPickerTags(type, ids);
    }
    const input = document.getElementById(type === 'task' ? 'taskTagInput' : 'reqTagInput');
    if (input) { input.value = ''; input.focus(); }
    document.getElementById(type === 'task' ? 'taskTagSuggestions' : 'reqTagSuggestions')?.classList.add('hidden');
}

function removeTag(id, type) {
    const hiddenInput = document.getElementById(type === 'task' ? 'taskCategoryIds' : 'reqCategoryIds');
    let ids = JSON.parse(hiddenInput.value || '[]');
    ids = ids.filter(cid => cid !== id);
    hiddenInput.value = JSON.stringify(ids);
    renderPickerTags(type, ids);
}

function handleTagInput(input, type) {
    const val = input.value.toLowerCase();
    const suggestions = document.getElementById(type === 'task' ? 'taskTagSuggestions' : 'reqTagSuggestions');
    if (!suggestions) return;
    const matches = val ? allCategories.filter(c => c.navn.toLowerCase().includes(val)) : allCategories;
    if (matches.length > 0) {
        tagSuggestionIndex = -1;
        suggestions.innerHTML = matches.map((m, idx) => `<div class="tag-suggestion-item" id="tag-suggest-${type}-${idx}" onclick="addTag('${m.id}', '${m.navn}', '${type}')">${m.navn}</div>`).join('');
        suggestions.classList.remove('hidden');
    } else {
        suggestions.classList.add('hidden');
    }
}

function handleTagKeydown(e, type) {
    const suggestions = document.getElementById(type === 'task' ? 'taskTagSuggestions' : 'reqTagSuggestions');
    if (!suggestions || suggestions.classList.contains('hidden')) return;
    const items = suggestions.querySelectorAll('.tag-suggestion-item');
    if (e.key === "ArrowDown") {
        e.preventDefault(); tagSuggestionIndex = Math.min(tagSuggestionIndex + 1, items.length - 1);
        updateTagHighlight(items, type);
    } else if (e.key === "ArrowUp") {
        e.preventDefault(); tagSuggestionIndex = Math.max(tagSuggestionIndex - 1, 0);
        updateTagHighlight(items, type);
    } else if (e.key === "Enter") {
        e.preventDefault(); if (tagSuggestionIndex > -1) items[tagSuggestionIndex].click();
    }
}

function updateTagHighlight(items, type) {
    items.forEach((item, idx) => item.classList.toggle('active', idx === tagSuggestionIndex));
    if (tagSuggestionIndex > -1) items[tagSuggestionIndex].scrollIntoView({ block: 'nearest' });
}
function handleTagInput(input, type) {
    const val = input.value.toLowerCase();
    const suggestions = document.getElementById(type === 'task' ? 'taskTagSuggestions' : 'reqTagSuggestions');
    
    // Vis alle hvis tom, ellers filtrer
    const matches = val ? allCategories.filter(c => c.navn.toLowerCase().includes(val)) : allCategories;
    
    if (matches.length > 0) {
        tagSuggestionIndex = -1; // Reset highlight
        suggestions.innerHTML = matches.map((m, idx) => `
            <div class="tag-suggestion-item" id="tag-suggest-${type}-${idx}" onclick="addTag('${m.id}', '${m.navn}', '${type}')">${m.navn}</div>
        `).join('');
        suggestions.classList.remove('hidden');
    } else {
        suggestions.classList.add('hidden');
    }
}

function handleTagKeydown(e, type) {
    const suggestions = document.getElementById(type === 'task' ? 'taskTagSuggestions' : 'reqTagSuggestions');
    const items = suggestions.querySelectorAll('.tag-suggestion-item');
    if (suggestions.classList.contains('hidden')) return;

    if (e.key === "ArrowDown") {
        e.preventDefault();
        tagSuggestionIndex = Math.min(tagSuggestionIndex + 1, items.length - 1);
        updateTagHighlight(items);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        tagSuggestionIndex = Math.max(tagSuggestionIndex - 1, 0);
        updateTagHighlight(items);
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (tagSuggestionIndex > -1 && items[tagSuggestionIndex]) {
            items[tagSuggestionIndex].click();
        }
    } else if (e.key === "Escape") {
        suggestions.classList.add('hidden');
    }
}

function updateTagHighlight(items) {
    items.forEach((item, idx) => {
        if (idx === tagSuggestionIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function addTag(id, navn, type) {
    const hiddenInput = document.getElementById(type === 'task' ? 'taskCategoryIds' : 'reqCategoryIds');
    const container = document.getElementById(type === 'task' ? 'taskTagContainer' : 'reqTagContainer');
    const inputField = container.querySelector('.tag-input-field');
    const suggestions = document.getElementById(type === 'task' ? 'taskTagSuggestions' : 'reqTagSuggestions');

    let currentIds = JSON.parse(hiddenInput.value || '[]');
    if (currentIds.includes(id)) { inputField.value = ""; suggestions.classList.add('hidden'); return; }

    currentIds.push(id);
    hiddenInput.value = JSON.stringify(currentIds);

    const tagEl = document.createElement('div');
    tagEl.className = 'tag-item';
    tagEl.id = `tag-${type}-${id}`;
    tagEl.innerHTML = `${navn} <span class="remove" onclick="removeTag('${id}', '${type}')">✕</span>`;
    
    container.insertBefore(tagEl, inputField);
    inputField.value = "";
    suggestions.classList.add('hidden');
}

function removeTag(id, type) {
    const hiddenInput = document.getElementById(type === 'task' ? 'taskCategoryIds' : 'reqCategoryIds');
    const tagEl = document.getElementById(`tag-${type}-${id}`);
    
    let currentIds = JSON.parse(hiddenInput.value || '[]');
    currentIds = currentIds.filter(cid => cid !== id);
    hiddenInput.value = JSON.stringify(currentIds);

    tagEl?.remove();
}

function handleTaskPhotoPreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('taskPhotoPreview').src = e.target.result;
            document.getElementById('photoPlaceholder').classList.add('hidden');
            document.getElementById('photoPreviewContainer').classList.remove('hidden');
            document.getElementById('taskPhotoUrl').value = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function removeTaskPhoto() {
    document.getElementById('taskPhoto').value = "";
    document.getElementById('taskPhotoUrl').value = "";
    document.getElementById('photoPlaceholder').classList.remove('hidden');
    document.getElementById('photoPreviewContainer').classList.add('hidden');
}

async function fetchAssets() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('assets').select('*, lokationer(navn)').eq('firma_id', currentFirmaId).order('navn');
    const b = document.getElementById('assetsBody'); if (b) { b.innerHTML = ""; data?.forEach(a => b.innerHTML += `<tr><td>${a.navn}</td><td>${a.lokationer?.navn || '-'}</td><td><button class="btn-outline" style="padding:4px 8px; font-size:12px; margin-right:5px;" onclick="editAsset('${a.id}')">Ret</button><button class="btn-outline" style="padding:4px 8px; font-size:12px; color:var(--danger);" onclick="deleteAsset('${a.id}')">Slet</button></td></tr>`); }
}
async function editAsset(id) {
    const { data } = await supabaseClient.from('assets').select('*').eq('id', id).maybeSingle();
    if (data) {
        await openModal('modal-asset');
        document.getElementById('assetId').value = data.id;
        document.getElementById('assetName').value = data.navn;
        document.getElementById('assetLoc').value = data.lokation_id || '';
        document.getElementById('assetParent').value = data.parent_asset_id || '';
    }
}
async function handleAssetSubmit(e) {
    e.preventDefault(); const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('assetId').value, navn = document.getElementById('assetName').value, lokId = document.getElementById('assetLoc').value, parentId = document.getElementById('assetParent').value;
    const d = { navn, lokation_id: lokId || null, parent_asset_id: parentId || null, firma_id: currentFirmaId };
    if (id) d.id = id;
    const { error } = await supabaseClient.from('assets').upsert(d, { onConflict: 'navn, firma_id' });
    setLoading(btn, false);
    if (!error) { closeAllModals(); fetchAssets(); showSnackbar("Asset gemt!"); }
    else { console.error("Asset submit error:", error); showSnackbar("Fejl: " + error.message); }
}

async function fetchLocations() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('lokationer').select('*').eq('firma_id', currentFirmaId).order('navn');
    const b = document.getElementById('locationsBody'); if (b) { b.innerHTML = ""; data?.forEach(l => b.innerHTML += `<tr><td>${l.navn}</td><td>${l.beskrivelse || ''}</td><td><button class="btn-outline" style="padding:4px 8px; font-size:12px; margin-right:5px;" onclick="editLocation('${l.id}')">Ret</button><button class="btn-outline" style="padding:4px 8px; font-size:12px; color:var(--danger);" onclick="deleteLocation('${l.id}')">Slet</button></td></tr>`); }
}
async function editLocation(id) {
    const { data } = await supabaseClient.from('lokationer').select('*').eq('id', id).maybeSingle();
    if (data) {
        await openModal('modal-location');
        document.getElementById('locId').value = data.id;
        document.getElementById('locName').value = data.navn;
        document.getElementById('locDesc').value = data.beskrivelse || '';
    }
}
async function handleLocationSubmit(e) {
    e.preventDefault(); const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('locId').value, name = document.getElementById('locName').value, desc = document.getElementById('locDesc').value;
    const d = { navn: name, beskrivelse: desc, firma_id: currentFirmaId };
    if (id) d.id = id;
    const { error } = await supabaseClient.from('lokationer').upsert(d, { onConflict: 'navn, firma_id' });
    setLoading(btn, false);
    if (!error) { closeAllModals(); fetchLocations(); showSnackbar("Lokation gemt!"); }
    else { console.error("Location submit error:", error); showSnackbar("Kunne ikke gemme: " + error.message); }
}

async function fetchLager() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('lager').select('*').eq('firma_id', currentFirmaId);
    const b = document.getElementById('lagerBody'); if (b) { b.innerHTML = ""; data?.forEach(i => b.innerHTML += `<tr><td>${i.navn}</td><td>${i.lokation || '-'}</td><td>${i.antal_paa_lager}</td><td>${i.min_beholdning || 0}</td><td>${i.stregkode || ''}</td><td><button onclick="deleteLager('${i.id}')">Slet</button></td></tr>`); }
}
async function handleLagerSubmit(e) {
    e.preventDefault(); const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('lagerId').value, navn = document.getElementById('lagerNavn').value, antal = document.getElementById('lagerAntal').value, lok = document.getElementById('lagerLokation').value, min = document.getElementById('lagerMin').value, code = document.getElementById('lagerCode').value;
    const d = { 
        navn, 
        antal_paa_lager: parseInt(antal) || 0, 
        minimums_beholdning: parseInt(min) || 0, 
        lokation_tekst: lok, 
        stregkode: code, 
        firma_id: currentFirmaId 
    };
    if (id) d.id = id;
    const { error } = await supabaseClient.from('lager').upsert(d, { onConflict: 'navn, firma_id' });
    setLoading(btn, false);
    if (!error) { closeAllModals(); fetchLager(); showSnackbar("Lagervare gemt!"); }
    else { console.error("Lager submit error:", error); showSnackbar("Lagerfejl: " + error.message); }
}

async function fetchCategories() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('kategorier').select('*').eq('firma_id', currentFirmaId).order('navn');
    const b = document.getElementById('categoriesBody'); if (b) { b.innerHTML = ""; data?.forEach(c => b.innerHTML += `<tr><td>${c.navn}</td><td><span style="background:${c.farve}; width:20px; height:20px; border-radius:50%; display:block;"></span></td><td>-</td><td><button class="btn-outline" style="padding:4px 8px; font-size:12px; margin-right:5px;" onclick="editCategory('${c.id}')">Ret</button><button class="btn-outline" style="padding:4px 8px; font-size:12px; color:var(--danger);" onclick="deleteCategory('${c.id}')">Slet</button></td></tr>`); }
}
async function editCategory(id) {
    const { data } = await supabaseClient.from('kategorier').select('*').eq('id', id).maybeSingle();
    if (data) {
        await openModal('modal-category');
        document.getElementById('catId').value = data.id;
        document.getElementById('catName').value = data.navn;
        document.getElementById('catColor').value = data.farve;
    }
}
async function handleCategorySubmit(e) {
    e.preventDefault(); const btn = e.submitter; setLoading(btn, true);
    const id = document.getElementById('catId').value, name = document.getElementById('catName').value, col = document.getElementById('catColor').value;
    const d = { navn: name, farve: col, firma_id: currentFirmaId };
    if (id) d.id = id;
    const { error } = await supabaseClient.from('kategorier').upsert(d, { onConflict: 'navn, firma_id' });
    setLoading(btn, false);
    if (!error) { closeAllModals(); fetchCategories(); showSnackbar("Kategori gemt!"); }
    else { showSnackbar("Fejl: " + error.message); }
}

async function fetchIndstillinger() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('firma_indstillinger').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) { 
        document.getElementById('set_farve').value = (data.app_tema_farve ? '#' + data.app_tema_farve : '#3B82F6');
        document.getElementById('kraever_review').checked = data.kraever_anmodning_review || false;
        document.getElementById('set_lokationer').checked = data.vis_lokationer || true;
        document.getElementById('set_sop').checked = data.vis_sop || true;
        document.getElementById('set_billede').checked = data.krav_billede || false;
    }
}
async function saveIndstillinger() {
    const col = document.getElementById('set_farve').value, review = document.getElementById('kraever_review').checked, lok = document.getElementById('set_lokationer').checked, sop = document.getElementById('set_sop').checked, img = document.getElementById('set_billede').checked;
    await supabaseClient.from('firma_indstillinger').upsert({ firma_id: currentFirmaId, app_tema_farve: col.replace('#',''), kraever_anmodning_review: review, vis_lokationer: lok, vis_sop: sop, krav_billede: img }, { onConflict: 'firma_id' });
    showSnackbar("Gemt!");
}

async function openModal(id, reset = false) {
    if (reset) {
        const f = document.querySelector(`#${id} form`);
        if (f) f.reset();
        const h = document.querySelector(`#${id} input[type="hidden"]`);
        if (h) h.value = "";
    }

    const m = document.getElementById(id);
    const overlay = document.getElementById('modal-overlay');
    if (m) m.classList.remove('hidden');
    if (overlay) overlay.classList.remove('hidden');

    try {
        if (!currentFirmaId) {
            currentFirmaId = localStorage.getItem('easyon_firma_id');
            if (!currentFirmaId) return;
        }

        if (id === 'modal-task') {
            const { data: locs } = await supabaseClient.from('lokationer').select('id, navn').eq('firma_id', currentFirmaId);
            const { data: ass } = await supabaseClient.from('assets').select('id, navn, lokation_id').eq('firma_id', currentFirmaId);
            const { data: sops } = await supabaseClient.from('procedurer').select('id, titel').eq('firma_id', currentFirmaId);
            const { data: users } = await supabaseClient.from('brugere').select('id, navn').eq('firma_id', currentFirmaId);
            const { data: cats } = await supabaseClient.from('kategorier').select('id, navn').eq('firma_id', currentFirmaId);

            allLocations = locs || [];
            allAssets = ass || [];
            allCategories = cats || [];

            const elLoc = document.getElementById('taskLocation');
            const elAss = document.getElementById('taskAsset');
            const elSop = document.getElementById('taskSop');
            const elUser = document.getElementById('taskAssignee');

            if (elLoc) {
                elLoc.innerHTML = '<option value="">- Vælg Lokation -</option>';
                locs?.forEach(l => elLoc.innerHTML += `<option value="${l.id}">${l.navn}</option>`);
            }
            if (elAss) {
                elAss.innerHTML = '<option value="">- Vælg Asset -</option>';
                ass?.forEach(a => elAss.innerHTML += `<option value="${a.id}">${a.navn}</option>`);
            }
            if (elSop) {
                elSop.innerHTML = '<option value="">- Ingen SOP -</option>';
                sops?.forEach(s => elSop.innerHTML += `<option value="${s.id}">${s.titel}</option>`);
            }
            if (elUser) {
                elUser.innerHTML = '<option value="">- Ikke tildelt -</option>';
                users?.forEach(u => elUser.innerHTML += `<option value="${u.id}">${u.navn}</option>`);
            }

            // Nulstil Tags
            document.querySelectorAll(`.tag-item`).forEach(el => el.remove());
            document.getElementById('taskCategoryIds').value = "[]";

            if (reset) removeTaskPhoto();
        }

        if (id === 'modal-request') {
            const { data: cats } = await supabaseClient.from('kategorier').select('id, navn').eq('firma_id', currentFirmaId);
            allCategories = cats || [];
            
            // Nulstil Tags
            document.querySelectorAll(`.tag-item`).forEach(el => el.remove());
            document.getElementById('reqCategoryIds').value = "[]";
            
            if (reset) removeRequestPhoto();
        }

        if (id === 'modal-asset') {
            const { data: locs } = await supabaseClient.from('lokationer').select('id, navn').eq('firma_id', currentFirmaId);
            const { data: parents } = await supabaseClient.from('assets').select('id, navn').eq('firma_id', currentFirmaId);
            
            const elLoc = document.getElementById('assetLoc');
            const elParent = document.getElementById('assetParent');

            if (elLoc) {
                elLoc.innerHTML = '<option value="">- Vælg Lokation -</option>';
                locs?.forEach(l => elLoc.innerHTML += `<option value="${l.id}">${l.navn}</option>`);
            }
            if (elParent) {
                elParent.innerHTML = '<option value="">- Ingen (Dette er hoved-aktivet) -</option>';
                parents?.forEach(p => elParent.innerHTML += `<option value="${p.id}">${p.navn}</option>`);
            }
        }

    } catch (err) {
        console.error("[UI]: Kunne ikke forberede modal-data:", err);
    }
}

function filterAssetsByLocation(type = 'task') {
    const locId = document.getElementById(type === 'task' ? 'taskLocation' : 'reqLocation').value;
    const assetSelect = document.getElementById(type === 'task' ? 'taskAsset' : 'reqAsset');
    if (!assetSelect) return;
    
    assetSelect.innerHTML = '<option value="">- Vælg Asset -</option>';
    const filtered = locId ? allAssets.filter(a => a.lokation_id === locId) : allAssets;
    filtered.forEach(a => assetSelect.innerHTML += `<option value="${a.id}">${a.navn}</option>`);
}

function closeAllModals() {
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.getElementById('modal-overlay').classList.add('hidden');
}

async function deleteAsset(id) { if (confirm("Slet?")) { await supabaseClient.from('assets').delete().eq('id', id); fetchAssets(); } }
async function deleteLocation(id) { if (confirm("Slet?")) { await supabaseClient.from('lokationer').delete().eq('id', id); fetchLocations(); } }
async function deleteTeamMember(id) { if (confirm("Slet?")) { await supabaseClient.from('brugere').delete().eq('id', id); fetchTeam(); } }
async function deleteCategory(id) { if (confirm("Slet?")) { await supabaseClient.from('kategorier').delete().eq('id', id); fetchCategories(); } }
async function deleteLager(id) { if (confirm("Slet?")) { await supabaseClient.from('lager').delete().eq('id', id); fetchLager(); } }
async function deleteTask(id) { if (confirm("Slet opgave permanent?")) { await supabaseClient.from('opgaver').delete().eq('id', id); fetchTasks(); document.getElementById('taskDetailView').innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; text-align:center; color:var(--text-muted); padding:40px;"><i class="icon" style="font-size:48px; margin-bottom:20px;">📋</i><h3>Opgave slettet</h3><p>Vælg en anden opgave.</p></div>'; } }

async function editAsset(id) { const { data } = await supabaseClient.from('assets').select('*').eq('id', id).maybeSingle(); if (data) { document.getElementById('assetId').value = data.id; document.getElementById('assetName').value = data.navn; document.getElementById('assetLoc').value = data.lokation_id || ''; openModal('modal-asset'); } }
async function editTeam(id) { const { data } = await supabaseClient.from('brugere').select('*').eq('id', id).maybeSingle(); if (data) { document.getElementById('teamId').value = data.id; document.getElementById('teamName').value = data.navn || ''; document.getElementById('teamNr').value = data.arbejdsnummer || ''; document.getElementById('teamRolle').value = data.rolle || 'tekniker'; document.getElementById('teamPin').value = data.adgangskode || ''; openModal('modal-team'); } }

async function fetchRequests() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('anmodninger').select('*, assets(navn), lokationer(navn), kategorier(navn)').eq('firma_id', currentFirmaId).order('id',{ascending:false});
    const list = document.getElementById('requestsList');
    if (!list) return;
    list.innerHTML = "";

    if (!data || data.length === 0) {
        list.innerHTML = '<div style="padding:40px; text-align:center;" class="text-muted">Ingen aktive anmodninger.</div>';
        return;
    }

    data.forEach(r => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.id = `req-card-${r.id}`;
        div.onclick = () => selectRequest(r);

        let priorityLabel = "⚪ Info";
        if (r.prioritet == 2) priorityLabel = "🟡 Snarest";
        if (r.prioritet == 3) priorityLabel = "🟠 Vigtig";
        if (r.prioritet == 4) priorityLabel = "🔴 AKUT";

        div.innerHTML = `
            <h4>${r.titel}</h4>
            <div class="meta" style="margin-top:5px;">
                <span class="badge" style="background:#f1f5f9; color:#64748b;">${priorityLabel}</span>
                <span class="badge venter">Ny</span>
            </div>
            <div class="meta" style="margin-top:8px;">
                <span>🏗️ ${r.assets?.navn || 'Intet asset'}</span>
                <span>📅 ${new Date(r.created_at).toLocaleDateString('da-DK')}</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function selectRequest(r) {
    document.querySelectorAll('.item-card').forEach(el => el.classList.remove('active'));
    document.getElementById(`req-card-${r.id}`)?.classList.add('active');
    
    const detail = document.getElementById('requestDetailView');
    if (!detail) return;

    let priorityLabel = "Info / Lav";
    let priorityColor = "#64748b";
    if (r.prioritet == 2) { priorityLabel = "Snarest / Medium"; priorityColor = "#ca8a04"; }
    if (r.prioritet == 3) { priorityLabel = "Vigtig / Høj"; priorityColor = "#ea580c"; }
    if (r.prioritet == 4) { priorityLabel = "AKUT / Nedbrud"; priorityColor = "#dc2626"; }

    detail.innerHTML = `
        <div class="detail-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h1 style="font-size:32px; font-weight:800; margin-bottom:12px;">${r.titel}</h1>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span class="badge venter" style="font-size:14px; padding:6px 16px;">Ny Anmodning</span>
                        <span style="font-weight:800; color:${priorityColor}; font-size:13px; text-transform:uppercase;">● ${priorityLabel}</span>
                    </div>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn-primary" onclick="convertRequest('${r.id}')">Opret Opgave Ud Fra Denne</button>
                    <button class="btn-outline" style="color:var(--danger);" onclick="deleteRequest('${r.id}')">Afvis</button>
                </div>
            </div>
        </div>
        <div class="detail-body">
            ${r.billed_url ? `
                <div class="detail-section">
                    <h4>Billeddokumentation fra anmelder</h4>
                    <img src="${r.billed_url}" style="width:100%; max-width:500px; border-radius:20px; box-shadow:var(--shadow-lg); border:1px solid var(--border);">
                </div>
            ` : ''}

            <div class="detail-section">
                <h4>Information</h4>
                <div class="info-grid">
                    <div class="info-item"><label>Lokation</label><span>${r.lokationer?.navn || '-'}</span></div>
                    <div class="info-item"><label>Asset / Maskine</label><span>${r.assets?.navn || '-'}</span></div>
                    <div class="info-item"><label>Kategori</label><span>${r.kategorier?.navn || 'Ingen'}</span></div>
                    <div class="info-item"><label>Dato</label><span>${new Date(r.created_at).toLocaleString('da-DK')}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h4>Problembeskrivelse</h4>
                <p style="font-size:16px; line-height:1.6; color:var(--text-main);">${r.beskrivelse || 'Ingen yderligere info.'}</p>
            </div>
        </div>
    `;
}

async function deleteRequest(id) { 
    if (confirm("Er du sikker på at du vil afvise denne anmodning?")) { 
        await supabaseClient.from('anmodninger').delete().eq('id', id); 
        fetchRequests(); 
        document.getElementById('requestDetailView').innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; text-align:center; color:var(--text-muted); padding:40px;"><i class="icon" style="font-size:48px; margin-bottom:20px;">📥</i><h3>Anmodning fjernet</h3><p>Vælg en anden anmodning fra listen.</p></div>';
    } 
}
async function handleRequestSubmit(e) {
    e.preventDefault(); const btn = e.submitter; setLoading(btn, true);
    const title = document.getElementById('reqTitle').value, 
          desc = document.getElementById('reqDesc').value,
          priority = document.getElementById('reqPriority').value,
          lokId = document.getElementById('reqLocation').value,
          assetId = document.getElementById('reqAsset').value,
          catIds = JSON.parse(document.getElementById('reqCategoryIds').value || '[]'),
          photoUrl = document.getElementById('reqPhotoUrl').value;

    const d = { 
        firma_id: currentFirmaId, 
        titel: title, 
        beskrivelse: desc,
        prioritet: parseInt(priority) || 1,
        lokation_id: lokId || null,
        asset_id: assetId || null,
        kategori_ids: catIds, 
        billed_url: photoUrl || null,
        status: 'Afventer' // Anmodninger starter altid som Afventer
    };

    const { error } = await supabaseClient.from('anmodninger').insert(d);
    setLoading(btn, false);
    if (!error) { closeAllModals(); fetchRequests(); showSnackbar("Anmodning sendt!"); }
    else { showSnackbar("Fejl: " + error.message); }
}

function handleRequestPhotoPreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('reqPhotoPreview').src = e.target.result;
            document.getElementById('reqPhotoPlaceholder').classList.add('hidden');
            document.getElementById('reqPhotoPreviewContainer').classList.remove('hidden');
            document.getElementById('reqPhotoUrl').value = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function removeRequestPhoto() {
    document.getElementById('reqPhoto').value = "";
    document.getElementById('reqPhotoUrl').value = "";
    document.getElementById('reqPhotoPlaceholder').classList.remove('hidden');
    document.getElementById('reqPhotoPreviewContainer').classList.add('hidden');
}

async function convertRequest(id) {
    const { data: req } = await supabaseClient.from('anmodninger').select('*').eq('id', id).single();
    if (!req) return;

    openModal('modal-task');
    
    setTimeout(() => {
        document.getElementById('taskTitle').value = req.titel;
        document.getElementById('taskDesc').value = req.beskrivelse;
        document.getElementById('taskPriority').value = req.prioritet;
        document.getElementById('taskLocation').value = req.lokation_id || "";
        
        // Overfør alle tags (kategorier)
        if (req.kategori_ids && req.kategori_ids.length > 0) {
            req.kategori_ids.forEach(cid => {
                const c = allCategories.find(cat => cat.id === cid);
                if (c) addTag(c.id, c.navn, 'task');
            });
        }
        
        if (req.asset_id) document.getElementById('taskAsset').value = req.asset_id;

        if (req.billed_url) {
            document.getElementById('taskPhotoUrl').value = req.billed_url;
            document.getElementById('taskPhotoPreview').src = req.billed_url;
            document.getElementById('photoPlaceholder').classList.add('hidden');
            document.getElementById('photoPreviewContainer').classList.remove('hidden');
        }
    }, 300);
}

// SOP BUILDER LOGIC
function startNewSopFlow() { openSopEditor(null); }
async function openSopEditor(id = null) {
    currentSopId = id; sopSteps = []; currentStepId = null; openModal('modal-sop');
    if (id) {
        const { data } = await supabaseClient.from('procedurer').select('*').eq('id', id).maybeSingle();
        if (data) { document.getElementById('sopTitle').value = data.titel; document.getElementById('sopDesc').value = data.beskrivelse; sopSteps = data.trin || []; if (sopSteps.length > 0) currentStepId = sopSteps[0].id; }
    } else { 
        document.getElementById('sopTitle').value = ""; document.getElementById('sopDesc').value = ""; 
        addSopStep('section', "Indledende sektion"); 
    }
    renderSopEditor();
}
function renderSopEditor() {
    const navList = document.getElementById('sopStepNavList'); if (!navList) return; navList.innerHTML = '';
    sopSteps.forEach((step, index) => {
        const div = document.createElement('div'); div.className = `step-nav-card ${step.id == currentStepId ? 'active' : ''}`;
        div.onclick = () => { currentStepId = step.id; renderSopEditor(); };
        div.innerHTML = `<div class="step-num">${index + 1}</div><div style="flex:1; overflow:hidden;"><div style="font-weight:700;">${step.label || 'Uden navn'}</div></div>`;
        navList.appendChild(div);
    });
    renderActiveStep(); updateSopPreview();
}
function renderActiveStep() {
    const container = document.getElementById('activeStepEditorContainer'); if (!container) return;
    const step = sopSteps.find(s => s.id == currentStepId);
    if (!step) { container.innerHTML = '<h3>Vælg et trin</h3>'; return; }
    container.innerHTML = `<div class="active-step-config-card"><button class="btn-outline" style="color:var(--danger); margin-bottom:20px;" onclick="removeSopStep('${step.id}')">Slet dette trin</button><h3>Type: ${step.type}</h3><div class="input-group"><label>Label / Instruktion</label><input type="text" value="${step.label || ''}" oninput="updateStepData('${step.id}', 'label', this.value)"></div></div>`;
}
function updateStepData(id, key, val) { const idx = sopSteps.findIndex(s => s.id == id); if (idx !== -1) { sopSteps[idx][key] = val; updateSopPreview(); } }
function addSopStep(type, label = "") { 
    // SIKRER AT DASHBOARD ER KLAR
    if (!currentFirmaId) {
        showSnackbar("Venter på dashboard... Prøv igen om 2 sekunder.");
        return;
    }

    const id = 'step_' + Date.now(); 
    sopSteps.push({id, type, label: label || `Ny ${type}`}); 
    currentStepId = id; 
    hideFieldDrawer(); // FIX: Luk boksen efter valg
    renderSopEditor(); 
}
function removeSopStep(id) { sopSteps = sopSteps.filter(s => s.id != id); currentStepId = sopSteps.length > 0 ? sopSteps[0].id : null; renderSopEditor(); }
function showFieldDrawer() { document.getElementById('fieldTypeDrawer')?.classList.remove('hidden'); }
function hideFieldDrawer() { document.getElementById('fieldTypeDrawer')?.classList.add('hidden'); }
function updateSopPreview() {
    const preview = document.getElementById('sopFullPreviewContent'); if (!preview) return;
    let html = `<h1 style="font-size:32px; margin-bottom:10px;">${document.getElementById('sopTitle').value || 'Uden titel'}</h1><p class="text-muted" style="margin-bottom:30px;">${document.getElementById('sopDesc').value || ''}</p>`;
    sopSteps.forEach((step, i) => { html += `<div class="preview-step-card"><strong>Trin ${i+1}: ${step.label}</strong><br><small>Type: ${step.type}</small></div>`; });
    preview.innerHTML = html;
}
async function saveSop() {
    if (!currentFirmaId) { showSnackbar("Intet firma fundet!"); return; }
    const title = document.getElementById('sopTitle').value;
    if (!title) { showSnackbar("Giv venligst proceduren en titel."); return; }
    
    const d = { 
        firma_id: currentFirmaId, 
        titel: title, 
        beskrivelse: document.getElementById('sopDesc').value, 
        trin: sopSteps 
    };
    if (currentSopId) d.id = currentSopId;
    
    // Brug upsert med onConflict: ['titel', 'firma_id']
    const { error } = await supabaseClient.from('procedurer').upsert(d, { onConflict: 'titel, firma_id' });
    if (!error) { 
        showSnackbar("Procedure gemt!"); 
        closeAllModals(); 
        fetchProcedures(); 
    } else {
        console.error("SOP save error:", error);
        showSnackbar("Fejl ved gem: " + error.message);
    }
}

async function fetchProcedures() {
    const list = document.getElementById('sopTemplateList'); if (!list) return;
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('procedurer').select('*').eq('firma_id', currentFirmaId).order('titel');
    list.innerHTML = (!data || data.length === 0) ? '<div style="padding:40px; text-align:center;" class="text-muted">Ingen procedurer fundet.</div>' : '';
    data?.forEach(sop => {
        const div = document.createElement('div'); div.className = 'sop-card-item'; div.id = `sop-item-${sop.id}`;
        div.onclick = () => selectSopFromLibrary(sop);
        div.innerHTML = `<div style="display:flex; align-items:center; gap:12px;"><div style="width:40px; height:40px; background:var(--glass); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px;">📄</div><div style="flex:1;"><div style="font-weight:700;">${sop.titel}</div><div style="font-size:12px; color:var(--text-muted);">${sop.trin?.length || 0} trin</div></div></div>`;
        list.appendChild(div);
    });
}

function toggleSopEditorPreview() {
    const p = document.getElementById('sopPreviewPane'), e = document.getElementById('sopEditorFields'), b = document.getElementById('btnSopPreviewToggle');
    if (p.classList.contains('hidden')) { p.classList.remove('hidden'); e.classList.add('hidden'); b.innerText = "✍️ Back to Editor"; }
    else { p.classList.add('hidden'); e.classList.remove('hidden'); b.innerText = "👁️ Full Preview"; }
}

function autoFillAssetLocation() {
    const pId = document.getElementById('assetParent').value;
    if (pId) { const parent = allAssets.find(a => a.id == pId); if (parent) document.getElementById('assetLoc').value = parent.lokation_id || ''; }
}

async function sendAppLinkEmail() {
    const email = document.getElementById('share-email').value;
    if (!email) { showSnackbar("Indtast e-mail"); return; }
    showSnackbar("Sendt! (Simuleret)");
}

function copyAppLink() {
    navigator.clipboard.writeText("https://asze93.github.io/easyon/easyon-app.apk");
    showSnackbar("Link kopieret!");
}

async function fetchKpiSettings() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('kpi_konfiguration').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) {
        document.getElementById('kpi_svartid').checked = data.kpi_svartid || false;
        document.getElementById('kpi_materiale').checked = data.kpi_materiale || false;
        document.getElementById('kpi_maskin').checked = data.kpi_maskin || false;
        document.getElementById('kpi_fordeling').checked = data.kpi_fordeling || false;
    }
}

async function saveKpiSettings() {
    const s = document.getElementById('kpi_svartid').checked, m = document.getElementById('kpi_materiale').checked, mk = document.getElementById('kpi_maskin').checked, f = document.getElementById('kpi_fordeling').checked;
    const { error } = await supabaseClient.from('kpi_konfiguration').upsert({ firma_id: currentFirmaId, kpi_svartid: s, kpi_materiale: m, kpi_maskin: mk, kpi_fordeling: f }, { onConflict: 'firma_id' });
    if (!error) showSnackbar("KPI indstillinger gemt!");
    else showSnackbar("Kunne ikke gemme: " + error.message);
}
