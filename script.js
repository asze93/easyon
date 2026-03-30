const card = document.getElementById('easyon-card');

document.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 768) return;
    const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
    const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
    card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
});

document.addEventListener('mouseleave', () => {
    card.style.transform = `rotateY(0deg) rotateX(0deg)`;
    card.style.transition = `transform 0.5s ease`;
});

document.addEventListener('mouseenter', () => {
    card.style.transition = `transform 0.1s`;
});

const downloadBtn = document.getElementById('downloadBtn');
downloadBtn.addEventListener('click', () => {
    const span = downloadBtn.querySelector('span');
    if (span) {
        const originalText = span.innerText;
        span.innerText = 'Downloader APK... 🚀';
        setTimeout(() => {
            span.innerText = originalText;
        }, 4000);
    }
});
