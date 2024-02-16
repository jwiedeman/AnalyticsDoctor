const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Import the cors middleware
const Domain = require('./models/Domain');

const app = express();
const PORT = 3000;
const mongoConnectionString = 'mongodb://127.0.0.1/AnalyticsDr';
app.use(cors()); // Use the cors middleware to disable CORS
// MongoDB connection
mongoose.connect(mongoConnectionString, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());


// Endpoint to set a domain's crawlRequest to null, indicating readiness for a new crawl
app.post('/request-crawl', async (req, res) => {
    const { domain } = req.body;
    console.log('/request-crawl')
    try {
        // Find the existing domain document or create a new one if it doesn't exist
        const existingDomain = await Domain.findOne({ domain: domain });
        if (existingDomain) {
            // If the domain exists, reset relevant fields before starting a new crawl
            existingDomain.urls = []; // Clear existing URLs
            existingDomain.lastChecked = null; // Reset the lastChecked date
            existingDomain.crawlRequest = null; // Set crawlRequest to the current date/time to indicate a new crawl request

            await existingDomain.save(); // Save the updated domain document
        } else {
            // If the domain doesn't exist, create a new document with initial values
            await Domain.create({
                domain: domain,
                urls: [],
                lastChecked: null,
                crawlRequest: null // Indicate a new crawl request
            });
        }

        res.json({ message: 'Crawl request initiated successfully', domain: domain });
    } catch (error) {
        console.error('Failed to initiate crawl request:', error);
        res.status(500).send('Failed to initiate crawl request');
    }
});





// Endpoint to view the latest crawl results for a specified domain
app.post('/view-results', async (req, res) => {
    console.log('/view-results')
    const { domain } = req.body;

    try {
        // Find the domain document with the latest crawl results
        const domainResults = await Domain.findOne({ domain: domain });

        if (domainResults) {
           
            // Return the crawl results for the domain
            res.json({ 
                message: 'Crawl results retrieved successfully', 
                domain: domain, 
                urls: domainResults.urls, // This includes the status, pageTitle, detectors, etc. for each URL
                lastChecked: domainResults.lastChecked
            });
        } else {
            // If the domain is not found in the database, inform the requester
            res.status(404).send({ message: 'Domain not found', domain: domain });
        }
    } catch (error) {
        console.error('Failed to retrieve crawl results:', error);
        res.status(500).send('Failed to retrieve crawl results');
    }
});


// Endpoint to check if domain data exists and decide if it needs to be crawled again
app.post('/check-domain', async (req, res) => {
    const domainDocument = await Domain.findOne({
        domain: "chlprep.com"
      }).exec();
      
      if (domainDocument && domainDocument.urls) {
        const matchingUrlsCount = domainDocument.urls.filter(urlObj => urlObj.url === "https://chlprep.com/shop/").length;
        console.log(`Number of matching URLs: ${matchingUrlsCount}`);
      } else {
        console.log("Domain document not found or no URLs present.");
      }
      
    const {domain} = req.body;
    console.log('/check-domain');
    try {
        const count = await Domain.countDocuments({ domain: domain });
        console.log(`${count} document(s) found for domain ${domain}.`);

        const domainData = await Domain.findOne({ domain: domain });

        if (domainData ) {
            console.log('/check-domain Domain data exists.');
            res.json({
                message: 'Domain data exists. No need to initiate a new crawl.',
                exists: true,
                data: {
                    urls: domainData.urls,
                    lastChecked: domainData.lastChecked
                }
            });
        } else {
            console.log('/check-domain No data for domain.');
            res.json({
                message: 'No data for domain. A new crawl can be initiated.',
                exists: false
            });
        }
    } catch (error) {
        console.error('Failed to check domain data:', error);
        res.status(500).send('Failed to check domain data');
    }
});


// New endpoint to get the queue length (total count of unprocessed URLs across all domains)
app.get('/queue-length', async (req, res) => {
    try {
        const domains = await Domain.find({});
        let unprocessedCount = 0;

        // Sum up all URLs that are not yet completed across all domains
        domains.forEach(domain => {
            unprocessedCount += domain.urls.filter(url => url.status !== 'completed').length;
        });

        res.json({ message: 'Queue length retrieved successfully', queueLength: unprocessedCount });
    } catch (error) {
        console.error('Failed to retrieve queue length:', error);
        res.status(500).send('Failed to retrieve queue length');
    }
});



app.listen(PORT, () => {
    
    console.log(`Server running on port ${PORT}`);
});