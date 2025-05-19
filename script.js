const API_BASE_URL = 'https://3401-24-20-99-62.ngrok-free.app';

document.getElementById('scan-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const domain = document.getElementById('domain').value.trim();
    const resultEl = document.getElementById('result');
    resultEl.textContent = '';

    const es = new EventSource(`${API_BASE_URL}/scan-stream?domain=${encodeURIComponent(domain)}`);
    es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.done) {
            es.close();
            resultEl.textContent += 'Scan complete\n';
            resultEl.textContent += JSON.stringify(data.result, null, 2);
        } else {
            resultEl.textContent += `Scanned: ${data.url}\n`;
        }
    };
    es.onerror = () => {
        resultEl.textContent += 'Error connecting to server.\n';
        es.close();
    };
});
