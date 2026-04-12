let supabaseClient;
let currentUser = null;
let currentView = 'landing';
let currentFirmaSettings = {};
let isGlobalAdmin = false;
let kraeverAnmodningReview = true;
let authMode = 'login'; 
let currentFirmaId = null;
let allCompanies = [];
let allLocations = [];
let allAssets = [];
let sopSteps = []; // Trin i SOP Builder
let currentFirma = null;

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
        btn.innerText = originalText || btn.dataset.originalText || 'Forts├ªt';
        btn.disabled = false;
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    if (viewId === 'dashboard') {
        document.body.classList.add('dashboard-mode');
        fetchProcedures();
    } else {
        document.body.classList.remove('dashboard-mode');
        updateNavbar(); // S├©rg for at menubaren opdateres n├Ñr vi viser forsiden
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
    // USE ACTUAL CONFIG.JS CONSTANTS
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
            await loadDashboard();
        } else {
            const savedProfile = localStorage.getItem('easyon_session_profile');
            if (savedProfile) {
                 await loadDashboard(JSON.parse(savedProfile));
            } else {
                 const activeView = document.querySelector('.view.active')?.id;
                 if (activeView !== 'view-auth' && activeView !== 'view-verify-email') {
                     showView('landing');
                 }
            }
        }
    });
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

async function checkSession() {
    // Fjernet loadDashboard herfra for at undgå 'Lock Stole' fejl (v51 fix)
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateNavbar();
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
        authEmail.placeholder = 'navn@firma.dk'; authBtn.innerText = 'N├ªste: Firma info';
        toggleText.innerText = 'Har du allerede en konto?'; toggleLink.innerText = 'Log ind her';
        if (passConfirmGroup) passConfirmGroup.classList.remove('hidden');
        if (nameGroup) nameGroup.classList.remove('hidden');
        if (firmaGroup) firmaGroup.classList.add('hidden');
    } else {
        authTitle.innerText = 'Log ind p├Ñ EasyON'; authEmailLabel.innerText = 'Login-ID (ID eller E-mail)';
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
            if (pass.length < 6) throw new Error("Adgangskoden skal v├ªre mindst 6 tegn lang.");
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
            
            // 1. Pr├©v Email-login direkte hvis der er et @
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
                    localStorage.setItem('easyon_firma_id', profile.firma_id);
                    localStorage.setItem('easyon_user_role', profile.rolle?.toLowerCase() || "");
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
        
        if (!bizName) { showSnackbar("Firmanavn er p├Ñkr├ªvet."); return; }
        
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
            btn.innerText = "Pr├©v igen"; btn.disabled = false;
            document.getElementById('step2').classList.add('hidden'); 
            document.getElementById('step1').classList.remove('hidden'); 
            if (ind2) ind2.classList.remove('active');
            if (ind1) ind1.classList.add('active');
        }
    }
}

// ---------------- DASHBOARD & DATA ----------------
async function loadDashboard(providedProfile = null) {
    let profile = providedProfile;
    // UUID-parring er 100% mere stabilt end email-parring (v51 Diamond Fix)
    if (!profile && currentUser?.id) {
        for (let i = 0; i < 3; i++) {
            try {
                const { data, error } = await supabaseClient.from('brugere').select('*, firmaer(navn)').eq('id', currentUser.id).maybeSingle();
                if (data) { profile = data; break; }
                if (error) console.error("Database error fetching profile:", error);
            } catch (exc) { console.warn("Retrying profile fetch...", exc); }
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

    if (currentFirmaId) {
        showView('dashboard');
        // UI Visibility Toggles
        document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isGlobalAdmin));
        
        // Initial fetches
        fetchStats(); fetchTasks(); fetchRequests(); fetchTeam(); 
        
        // Ensure procedures are loaded if the user is already on that tab
        const procTab = document.getElementById('dash-procedures');
        if (procTab && procTab.classList.contains('active')) {
            fetchProcedures();
        }
    } else {
        // If we are already in wizard or verify-email, don't force landing
        const activeView = document.querySelector('.view.active')?.id;
        if (activeView !== 'view-wizard' && activeView !== 'view-verify-email' && activeView !== 'view-auth') {
            showView('landing');
        }
    }
}

function dashTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav').forEach(n => n.classList.remove('active'));
    const t = document.getElementById('dash-' + tabId); if (t) t.classList.add('active');
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
    const adminTabs = ['team', 'indstillinger', 'categories', 'locations', 'assets', 'lager', 'kpi'];
    const superUserTabs = ['tasks', 'requests', 'statistics', 'overview'];
    
    if (adminTabs.includes(tabId) && !isGlobalAdmin) { 
        showSnackbar("Ingen adgang - kun for Administratorer."); 
        return; 
    }
    
    // Luk sidebar p├Ñ mobil
    toggleSidebar(false);

    if (tabId === 'lager') fetchLager();
    if (tabId === 'kpi') fetchKpiSettings();
    if (tabId === 'statistics' || tabId === 'overview') loadDashboardStats();
    if (tabId === 'assets') fetchAssets();
    if (tabId === 'locations') fetchLocations();
    if (tabId === 'categories') fetchCategories();
    if (tabId === 'procedures') fetchProcedures(); // Opdateret til procedurer biblioteket
    dashTab(tabId);
}
let currentStepId = null; 

async function fetchProcedures() {
    const list = document.getElementById('sopTemplateList');
    if (!list) return;
    
    if (!currentFirmaId) {
        list.innerHTML = '<div style="padding:40px; text-align:center;" class="text-muted"><div class="spinner"></div><br>Henter din profil...</div>';
        // Pr├©v igen om 2 sekunder hvis vi stadig ikke har et ID
        setTimeout(fetchProcedures, 2000);
        return;
    }

    const { data, error } = await supabaseClient.from('procedurer').select('*').eq('firma_id', currentFirmaId).order('titel');
    
    if (error || !data || data.length === 0) {
        list.innerHTML = '<div style="padding:40px; text-align:center;" class="text-muted">Ingen procedurer fundet. Opret din f├©rste skabelon ovenfor.</div>';
        return;
    }

    list.innerHTML = '';
    data.forEach(sop => {
        const div = document.createElement('div');
        div.className = 'sop-card-item';
        div.id = `sop-item-${sop.id}`;
        div.onclick = () => selectSopFromLibrary(sop);
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; background:var(--glass); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px;">­ƒôä</div>
                <div style="flex:1;">
                    <div style="font-weight:700;">${sop.titel}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${sop.trin?.length || 0} trin</div>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

function selectSopFromLibrary(sop) {
    document.querySelectorAll('.sop-card-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`sop-item-${sop.id}`)?.classList.add('active');
    
    const preview = document.getElementById('sopLibraryPreview');
    if (!preview) return;
    preview.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; padding:40px;">
            <div>
                <h2 style="font-size:32px; font-weight:800; margin-bottom:8px;">${sop.titel}</h2>
                <p class="text-muted">${sop.beskrivelse || 'Ingen beskrivelse.'}</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-outline" onclick="openSopEditor('${sop.id}')">Rediger Skabelon</button>
                <button class="btn-outline" style="color:var(--danger); border-color:transparent;" onclick="deleteSop('${sop.id}')">Slet</button>
            </div>
        </div>
        <hr style="border:0; border-top:1px solid var(--border); margin:0 40px 30px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; padding:0 40px;">
            <div style="background:#F8FAFC; padding:24px; border-radius:20px; border:1px solid var(--border);">
                <h4 style="margin-bottom:15px; color:var(--primary); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Oversigt</h4>
                <div class="text-muted" style="font-size:14px; line-height:2;">
                    <div>ÔÇó ${sop.trin?.length || 0} kontrolpunkter</div>
                    <div>ÔÇó Tilknyttet: ${sop.asset_id ? 'Specifik maskine' : 'Alle maskiner'}</div>
                </div>
            </div>
            <div style="background:#F8FAFC; padding:24px; border-radius:20px; border:1px solid var(--border);">
                <h4 style="margin-bottom:15px; color:var(--primary); font-size:12px; text-transform:uppercase; letter-spacing:1px;">Egenskaber</h4>
                <div class="text-muted" style="font-size:14px; line-height:2;">
                    <div>ÔÇó Kategori: ${sop.kategori || 'Standard'}</div>
                    ${sop.trin?.some(t => t.type === 'photo') ? '<div>ÔÇó Kr├ªver billed-dok.</div>' : ''}
                </div>
            </div>
        </div>
    `;
}

function startNewSopFlow() {
    openSopEditor(null);
}

async function openSopEditor(id = null) {
    currentSopId = id;
    sopSteps = [];
    currentStepId = null;
    
    openModal('modal-sop');
    const titleEl = document.getElementById('sopTitle');
    const descEl = document.getElementById('sopDesc');
    
    if (id) {
        const { data, error } = await supabaseClient.from('procedurer').select('*').eq('id', id).maybeSingle();
        if (data) {
            titleEl.value = data.titel || "";
            descEl.value = data.beskrivelse || "";
            sopSteps = data.trin || [];
            if (sopSteps.length > 0) currentStepId = sopSteps[0].id;
        }
    } else {
        titleEl.value = "";
        descEl.value = "";
        // Auto-add first section for new SOP
        addSopStep('section', "Indledende sektion");
    }
    
    renderSopEditor();
}

function selectSopStep(id) {
    currentStepId = id;
    renderSopEditor();
}

function renderSopEditor() {
    const navList = document.getElementById('sopStepNavList');
    if (!navList) return;
    const scrollPos = navList.scrollTop;
    
    navList.innerHTML = '';
    sopSteps.forEach((step, index) => {
        const isActive = step.id == currentStepId;
        const div = document.createElement('div');
        div.className = `step-nav-card ${isActive ? 'active' : ''}`;
        div.onclick = () => selectSopStep(step.id);
        
        let icon = '­ƒôï';
        if (step.type === 'checkbox') icon = 'Ôÿæ´©Å';
        if (step.type === 'photo') icon = '­ƒô©';
        if (step.type === 'heading') icon = 'Tt';
        if (step.type === 'section') icon = '­ƒì▒';
        if (step.type === 'inspection') icon = '­ƒöì';
        if (step.type === 'number') icon = '­ƒöó';
        if (step.type === 'choice') icon = '­ƒöÿ';
        
        div.innerHTML = `
            <div class="step-num">${index + 1}</div>
            <div style="flex:1; overflow:hidden;">
                <div style="font-size:10px; opacity:0.6; text-transform:uppercase; font-weight:800; margin-bottom:2px;">${step.type}</div>
                <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${step.label || 'Uden navn'}</div>
            </div>
            <div style="font-size:12px; opacity:0.5;">${icon}</div>
        `;
        navList.appendChild(div);
    });
    navList.scrollTop = scrollPos;

    renderActiveStep();
    updateSopPreview();
    
    // Show Toolbar
    document.getElementById('sopToolbar')?.classList.remove('hidden');
}

function renderActiveStep() {
    const container = document.getElementById('activeStepEditorContainer');
    if (!container) return;
    
    const step = sopSteps.find(s => s.id == currentStepId);
    if (!step) {
        container.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:100px 40px;">
                <div style="font-size:48px; margin-bottom:20px;">ÔÜí</div>
                <h3>Klar til at bygge</h3>
                <p>Klik p├Ñ "+ Add Field" eller v├ªlg et eksisterende trin for at konfigurere.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="active-step-config-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:40px;">
                <span class="badge" style="background:#F1F5F9; color:var(--text-muted); padding:6px 12px; border-radius:8px; font-size:11px; font-weight:800; text-transform:uppercase;">${step.type} Konfiguration</span>
                <button class="btn-outline" style="border:none; color:var(--danger); padding:0; font-weight:700;" onclick="removeSopStep('${step.id}')">SLET TRIN</button>
            </div>

            <div class="input-group">
                <label style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px; display:block;">Instruktion / Sp├©rgsm├Ñl</label>
                <input type="text" value="${step.label || ''}" placeholder="f.eks. Er maskinen smurt?" 
                       style="width:100%; font-size:20px; font-weight:700; border:none; border-bottom:2px solid #F1F5F9; padding:12px 0; outline:none;" 
                       oninput="updateStepData('${step.id}', 'label', this.value)">
            </div>

            <div id="stepSpecificFields" style="margin-top:32px; padding-top:32px; border-top:1px solid #F1F5F9;">
                ${renderTypeFields(step)}
            </div>

            ${step.type !== 'heading' && step.type !== 'section' ? `
                <div style="margin-top:30px; padding-top:20px; border-top:1px solid #F1F5F9;">
                    <label style="display:flex; align-items:center; gap:12px; cursor:pointer; font-weight:700; font-size:14px;">
                        <input type="checkbox" ${step.required ? 'checked' : ''} onchange="updateStepData('${step.id}', 'required', this.checked)" style="width:18px; height:18px;">
                        Dette kontrolpunkt er p├Ñkr├ªvet
                    </label>
                </div>
            ` : ''}
        </div>
    `;
}

function renderTypeFields(step) {
    if (step.type === 'section') return `<p class="text-muted">Denne sektion fungerer som en overskrift i din procedure.</p>`;
    if (step.type === 'choice') {
        return `
            <label style="font-size:12px; font-weight:800; display:block; margin-bottom:12px; color:var(--text-muted);">MULIGHEDER (KOMMA-SEPARERET)</label>
            <input type="text" value="${step.options?.join(', ') || ''}" placeholder="Ja, Nej, Ved ikke"
                   style="width:100%; padding:14px; border-radius:12px; border:1px solid var(--border);"
                   oninput="updateStepData('${step.id}', 'options', this.value.split(',').map(s=>s.trim()))">
        `;
    }
    if (step.type === 'number') {
        return `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div class="input-group">
                    <label style="font-size:11px; font-weight:800; color:var(--text-muted);">MIN V├åRDI</label>
                    <input type="number" value="${step.min || ''}" oninput="updateStepData('${step.id}', 'min', this.value)" style="border-radius:10px;">
                </div>
                <div class="input-group">
                    <label style="font-size:11px; font-weight:800; color:var(--text-muted);">MAX V├åRDI</label>
                    <input type="number" value="${step.max || ''}" oninput="updateStepData('${step.id}', 'max', this.value)" style="border-radius:10px;">
                </div>
            </div>
        `;
    }
    return `<p class="text-muted">Standard ${step.type} felt er valgt for dette kontrolpunkt.</p>`;
}

function updateStepData(id, key, val) {
    const idx = sopSteps.findIndex(s => s.id == id);
    if (idx !== -1) {
        sopSteps[idx][key] = val;
        updateSopPreview();
        if (key === 'label') {
            const navLabel = document.querySelector(`.step-nav-card.active div[style*="font-weight:700"]`);
            if (navLabel) navLabel.innerText = val || 'Uden navn';
        }
    }
}

function addSopStep(type, label = "") {
    const id = 'step_' + Date.now();
    const newStep = {
        id: id,
        type: type,
        label: label || `Ny ${type}`,
        required: false,
        options: type === 'choice' ? ['Ja', 'Nej'] : [],
        min: null,
        max: null
    };
    sopSteps.push(newStep);
    currentStepId = id;
    hideFieldDrawer();
    renderSopEditor();
}

function removeSopStep(id) {
    sopSteps = sopSteps.filter(s => s.id != id);
    if (currentStepId == id) currentStepId = sopSteps.length > 0 ? sopSteps[0].id : null;
    renderSopEditor();
}

function showFieldDrawer() {
    document.getElementById('fieldTypeDrawer')?.classList.remove('hidden');
}

function hideFieldDrawer() {
    document.getElementById('fieldTypeDrawer')?.classList.add('hidden');
}

function updateSopPreview() {
    const preview = document.getElementById('sopFullPreviewContent');
    if (!preview) return;
    
    const title = document.getElementById('sopTitle').value || 'Procedure Navn';
    const desc = document.getElementById('sopDesc').value || '';
    
    let html = `
        <div style="background:white; border-radius:24px; padding:60px; border:1px solid var(--border); box-shadow:var(--shadow-lg);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; border-bottom:2px solid var(--border); padding-bottom:30px;">
                <div style="flex:1;">
                    <h1 style="font-size:38px; font-weight:800; color:var(--text-main); margin-bottom:10px;">${title}</h1>
                    <p style="font-size:18px; color:var(--text-muted); max-width:600px;">${desc}</p>
                </div>
                <div style="background:var(--primary); width:60px; height:60px; border-radius:15px; display:flex; align-items:center; justify-content:center; color:white; font-size:30px; opacity:0.8;">­ƒª¥</div>
            </div>
    `;
    
    sopSteps.forEach((step, index) => {
        const label = step.label || '(Uden titel)';
        const requiredMark = step.required ? '<span style="color:var(--danger); margin-left:4px;">*</span>' : '';
        
        if (step.type === 'section') {
            html += `<div style="margin: 60px 0 20px; border-bottom:3px solid var(--primary); padding-bottom:10px; font-weight:800; font-size:18px; text-transform:uppercase; color:var(--primary); letter-spacing:1px;">${label}</div>`;
        } else if (step.type === 'heading') {
            html += `<h2 style="margin: 40px 0 20px; font-weight:700; color:var(--text-main); font-size:24px;">${label}</h2>`;
        } else {
            html += `
                <div class="preview-step-card" style="display:flex; flex-direction:column; gap:15px; margin-bottom:24px; background:#FFFFFF; border:1px solid var(--border); border-radius:16px; padding:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label style="font-size:16px; font-weight:700; color:var(--text-main);">${index + 1}. ${label}${requiredMark}</label>
                        <span style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; background:var(--bg-main); padding:4px 10px; border-radius:6px; border:1px solid var(--border);">${step.type}</span>
                    </div>
                </div>
            `;
        }
    });

    html += `
            <div style="margin-top:60px; padding-top:30px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:12px; color:var(--text-muted); font-weight:600;">┬® 2026 EasyON Digital SOP Management</div>
                <div style="font-size:12px; color:var(--text-muted); font-weight:600;">Ref: ${currentSopId || 'NY-SKABELON'}</div>
            </div>
        </div>
    `;
    
    preview.innerHTML = html;
}

async function saveSop() {
    const title = document.getElementById('sopTitle').value;
    const desc = document.getElementById('sopDesc').value;
    
    if (!title) {
        showSnackbar("Giv venligst proceduren en titel.");
        return;
    }

    const sopData = {
        firma_id: currentFirmaId,
        titel: title,
        beskrivelse: desc,
        trin: sopSteps,
        created_at: new Date().toISOString()
    };

    try {
        let res;
        if (currentSopId) {
            delete sopData.created_at;
            res = await supabaseClient.from('procedurer').update(sopData).eq('id', currentSopId);
        } else {
            res = await supabaseClient.from('procedurer').insert(sopData);
        }

        if (res.error) throw res.error;
        showSnackbar("Procedure gemt i biblioteket! ­ƒª¥");
        closeAllModals();
        fetchProcedures();
    } catch (e) {
        showSnackbar("Fejl ved gemning: " + e.message);
    }
}

async function deleteSop(id) {
    if (!confirm("Er du sikker p├Ñ, at du vil slette denne skabelon permanent?")) return;
    const { error } = await supabaseClient.from('procedurer').delete().eq('id', id);
    if (!error) {
        showSnackbar("Procedure slettet.");
        document.getElementById('sopLibraryPreview').innerHTML = '<div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:var(--text-muted);"><i class="icon" style="font-size:48px; margin-bottom:20px;">­ƒôä</i><h3>Template Slettet.</h3></div>';
        fetchProcedures();
    }
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
    // Unify with loadDashboardStats to ensure consistency
    return loadDashboardStats();
}

async function fetchTeam() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('brugere').select('*').eq('firma_id', currentFirmaId);
        if (error) throw error;
        const b = document.getElementById('teamBody'); if (!b) return; b.innerHTML = "";
        data?.forEach(u => {
            b.innerHTML += `<tr><td>${u.navn}</td><td>${u.arbejdsnummer}</td><td>${u.rolle}</td><td><button class="btn-outline btn-sm" onclick="deleteTeamMember('${u.id}')">Slet</button></td></tr>`;
        });
    } catch (err) {
        console.warn("Team fetch failed:", err);
    }
}

async function fetchTasks() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('opgaver')
            .select('*')
            .eq('firma_id', currentFirmaId)
            .order('id', { ascending: false }); // Brug ID som sikker sortering
        
        if (error) throw error;
        
        const b = document.getElementById('tasksBody'); if (!b) return; b.innerHTML = "";
        data?.forEach(t => {
            const actionLabel = isSuperUser ? '├àbn' : 'Vis';
            const priorityLabel = (t.prioritet == 3) ? 'H├©j' : (t.prioritet == 2 ? 'Middel' : 'Lav');
            b.innerHTML += `<tr>
                <td>${t.titel}</td>
                <td>${t.asset_navn || '-'}</td>
                <td><span class="badge prio-${priorityLabel.toLowerCase()}">${priorityLabel}</span></td>
                <td>${t.kategori || '-'}</td>
                <td><button class="btn-outline btn-sm" onclick="editTask('${t.id}')">${actionLabel}</button></td>
            </tr>`;
        });
    } catch (err) {
        console.error("Fejl ved hentning af opgaver:", err);
    }
}

async function fetchRequests() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('anmodninger')
            .select('*')
            .eq('firma_id', currentFirmaId)
            .order('id', { ascending: false });
            
        if (error) throw error;
        
        const b = document.getElementById('requestsBody'); if (!b) return; b.innerHTML = "";
        data?.forEach(r => {
            b.innerHTML += `<tr><td>${r.titel}</td><td>${r.beskrivelse}</td><td><button class="btn-primary btn-sm" onclick="convertRequest('${r.id}')">Lav til Opgave</button></td></tr>`;
        });
    } catch (err) {
        console.error("Fejl ved hentning af anmodninger:", err);
    }
}

// ---------------- MODALS & CRUD ----------------
// ---------------- MODALS & HELPERS ----------------
async function openModal(id, reset = false) {
    const m = document.getElementById(id); if (!m) return;
    if (reset) {
        m.querySelectorAll('form').forEach(f => f.reset());
        m.querySelectorAll('input, textarea, select').forEach(i => i.disabled = false);
        const saveBtn = m.querySelector('button[type="submit"]');
        if (saveBtn) saveBtn.style.display = 'block';
    }
    
    // Auto-populate dropdowns based on modal type
    if (id === 'modal-task') {
        await populateAssignees('taskAssignee');
        // We'll also need assets for tasks if we want to link them
    }
    if (id === 'modal-request') {
        await populateAssets('reqAsset');
    }
    if (id === 'modal-asset') {
        await populateLocations('assetLoc');
    }

    m.classList.remove('hidden'); document.getElementById('modal-overlay').classList.remove('hidden');
}

async function populateAssignees(selectId) {
    const el = document.getElementById(selectId); if (!el) return;
    const { data } = await supabaseClient.from('brugere').select('id, navn').eq('firma_id', currentFirmaId);
    el.innerHTML = '<option value="">V├ªlg tekniker...</option>';
    data?.forEach(u => el.innerHTML += `<option value="${u.navn}">${u.navn}</option>`);
}

async function populateAssets(selectId) {
    const el = document.getElementById(selectId); if (!el) return;
    const { data } = await supabaseClient.from('assets').select('id, navn').eq('firma_id', currentFirmaId).order('navn');
    el.innerHTML = '<option value="">V├ªlg maskine...</option>';
    data?.forEach(a => el.innerHTML += `<option value="${a.id}">${a.navn}</option>`);
}

async function populateLocations(selectId) {
    const el = document.getElementById(selectId); if (!el) return;
    const { data } = await supabaseClient.from('lokationer').select('id, navn').eq('firma_id', currentFirmaId);
    el.innerHTML = '<option value="">V├ªlg lokation...</option>';
    data?.forEach(l => el.innerHTML += `<option value="${l.id}">${l.navn}</option>`);
}

function closeAllModals() {
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.getElementById('modal-overlay').classList.add('hidden');
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    const btn = e.submitter;
    setLoading(btn, true);
    const name = document.getElementById('teamName').value, nr = document.getElementById('teamNr').value, role = document.getElementById('teamRolle').value, pin = document.getElementById('teamPin').value;
    const { error } = await supabaseClient.from('brugere').insert({ firma_id: currentFirmaId, navn: name, arbejdsnummer: nr, rolle: role, adgangskode: pin });
    setLoading(btn, false);
    if (error) showSnackbar("Fejl ved oprettelse af medlem", error.code); else { showSnackbar("Medlem tilf├©jet!"); closeAllModals(); fetchTeam(); }
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
    const btn = e.submitter;
    if (!isSuperUser && document.getElementById('taskId').value) {
        showSnackbar("Du har ikke rettigheder til at ├ªndre denne opgave.");
        return;
    }
    
    setLoading(btn, true);
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const desc = document.getElementById('taskDesc').value;
    const status = document.getElementById('taskStatus').value;
    
    const taskData = {
        firma_id: currentFirmaId,
        titel: title,
        beskrivelse: desc,
        status: status,
        created_at: new Date().toISOString()
    };

    let result;
    if (id) {
        delete taskData.created_at; // Don't overwrite original timestamp on update
        result = await supabaseClient.from('opgaver').update(taskData).eq('id', id);
    } else {
        result = await supabaseClient.from('opgaver').insert(taskData);
    }
    
    setLoading(btn, false);
    if (result.error) showSnackbar("Fejl ved lagring", result.error.code);
    else { showSnackbar(id ? "Opgave opdateret!" : "Opgave oprettet!"); closeAllModals(); fetchTasks(); loadDashboardStats(); }
}

// ---------------- ASSETS & LOCATIONS ----------------
async function fetchAssets() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('assets')
            .select('*, lokationer(navn)')
            .eq('firma_id', currentFirmaId)
            .order('navn');
        
        if (error) throw error;
        allAssets = data || [];
        
        const parentSel = document.getElementById('assetParent');
        if (parentSel) {
            parentSel.innerHTML = '<option value="">- Ingen (Dette er hoved-aktivet) -</option>';
            allAssets.filter(a => !a.parent_id).forEach(a => {
                parentSel.innerHTML += `<option value="${a.id}">${a.navn}</option>`;
            });
        }

        const b = document.getElementById('assetsBody'); 
        if (!b) return; 
        b.innerHTML = "";
        
        if (allAssets.length === 0) {
            b.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--text-muted);">Ingen maskiner fundet.</td></tr>';
            return;
        }

        const parents = allAssets.filter(a => !a.parent_id);
        parents.forEach(p => {
            renderAssetRow(p, b, false);
            allAssets.filter(a => a.parent_id === p.id).forEach(c => renderAssetRow(c, b, true));
        });
    } catch (err) {
        console.error("Asset fetch error:", err);
    }
}

function renderAssetRow(a, container, isChild) {
    const locName = a.lokationer?.navn || 'Ingen lokation';
    container.innerHTML += `
    <tr style="${isChild ? 'background: rgba(255,255,255,0.02);' : ''}">
        <td style="font-weight: 600; padding-left: ${isChild ? '40px' : '24px'};">
            ${isChild ? '<span style="color:var(--text-muted); margin-right:8px;">Ôöò</span>' : ''} ${a.navn}
        </td>
        <td><i class="icon">­ƒôì</i> ${locName}</td>
        <td>
            <div style="display:flex; gap: 10px;">
                <button class="btn-outline btn-sm" onclick="editAsset('${a.id}')">Ô£Å´©Å</button>
                <button class="btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" onclick="deleteAsset('${a.id}')">­ƒùæ´©Å</button>
            </div>
        </td>
    </tr>`;
}

function autoFillAssetLocation() {
    const parentId = document.getElementById('assetParent').value;
    if (parentId) {
        const parent = allAssets.find(a => a.id === parentId);
        if (parent && parent.lokation_id) {
            document.getElementById('assetLoc').value = parent.lokation_id;
            // Valgfrit: Disable lokationsfeltet s├Ñ man ikke kan ├ªndre arven?
        }
    }
}

async function editAsset(id) {
    const { data, error } = await supabaseClient.from('assets').select('*').eq('id', id).maybeSingle();
    if (error || !data) return;
    
    document.getElementById('assetId').value = data.id;
    document.getElementById('assetName').value = data.navn;
    document.getElementById('assetParent').value = data.parent_id || "";
    document.getElementById('assetLoc').value = data.lokation_id || "";
    
    openModal('modal-asset');
}

async function deleteAsset(id) {
    if (!confirm("Vil du slette denne maskine?")) return;
    const { error } = await supabaseClient.from('assets').delete().eq('id', id);
    if (!error) fetchAssets();
}
async function fetchCategories() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('kategorier').select('*').eq('firma_id', currentFirmaId).order('navn');
        if (error) throw error;
        const b = document.getElementById('categoriesBody'); if (!b) return; b.innerHTML = "";
        data?.forEach(c => {
            b.innerHTML += `<tr>
                <td>${c.navn}</td>
                <td><span style="background:${c.farve}; width:20px; height:20px; display:inline-block; border-radius:50%; border:1px solid #ccc;"></span></td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td><button class="btn-outline btn-sm" onclick="deleteCategory('${c.id}')">Slet</button></td>
            </tr>`;
        });
    } catch (err) {
        console.warn("Categories fetch failed:", err);
    }
}

async function deleteCategory(id) {
    if (!confirm("Slet denne kategori?")) return;
    const { error } = await supabaseClient.from('kategorier').delete().eq('id', id);
    if (!error) fetchCategories();
}
async function fetchIndstillinger() {
    if (!currentFirmaId) return;
    const { data } = await supabaseClient.from('firma_indstillinger').select('*').eq('firma_id', currentFirmaId).maybeSingle();
    if (data) {
        document.getElementById('kraever_review').checked = data.kraever_anmodning_review;
        document.getElementById('set_lokationer').checked = data.aktiver_lokationer;
        document.getElementById('set_sop').checked = data.aktiver_sop;
        document.getElementById('set_billede').checked = data.krav_om_billede;
        document.getElementById('set_farve').value = data.app_tema_farve || '#3B82F6';
    }
}

async function saveIndstillinger() {
    const rev = document.getElementById('kraever_review').checked;
    const lok = document.getElementById('set_lokationer').checked;
    const sop = document.getElementById('set_sop').checked;
    const bill = document.getElementById('set_billede').checked;
    const col = document.getElementById('set_farve').value;

    const { error } = await supabaseClient.from('firma_indstillinger').upsert({ 
        firma_id: currentFirmaId, 
        kraever_anmodning_review: rev, 
        aktiver_lokationer: lok, 
        aktiver_sop: sop,
        krav_om_billede: bill,
        app_tema_farve: col.replace('#', '')
    }, { onConflict: 'firma_id' });

    if (error) {
        showSnackbar("Fejl ved gem: " + error.message);
    } else {
        showSnackbar("Indstillinger gemt!");
    }
}

function sendAppLinkEmail() {
    const email = document.getElementById('share-email').value.trim();
    if (!email) {
        showSnackbar("Indtast venligst en e-mail adresse");
        return;
    }
    
    const subject = encodeURIComponent("Velkommen til EasyON - Hent din medarbejder-app her");
    const body = encodeURIComponent(`Hej,\n\nVelkommen til dit nye EasyON vedligeholdelsessystem!\n\nFor at komme i gang, skal du hente og installere vores officielle Android-app via dette link:\n\nhttps://asze93.github.io/easyon/easyon-app.apk\n\nEfter installationen kan du logge ind med dit Firma-ID og Medarbejder-nummer.\n\nGod arbejdslyst!\nEasyON Teamet`);
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    showSnackbar("Mail-klient ├Ñbnet!");
}

function copyAppLink() {
    const link = "https://asze93.github.io/easyon/easyon-app.apk";
    navigator.clipboard.writeText(link).then(() => {
        showSnackbar("Link kopieret til udklipsholder!");
    }).catch(err => {
        showSnackbar("Kunne ikke kopiere link: " + err);
    });
}
async function fetchLager() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('lager').select('*').eq('firma_id', currentFirmaId).order('navn');
        if (error) throw error;
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
                    <button class="btn-outline btn-sm" onclick="editLager('${item.id}')">Ô£Å´©Å</button>
                    <button class="btn-outline btn-sm" onclick="deleteLager('${item.id}')">­ƒùæ´©Å</button>
                </td>
            </tr>`;
        });
    } catch (err) {
        console.warn("Lager fetch failed:", err);
    }
}

async function handleLagerSubmit(e) {
    if (e) e.preventDefault();
    const btn = e?.submitter;
    setLoading(btn, true);
    const id = document.getElementById('lagerId').value;
    const itemData = {
        navn: document.getElementById('lagerNavn').value,
        lokation_tekst: document.getElementById('lagerLokation').value,
        antal_paa_lager: parseInt(document.getElementById('lagerAntal').value),
        minimums_beholdning: parseInt(document.getElementById('lagerMin').value),
        stregkode_sscc: document.getElementById('lagerCode').value.trim() || null,
        firma_id: currentFirmaId
    };

    let result;
    if (id) {
        result = await supabaseClient.from('lager').update(itemData).eq('id', id);
    } else {
        result = await supabaseClient.from('lager').insert(itemData);
    }

    setLoading(btn, false);
    if (result.error) showSnackbar("Fejl ved lagring af vare", result.error.code);
    else {
        showSnackbar(id ? "Reservedel opdateret!" : "Reservedel tilf├©jet!");
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
    if (confirm("Er du sikker p├Ñ du vil slette denne lagervare?")) {
        await supabaseClient.from('lager').delete().eq('id', id);
        fetchLager();
    }
}

async function handleAssetSubmit(e) {
    e.preventDefault();
    const btn = e.submitter;
    setLoading(btn, true);
    try {
        const id = document.getElementById('assetId').value;
        const navn = document.getElementById('assetName').value;
        const lokId = document.getElementById('assetLoc').value;
        
        const assetData = {
            navn, 
            lokation_id: lokId || null, 
            parent_id: document.getElementById('assetParent').value || null,
            firma_id: currentFirmaId 
        };
        
        let result;
        if (id) {
            result = await supabaseClient.from('assets').update(assetData).eq('id', id);
        } else {
            result = await supabaseClient.from('assets').insert(assetData);
        }
        
        if (result.error) throw result.error;
        
        showSnackbar(id ? "Asset opdateret!" : "Asset oprettet!");
        closeAllModals();
        fetchAssets();
    } catch (err) {
        console.error("Fejl ved lagring af asset:", err);
        showSnackbar("Fejl ved lagring af asset", err.code);
    } finally {
        setLoading(btn, false);
    }
}

async function handleLocationSubmit(e) {
    if (e) e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    
    try {
        const nameEl = document.getElementById('locName');
        const descEl = document.getElementById('locDesc');
        if (!nameEl) throw new Error("Inputfeltet 'locName' ikke fundet");
        
        const name = nameEl.value;
        const desc = descEl ? descEl.value : "";
        
        console.log("Pr├©ver at gemme lokation:", { name, desc, firmaId: currentFirmaId });
        
        if (!currentFirmaId) throw new Error("Du er ikke logget ind p├Ñ et firma.");

        const { data, error } = await supabaseClient.from('lokationer').insert({ 
            navn: name, 
            beskrivelse: desc, 
            firma_id: currentFirmaId 
        }).select();
        
        if (error) throw error;
        
        showSnackbar("Lokation oprettet!");
        closeAllModals();
        fetchLocations();
    } catch (err) {
        console.error("Fejl ved oprettelse af lokation:", err);
        showSnackbar("Fejl: " + (err.message || "Kunne ikke gemme"), err.code);
    } finally {
        setLoading(btn, false);
    }
}

async function fetchLocations() {
    if (!currentFirmaId) return;
    try {
        const { data, error } = await supabaseClient.from('lokationer').select('*').eq('firma_id', currentFirmaId).order('navn');
        if (error) throw error;
        const b = document.getElementById('locationsBody'); if (!b) return; b.innerHTML = "";
        data?.forEach(l => {
            b.innerHTML += `<tr>
                <td>${l.navn}</td>
                <td>${l.beskrivelse || '-'}</td>
                <td><button class="btn-outline btn-sm" onclick="deleteLocation('${l.id}')">Slet</button></td>
            </tr>`;
        });
    } catch (err) {
        console.warn("Locations fetch failed:", err);
    }
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const btn = e.submitter;
    setLoading(btn, true);
    const name = document.getElementById('catName').value, col = document.getElementById('catColor').value;
    const { error } = await supabaseClient.from('kategorier').insert({ navn: name, farve: col, firma_id: currentFirmaId });
    setLoading(btn, false);
    if (error) showSnackbar("Fejl ved oprettelse af kategori", error.code); else { showSnackbar("Kategori oprettet!"); closeAllModals(); fetchCategories(); }
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    const btn = e.submitter;
    setLoading(btn, true);
    const title = document.getElementById('reqTitle').value, desc = document.getElementById('reqDesc').value, assetId = document.getElementById('reqAsset').value;
    const { error } = await supabaseClient.from('anmodninger').insert({ titel: title, beskrivelse: desc, asset_id: assetId || null, firma_id: currentFirmaId, status: 'Venter' });
    setLoading(btn, false);
    if (error) showSnackbar("Fejl ved afsendelse", error.code); else { showSnackbar("Anmodning sendt!"); closeAllModals(); fetchRequests(); }
}

async function convertRequest(id) {
    const { data: req } = await supabaseClient.from('anmodninger').select('*').eq('id', id).maybeSingle();
    if (!req) return;
    const { error } = await supabaseClient.from('opgaver').insert({ 
        titel: req.titel, 
        beskrivelse: req.beskrivelse, 
        firma_id: currentFirmaId, 
        status: 'Venter',
        created_at: new Date().toISOString()
    });
    if (!error) { 
        await supabaseClient.from('anmodninger').delete().eq('id', id); 
        showSnackbar("Konverteret!"); 
        fetchRequests(); fetchTasks(); loadDashboardStats(); 
    } else {
        showSnackbar("Fejl ved konvertering", error.code);
    }
}
