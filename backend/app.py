from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import asyncio
import aiohttp
import re

app = Flask(__name__)
CORS(app, resources={r"/scan": {"origins": "*"}}, supports_credentials=True)



MAX_PAGES = 500
CONCURRENCY = 10

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


async def fetch_url_async(session: aiohttp.ClientSession, url: str):
    """Asynchronously fetch a URL returning its HTML on HTTP 200."""
    try:
        async with session.get(url, timeout=10) as resp:
            if resp.status == 200:
                return url, await resp.text()
    except Exception:
        pass
    return url, None


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


async def crawl_variant(
    session: aiohttp.ClientSession,
    base_url: str,
    visited: set,
    scanned_urls: list,
    found_analytics: dict,
    queue: list,
):
    """Crawl a single domain variant asynchronously starting from an initial queue."""
    base_netloc = urlparse(base_url).netloc

    while queue and len(scanned_urls) < MAX_PAGES:
        batch = []
        urls = []
        while queue and len(batch) < CONCURRENCY:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            batch.append(fetch_url_async(session, url))
            urls.append(url)

        results = await asyncio.gather(*batch)
        for (url, html) in results:
            if html:
                scanned_urls.append(url)
                page_results = find_analytics_in_html(html)
                merge_analytics_data(found_analytics, page_results)
                soup = BeautifulSoup(html, 'html.parser')
                for a in soup.find_all('a', href=True):
                    link = urljoin(url, a['href'])
                    if (
                        urlparse(link).netloc == base_netloc
                        and link not in visited
                        and len(scanned_urls) + len(queue) < MAX_PAGES
                    ):
                        queue.append(link)
            if len(scanned_urls) >= MAX_PAGES:
                break


def merge_analytics_data(found: dict, page_results: dict):
    """Merge analytics detection data from a single page into the accumulator."""
    for name, data in page_results.items():
        entry = found.setdefault(name, {'ids': set(), 'method': data.get('method')})
        entry['ids'].update(data.get('ids', []))
        if not entry.get('method') and data.get('method'):
            entry['method'] = data['method']


async def scan_variants(variants):
    scanned_urls = []
    working_variants = []
    found_analytics = {}
    visited = set()

    async with aiohttp.ClientSession() as session:
        for base_url in variants:
            if len(scanned_urls) >= MAX_PAGES:
                break
            url, html = await fetch_url_async(session, base_url)
            if not html:
                continue
            working_variants.append(base_url)
            scanned_urls.append(base_url)
            visited.add(base_url)
            merge_analytics_data(found_analytics, find_analytics_in_html(html))

            soup = BeautifulSoup(html, 'html.parser')
            queue = []
            for a in soup.find_all('a', href=True):
                link = urljoin(base_url, a['href'])
                if (
                    urlparse(link).netloc == urlparse(base_url).netloc
                    and link not in visited
                ):
                    queue.append(link)

            await crawl_variant(session, base_url, visited, scanned_urls, found_analytics, queue)

    for data in found_analytics.values():
        data['ids'] = list(data['ids'])

    return {
        'working_variants': working_variants,
        'scanned_urls': scanned_urls,
        'found_analytics': found_analytics,
    }


@app.route('/scan', methods=['POST'])
def scan_domain():
    data = request.get_json(force=True)
    domain = clean_domain(data.get('domain', ''))

    variants = [
        f'http://{domain}',
        f'https://{domain}',
        f'http://www.{domain}',
        f'https://www.{domain}',
    ]

    result = asyncio.run(scan_variants(variants))
    return jsonify(result)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005)
