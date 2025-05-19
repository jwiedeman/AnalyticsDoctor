document.getElementById('scan-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const domain = document.getElementById('domain').value;
    const resultEl = document.getElementById('result');
    resultEl.textContent = 'Scanning...';
    try {
        const response = await fetch('http://localhost:5000/scan', {
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
