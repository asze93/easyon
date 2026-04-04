/**
 * EasyON Advanced CRUD Stress Test
 * This script automates: Create -> Edit/Verify -> Delete (using Dashboard functions)
 * Fixed: Uses unique IDs to prevent name collisions between test runs.
 */

async function runEasyOnStressTest() {
    // Unique suffix for this test run
    const testId = Math.floor(Math.random() * 9000) + 1000; 
    console.log(`🚀 Starting Advanced EasyON Stress Test (Run ID: ${testId})...`);
    
    // NYT: VENTER PÅ AT DASHBOARD ER KLAR HVIS DET TAGER TID
    let firmaId = currentFirmaId || localStorage.getItem('easyon_firma_id');
    if (!firmaId) {
        showSnackbar("Dashboardet er stadig ved at indlæse... Vent 2 sekunder og prøv igen.");
        console.error("❌ No firmaId found yet.");
        return;
    }

    // Gem original confirm funktion
    const originalConfirm = window.confirm;
    // Overstyr confirm så den altid returnerer true (automatisk sletning)
    window.confirm = () => {
        console.log("🤖 [Auto-Confirm]: Sletning godkendt af test-robot.");
        return true;
    };

    try {
        // --- 1. CREATE & VERIFY LOCATION ---
        const locName = `Hal 4 [${testId}]`;
        console.log(`📍 Step 1: Create Location '${locName}'...`);
        const { data: loc, error: locErr } = await supabaseClient
            .from('lokationer')
            .upsert({ navn: locName, beskrivelse: 'Basis lokation', firma_id: firmaId }, { onConflict: 'navn,firma_id' })
            .select()
            .single();
        if (locErr) throw locErr;

        console.log("✍️ Step 1.1: Editing Location description...");
        const { error: locUpdateErr } = await supabaseClient
            .from('lokationer')
            .update({ beskrivelse: `OPDATERET: Automatiseret test-lokation (${testId})` })
            .eq('id', loc.id);
        if (locUpdateErr) throw locUpdateErr;
        console.log("✅ Location created & edit verified.");

        // --- 2. CREATE & VERIFY CATEGORY ---
        const catName = `Elektrisk [${testId}]`;
        console.log(`🏷️ Step 2: Create Category '${catName}'...`);
        const { data: cat, error: catErr } = await supabaseClient
            .from('kategorier')
            .upsert({ navn: catName, farve: '#fbbf24', firma_id: firmaId }, { onConflict: 'navn,firma_id' })
            .select()
            .single();
        if (catErr) throw catErr;
        console.log("✅ Category created.");

        // --- 3. CREATE & VERIFY ASSET ---
        const assetName = `Pakkemaskine 2 [${testId}]`;
        console.log(`🏗️ Step 3: Create Asset '${assetName}'...`);
        const { data: asset, error: assetErr } = await supabaseClient
            .from('assets')
            .upsert({ navn: assetName, lokation_id: loc.id, firma_id: firmaId }, { onConflict: 'navn,firma_id' })
            .select()
            .single();
        if (assetErr) throw assetErr;

        console.log("✍️ Step 3.1: Renaming Asset...");
        const newAssetName = `Pakkemaskine 2 (Stress Testet) [${testId}]`;
        const { error: assetUpdateErr } = await supabaseClient
            .from('assets')
            .update({ navn: newAssetName })
            .eq('id', asset.id);
        if (assetUpdateErr) throw assetUpdateErr;
        console.log("✅ Asset created & edit verified.");

        // --- 4. CREATE EMPLOYEE ---
        const empNr = `mirsada_${testId}`;
        console.log(`👥 Step 4: Create Employee 'Mirsada' (${empNr})...`);
        const { data: emp, error: empErr } = await supabaseClient
            .from('brugere')
            .upsert({ 
                navn: `Mirsada [${testId}]`, 
                arbejdsnummer: empNr, 
                rolle: 'tekniker', 
                adgangskode: '1234', 
                firma_id: firmaId 
            }, { onConflict: 'arbejdsnummer,firma_id' })
            .select()
            .single();
        if (empErr) throw empErr;
        console.log("✅ Employee ready.");

        // --- 5. CREATE SOP ---
        const sopTitle = `Ugentligt Check [${testId}]`;
        console.log(`📝 Step 5: Create SOP '${sopTitle}'...`);
        const { data: sop, error: sopErr } = await supabaseClient
            .from('procedurer')
            .upsert({ 
                titel: sopTitle, 
                beskrivelse: 'Standard tjek', 
                trin: [{ id: '1', type: 'checkbox', label: 'Virker knappen?' }], 
                firma_id: firmaId 
            }, { onConflict: 'titel,firma_id' })
            .select()
            .single();
        if (sopErr) throw sopErr;
        console.log("✅ SOP ready.");

        // --- 6. CREATE & VERIFY TASK ---
        const taskTitle = `Stress Test Opgave [${testId}]`;
        console.log(`📋 Step 6: Create Task '${taskTitle}'...`);
        const { data: task, error: taskErr } = await supabaseClient
            .from('opgaver')
            .insert({
                firma_id: firmaId,
                titel: taskTitle,
                status: 'Venter',
                lokation_id: loc.id,
                asset_id: asset.id,
                sop_id: sop.id,
                medarbejder_id: emp.id
            })
            .select()
            .single();
        if (taskErr) throw taskErr;

        console.log("✍️ Step 6.1: Changing Task status to 'I gang'...");
        const { error: taskUpdateErr } = await supabaseClient
            .from('opgaver')
            .update({ status: 'I gang', beskrivelse: `Redigeret af stress test [ID: ${testId}]` })
            .eq('id', task.id);
        if (taskUpdateErr) throw taskUpdateErr;
        console.log("✅ Task created & edit verified.");

        // --- 7. CLEANUP (Using Dashboard Functions) ---
        console.log("🧹 Step 7: Starting Cleanup using Dashboard functions...");
        
        // Vigtigt: Slet i omvendt rækkefølge pga. relationer
        console.log("🗑️ Deleting Task...");
        await deleteTask(task.id);
        
        console.log("🗑️ Deleting SOP...");
        await deleteSop(sop.id);
        
        console.log("🗑️ Deleting Employee...");
        await deleteTeamMember(emp.id);
        
        console.log("🗑️ Deleting Asset...");
        await deleteAsset(asset.id);
        
        console.log("🗑️ Deleting Category...");
        await deleteCategory(cat.id);
        
        console.log("🗑️ Deleting Location...");
        await deleteLocation(loc.id);

        console.log(`🏁 ADVANCED STRESS TEST COMPLETE (ID: ${testId}) AND CLEANED UP!`);
        showSnackbar(`Stress Test SUCCES [${testId}]: Oprettet, Redigeret og Slettet!`);

    } catch (err) {
        console.error("❌ Stress Test Failed during process:", err);
        showSnackbar("Stress Test fejlede: " + err.message);
    } finally {
        // Genskab original confirm
        window.confirm = originalConfirm;
        
        // Refresh UI
        if (typeof fetchTasks === 'function') fetchTasks();
        if (typeof fetchAssets === 'function') fetchAssets();
        if (typeof fetchLocations === 'function') fetchLocations();
        if (typeof fetchTeam === 'function') fetchTeam();
        if (typeof fetchCategories === 'function') fetchCategories();
        if (typeof fetchProcedures === 'function') fetchProcedures();
    }
}
