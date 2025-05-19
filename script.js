// Change this to your backend's public URL when deploying, e.g. the ngrok URL
const API_BASE_URL = 'https://3401-24-20-99-62.ngrok-free.app';

document.getElementById('scan-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const domain = document.getElementById('domain').value;
    const resultEl = document.getElementById('result');
    resultEl.textContent = 'Scanning...';
    try {
        const response = await fetch(`${API_BASE_URL}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await response.json();
        resultEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        resultEl.textContent = 'Error: ' + err.toString();
    }
});
