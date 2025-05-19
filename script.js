const API_BASE_URL = 'https://3401-24-20-99-62.ngrok-free.app';


document.getElementById('scan-form').addEventListener('submit', async (event) => {

    event.preventDefault();
    const domain = document.getElementById('domain').value.trim();
    const resultEl = document.getElementById('result');
    const statusEl = document.getElementById('status');
    const pagesEl = document.getElementById('pages');
    statusEl.textContent = 'Scanning...';
    resultEl.textContent = '';
    pagesEl.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await response.json();

        if (data.page_results) {
            for (const [url, analytics] of Object.entries(data.page_results)) {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = url;
                const pre = document.createElement('pre');
                pre.textContent = JSON.stringify(analytics, null, 2);
                details.appendChild(summary);
                details.appendChild(pre);
                pagesEl.appendChild(details);
            }
        }

        resultEl.textContent = JSON.stringify({
            working_variants: data.working_variants,
            scanned_urls: data.scanned_urls,
            found_analytics: data.found_analytics
        }, null, 2);
        statusEl.textContent = 'Scan complete';
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.toString();
    }

});
