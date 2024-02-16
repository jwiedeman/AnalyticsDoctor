module.exports = {
    name: 'Google Analytics',
    patterns: [
        'https://www.google-analytics.com',
        'https://analytics.google.com',
    ],
    parseRequest: (requestUrl) => {
        console.log(`Attempting to parse request: ${requestUrl}`);
        try {
            const url = new URL(requestUrl);
            const pathname = url.pathname;
            let callType = 'Unknown';
            let eventType = 'Not specified';
            let tagId;
    
            // Detecting GA4 SDK Load Call
            if (pathname.includes('/gtag/js') && url.searchParams.has('id')) {
                callType = 'SDK Load';
                tagId = url.searchParams.get('id');
            } 
            // Detecting GA4 Collect Call
            else if (pathname.includes('/g/collect')) {
                tagId = url.searchParams.get('tid');
                // GA4 event name, e.g., page_view, event, etc.
                eventType = url.searchParams.get('en') || 'Not specified';
    
                if (eventType === 'page_view') {
                    callType = 'Pageview';
                } else if (eventType) {
                    callType = 'Event';
                }
            }
            // Handling Universal Analytics (UA) Pageview and Event
            else if (pathname.includes('/collect') || pathname.includes('/j/collect')) {
                tagId = url.searchParams.get('tid'); // Tracking ID for UA
                const hitType = url.searchParams.get('t'); // Hit type, e.g., pageview, event
                
                if (hitType) {
                    eventType = hitType;
                    callType = hitType.charAt(0).toUpperCase() + hitType.slice(1); // Capitalize the first letter
                }
            }
    
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
            console.error(`Error parsing URL: ${requestUrl}`, error);
            return { tagId: 'Invalid URL', callType: 'Error', eventType: 'Error', calls: 0 };
        }
    },
};
