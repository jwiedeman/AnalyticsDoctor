from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

app = Flask(__name__)
CORS(app, resources={r"/scan": {"origins": "*"}}, supports_credentials=True)



MAX_PAGES = 500

ANALYTICS_PATTERNS = {
    'google_analytics': ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js'],
    'google_tag_manager': ['googletagmanager.com/gtm.js'],
    'segment': ['segment.com/analytics.js', 'cdn.segment.com'],
    'meta_pixel': ['connect.facebook.net'],
    'bing': ['bat.bing.com']
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
    soup = BeautifulSoup(html, 'html.parser')
    results = set()
    for script in soup.find_all('script', src=True):
        src = script['src']
        for name, patterns in ANALYTICS_PATTERNS.items():
            for p in patterns:
                if p in src:
                    results.add(name)
    return list(results)


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
    found_analytics = set()

    for base_url in variants:
        html = fetch_url(base_url)
        if not html:
            continue
        found_analytics.update(find_analytics_in_html(html))
        scanned_urls.append(base_url)
        soup = BeautifulSoup(html, 'html.parser')
        links = [urljoin(base_url, a['href']) for a in soup.find_all('a', href=True)]
        visited = set(scanned_urls)
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
            found_analytics.update(find_analytics_in_html(html))
            soup = BeautifulSoup(html, 'html.parser')
            for a in soup.find_all('a', href=True):
                link = urljoin(url, a['href'])
                if urlparse(link).netloc == urlparse(base_url).netloc and link not in visited:
                    queue.append(link)
            if len(scanned_urls) >= MAX_PAGES:
                break
        if scanned_urls:
            break  # stop after first working variant

    return jsonify({'scanned_urls': scanned_urls, 'found_analytics': list(found_analytics)})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)
