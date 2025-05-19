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


function renderResults(data) {
    const headerRow = document.getElementById('pages-header');
    const bodyEl = document.getElementById('pages-body');
    const summaryEl = document.getElementById('summary');

    headerRow.innerHTML = '';
    bodyEl.innerHTML = '';
    summaryEl.innerHTML = '';

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
                const entry = analytics[key];
                if (entry) {
                    const ids = (entry.ids || []).join(', ') || 'unknown id';
                    td.innerHTML = `<div>${entry.method || 'native'}</div><div>${ids}</div>`;
                } else {
                    td.textContent = '';
                }
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
}

document.getElementById('scan-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const domain = document.getElementById('domain').value.trim();
    const maxPages = parseInt(document.getElementById('max-pages').value, 10) || 50;
    const statusEl = document.getElementById('status');

    statusEl.textContent = 'Scanning...';
    document.getElementById('pages-header').innerHTML = '';
    document.getElementById('pages-body').innerHTML = '';
    document.getElementById('summary').innerHTML = '';

    const es = new EventSource(`${API_BASE_URL}/scan-stream?domain=${encodeURIComponent(domain)}&maxPages=${maxPages}`);
    es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.done) {
            es.close();
            renderResults(data.result);
            statusEl.textContent = 'Scan complete';
        } else {
            statusEl.textContent = `Scanned ${data.scanned}: ${data.url}`;
        }
    };
    es.onerror = () => {
        statusEl.textContent = 'Error connecting to server.';
        es.close();
    };
});
