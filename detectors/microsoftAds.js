module.exports = {
    name: 'Microsoft Ads',
    patterns: [
        'https://bat.bing.com/actionp/',
        'https://bat.bing.com/action/',
    ],
    parseRequest: (requestUrl, postData) => {
        console.log(`Attempting to parse Microsoft Ads request: ${requestUrl}`);
        try {
            const url = new URL(requestUrl);
            let callType = 'Unknown';
            let eventType = 'Not specified';
            let tagId = url.searchParams.get('ti'); // Tag ID for Microsoft Ads
            let eventId = url.searchParams.get('evt'); // Event type, e.g., pageHide, pageView
            
            // Adjusting callType and eventType based on the URL and postData
            if (eventId) {
                eventType = eventId;
                callType = 'Event';
            }

            // Additional details can be extracted from postData if necessary
            // For now, we're focusing on URL parameters

            if (tagId) {
                console.log(`Found tag ID: ${tagId}, Call Type: ${callType}, Event Type: ${eventType}`);
                return { 
                    tagId, 
                    callType, 
                    eventType,
                    calls: 1 
                };
            } else {
                console.log(`No tag ID found in URL: ${requestUrl}`);
                return { tagId: 'Unknown ID', callType, eventType, calls: 1 };
            }
        } catch (error) {
            console.error(`Error parsing Microsoft Ads URL: ${requestUrl}`, error);
            return { tagId: 'Invalid URL', callType: 'Error', eventType: 'Error', calls: 0 };
        }
    },
};
