const axios = require('axios');
const cheerio = require('cheerio');
const Domain = require('../models/Domain'); // Adjust the path as necessary

/**
 * Process a single task (URL).
 * @param {string} domainName - The domain name to which the URL belongs.
 * @param {string} url - The URL to process.
 * @param {object} cases - Additional parameters or conditions for processing.
 */
async function processTask(domainName, url, cases) {
  try {
    // Example processing: Fetch the URL and parse the title
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const pageTitle = $('title').text();

    // Here, include your specific processing logic
    console.log(`Processed URL: ${url}, Title: ${pageTitle}`);

    // Assuming detectors logic is applied elsewhere and results are available
    // For example, let detectorResults = [...];

    // Update the domain entry in the database with the result
    await Domain.updateOne(
      { 'domain': domainName, 'urls.url': url },
      { 
        $set: { 
          'urls.$.status': 'completed', 
          'urls.$.pageTitle': pageTitle, 
          // 'urls.$.detectors': detectorResults, // Uncomment and adjust based on your actual logic
          'urls.$.processedAt': new Date() 
        } 
      }
    );

  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);

    // Optionally, update the domain entry in the database to reflect the failure
    await Domain.updateOne(
      { 'domain': domainName, 'urls.url': url },
      { 
        $set: { 
          'urls.$.status': 'failed', 
          'urls.$.error': error.message 
        } 
      }
    );
  }
}

module.exports = processTask;
