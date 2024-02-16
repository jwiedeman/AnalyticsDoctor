const puppeteer = require('puppeteer');
const Domain = require('../models/Domain');
const detectors = require('../detectors');

async function processUrl(domainName, url) {
    if (!url) {
        console.error("URL is undefined or invalid.");
        return;
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: "new" });

        const page = await browser.newPage();
        const requests = [];
        page.on('request', request => requests.push(request.url()));

        await page.goto(url, { waitUntil: 'networkidle0' });
        const pageTitle = await page.title();

        const detectorResults = detectors.map(detector => {
            const matchingRequests = requests.filter(requestUrl => 
                detector.patterns.some(pattern => requestUrl.startsWith(pattern)));
            return {
                name: detector.name,
                result: matchingRequests.length > 0
                    ? detector.parseRequest(matchingRequests[0])
                    : { tagId: 'Not Detected', calls: 0 }
            };
        });

        // Try to update an existing URL entry
        let updateResult = await Domain.updateOne(
            { 'domain': domainName, 'urls.url': url },
            {
                $set: {
                    'urls.$.status': 'completed',
                    'urls.$.pageTitle': pageTitle,
                    'urls.$.detectors': detectorResults,
                    'urls.$.processedAt': new Date()
                    // Remove automatic updates to 'urls.$.updatedAt' here, manage 'processedAt' manually
                }
            }
        );

        // If no URL was updated, add the URL to the array
        if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
            updateResult = await Domain.updateOne(
                { 'domain': domainName },
                {
                    $addToSet: {
                        urls: {
                            url: url,
                            status: 'completed',
                            pageTitle: pageTitle,
                            detectors: detectorResults,
                            processedAt: new Date()
                        }
                    }
                }
            );

            if (updateResult.matchedCount === 0) {
                console.error(`Domain not found for URL addition: ${domainName}.`);
            } else {
                console.log(`URL added to domain: ${domainName}.`);
            }
        } else {
            console.log(`Successfully updated URL: ${url} in domain: ${domainName}.`);
        }
    } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
        // Handle errors by potentially logging or taking corrective action
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = processUrl;
