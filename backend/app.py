from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re

app = Flask(__name__)
CORS(app, resources={r"/scan": {"origins": "*"}}, supports_credentials=True)



MAX_PAGES = 500

# Patterns for detecting popular analytics libraries.  Each entry contains
# patterns to look for in script sources as well as regular expressions to
# capture any analytics identifiers that appear in the HTML.
ANALYTICS_PATTERNS = {
    'google_analytics': {
        'src': ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js'],
        'id_regex': [r'G-[A-Z0-9]+', r'UA-\d+-\d+']
    },
    'google_tag_manager': {
        'src': ['googletagmanager.com/gtm.js'],
        'id_regex': [r'GTM-[A-Z0-9]+']
    },
    'segment': {
        'src': ['segment.com/analytics.js', 'cdn.segment.com'],
        'id_regex': [r"analytics\s*\.load\(['\"]([A-Za-z0-9]+)['\"]\)"]
    },
    'meta_pixel': {
        'src': ['connect.facebook.net'],
        'id_regex': [r"fbq\(['\"]init['\"],\s*['\"](\d+)['\"]\)"]
    },
    'bing': {
        'src': ['bat.bing.com'],
        'id_regex': []
    }
}


def clean_domain(domain: str) -> str:
    domain = domain.strip()
    domain = domain.replace('http://', '').replace('https://', '')
    domain = domain.replace('www.', '')
    return domain


def fetch_url(url: str):
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.text
    except requests.RequestException:
        pass
    return None


def find_analytics_in_html(html: str):
    """Scan a single HTML document for analytics scripts and IDs."""
    soup = BeautifulSoup(html, 'html.parser')
    text = str(soup)

    detected = {}

    # First check script src attributes
    for script in soup.find_all('script', src=True):
        src = script['src']
        for name, patterns in ANALYTICS_PATTERNS.items():
            for p in patterns['src']:
                if p in src:
                    detected.setdefault(name, {'ids': set(), 'method': None})

    # Search for IDs within the HTML
    for name, patterns in ANALYTICS_PATTERNS.items():
        for regex in patterns['id_regex']:
            for match in re.findall(regex, text, re.IGNORECASE):
                detected.setdefault(name, {'ids': set(), 'method': None})
                detected[name]['ids'].add(match)

    # Determine GA4 method if GTM is present
    if 'google_analytics' in detected:
        if 'google_tag_manager' in detected:
            detected['google_analytics']['method'] = 'via gtm'
        else:
            detected['google_analytics']['method'] = 'native'

    # Convert id sets to lists
    for data in detected.values():
        data['ids'] = list(data['ids'])

    return detected


@app.route('/scan', methods=['POST'])
def scan_domain():
    data = request.get_json(force=True)
    domain = data.get('domain', '')
    domain = clean_domain(domain)

    variants = [
        f'http://{domain}',
        f'https://{domain}',
        f'http://www.{domain}',
        f'https://www.{domain}'
    ]

    scanned_urls = []
    working_variants = []
    found_analytics = {}
    visited = set()

    for base_url in variants:
        html = fetch_url(base_url)
        if not html:
            continue
        working_variants.append(base_url)
        visited.add(base_url)
        scanned_urls.append(base_url)

        page_results = find_analytics_in_html(html)
        for name, data in page_results.items():
            entry = found_analytics.setdefault(name, {'ids': set(), 'method': data.get('method')})
            entry['ids'].update(data.get('ids', []))
            if not entry.get('method') and data.get('method'):
                entry['method'] = data['method']

        soup = BeautifulSoup(html, 'html.parser')
        links = [urljoin(base_url, a['href']) for a in soup.find_all('a', href=True)]
        queue = []
        for link in links:
            if len(queue) + len(visited) >= MAX_PAGES:
                break
            if urlparse(link).netloc == urlparse(base_url).netloc:
                queue.append(link)
        while queue and len(scanned_urls) < MAX_PAGES:
            url = queue.pop(0)
            if url in visited:
                continue
            html = fetch_url(url)
            if not html:
                continue
            visited.add(url)
            scanned_urls.append(url)

            page_results = find_analytics_in_html(html)
            for name, data in page_results.items():
                entry = found_analytics.setdefault(name, {'ids': set(), 'method': data.get('method')})
                entry['ids'].update(data.get('ids', []))
                if not entry.get('method') and data.get('method'):
                    entry['method'] = data['method']

            soup = BeautifulSoup(html, 'html.parser')
            for a in soup.find_all('a', href=True):
                link = urljoin(url, a['href'])
                if urlparse(link).netloc == urlparse(base_url).netloc and link not in visited:
                    queue.append(link)
            if len(scanned_urls) >= MAX_PAGES:
                break
        # do not break here so we test all domain variants

    # convert id sets to lists for JSON serialisation
    for data in found_analytics.values():
        data['ids'] = list(data['ids'])

    return jsonify({
        'working_variants': working_variants,
        'scanned_urls': scanned_urls,
        'found_analytics': found_analytics
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)
