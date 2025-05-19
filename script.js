const API_BASE_URL = 'https://3401-24-20-99-62.ngrok-free.app';
const ANALYTICS_KEYS = [
    'google_analytics',
    'google_tag_manager',
    'segment',
    'meta_pixel',
    'bing'
];

function formatName(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}


document.getElementById('scan-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const domain = document.getElementById('domain').value.trim();
    const statusEl = document.getElementById('status');
    const headerRow = document.getElementById('pages-header');
    const bodyEl = document.getElementById('pages-body');
    const summaryEl = document.getElementById('summary');

    statusEl.textContent = 'Scanning...';
    headerRow.innerHTML = '';
    bodyEl.innerHTML = '';
    summaryEl.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE_URL}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await response.json();

        headerRow.appendChild(document.createElement('th')).textContent = 'URL';
        ANALYTICS_KEYS.forEach(key => {
            const th = document.createElement('th');
            th.textContent = formatName(key);
            headerRow.appendChild(th);
        });

        if (data.page_results) {
            for (const [url, analytics] of Object.entries(data.page_results)) {
                const tr = document.createElement('tr');
                const urlCell = document.createElement('td');
                urlCell.textContent = url;
                tr.appendChild(urlCell);
                ANALYTICS_KEYS.forEach(key => {
                    const td = document.createElement('td');
                    td.textContent = analytics[key] ? '✔' : '';
                    tr.appendChild(td);
                });
                bodyEl.appendChild(tr);
            }
        }

        const summaryTitle = document.createElement('h2');
        summaryTitle.textContent = 'Summary';
        summaryEl.appendChild(summaryTitle);
        const ul = document.createElement('ul');
        if (data.found_analytics) {
            for (const [name, info] of Object.entries(data.found_analytics)) {
                const li = document.createElement('li');
                const ids = (info.ids || []).join(', ') || 'unknown id';
                const method = info.method ? ` via ${info.method}` : '';
                li.textContent = `${formatName(name)} detected${method} (${ids})`;
                ul.appendChild(li);
            }
        }
        summaryEl.appendChild(ul);

        statusEl.textContent = 'Scan complete';
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.toString();
    }
});
