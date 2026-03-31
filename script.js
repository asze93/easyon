function nextStep(step) {
    // Skjul alle steps
    document.querySelectorAll('.wizard-step').forEach(el => {
        el.classList.remove('active');
    });

    // Vis det valgte step
    const target = document.getElementById('step' + step);
    if (target) {
        target.classList.add('active');
    }

    // Scroll til toppen af wizard
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startCreation() {
    const companyName = document.getElementById('companyName').value || "Dit Firma";
    document.getElementById('displayCompanyName').innerText = companyName;

    nextStep(3);
    
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const loadingText = document.getElementById('loadingText');
    
    const messages = [
        "Opretter database...",
        "Konfigurerer moduler...",
        "Opsætter firma-id: " + companyName.toLowerCase().replace(/\s/g, '_'),
        "Gør APK klar til download...",
        "Næsten færdig..."
    ];

    const interval = setInterval(() => {
        progress += 2;
        progressFill.style.width = progress + '%';
        
        if (progress % 20 === 0) {
            const msgIndex = Math.floor(progress / 20);
            if (msgIndex < messages.length) {
                loadingText.innerText = messages[msgIndex];
            }
        }

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                nextStep(4);
                confetti(); // Simulerer succes hvis muligt (valgfrit)
            }, 500);
        }
    }, 50);
}

// En simpel konfetti-simulering (hvis man vil have det)
function confetti() {
    console.log("Hurra! Din app er klar.");
}
