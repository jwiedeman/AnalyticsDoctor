const API_BASE_URL = 'https://3401-24-20-99-62.ngrok-free.app';
const ANALYTICS_KEYS = [
    'google_analytics',
    'google_tag_manager',
    'segment',
    'meta_pixel',
    'bing'
];

const STORAGE_KEY = 'analyticsColumns';
let selectedColumns = [...ANALYTICS_KEYS];
let lastResult = null;

function loadSelected() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (Array.isArray(stored)) {
            selectedColumns = ANALYTICS_KEYS.filter(k => stored.includes(k));
            if (selectedColumns.length === 0) {
                selectedColumns = [...ANALYTICS_KEYS];
            }
        }
    } catch (e) {
        selectedColumns = [...ANALYTICS_KEYS];
    }
}

function saveSelected() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns));
}

function formatName(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function renderFilter() {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.textContent = 'Select All';
    allBtn.addEventListener('click', () => {
        selectedColumns = [...ANALYTICS_KEYS];
        saveSelected();
        renderFilter();
        if (lastResult) renderResults(lastResult);
    });
    panel.appendChild(allBtn);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
        selectedColumns = [];
        saveSelected();
        renderFilter();
        if (lastResult) renderResults(lastResult);
    });
    panel.appendChild(clearBtn);

    ANALYTICS_KEYS.forEach(key => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = key;
        checkbox.checked = selectedColumns.includes(key);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!selectedColumns.includes(key)) selectedColumns.push(key);
            } else {
                selectedColumns = selectedColumns.filter(k => k !== key);
            }
            saveSelected();
            if (lastResult) renderResults(lastResult);
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + formatName(key)));
        panel.appendChild(label);
    });
}


function renderResults(data) {
    lastResult = data;
    const headerRow = document.getElementById('pages-header');
    const bodyEl = document.getElementById('pages-body');
    const summaryEl = document.getElementById('summary');

    headerRow.innerHTML = '';
    bodyEl.innerHTML = '';
    summaryEl.innerHTML = '';

    headerRow.appendChild(document.createElement('th')).textContent = 'URL';
    selectedColumns.forEach(key => {
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
            selectedColumns.forEach(key => {
                const td = document.createElement('td');
                const entry = analytics[key];
                if (entry) {
                    const ids = (entry.ids || []).join(', ') || 'unknown id';
                    td.className = 'analytics-cell';
                    td.innerHTML =
                        `<div class="method">${entry.method || 'native'}</div>` +
                        `<div class="ids">${ids}</div>`;
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

loadSelected();
renderFilter();

