const mongoose = require('mongoose');

const detectorResultSchema = new mongoose.Schema({
    name: String,
    result: mongoose.Schema.Types.Mixed, // This can be adjusted based on your detector results
}, { _id: false }); // Prevent MongoDB from automatically adding an _id to sub-documents

const urlSchema = new mongoose.Schema({
    url: String,
    status: { type: String, default: 'pending' }, // Initial status is 'pending'
    pageTitle: String, // Storing page title directly within the URL schema
    detectors: [detectorResultSchema], // Array of detector results
    processedAt: { type: Date, default: null }, // Timestamp of when the URL was processed
}, { timestamps: true }); // Automatically manage createdAt and updatedAt for each URL

const domainSchema = new mongoose.Schema({
    domain: String,
    urls: [urlSchema],
    lastChecked: { type: Date, default: null },
    crawlRequest: { type: Date, default: null },
}, { timestamps: true }); // Automatically manage createdAt and updatedAt for each domain

const Domain = mongoose.model('Domain', domainSchema);

module.exports = Domain;
