module.exports = {
    name: 'Google Tag Manager',
    patterns: [
        'https://www.googletagmanager.com/gtag/js',
    ],
    parseRequest: (requestUrl) => {
        console.log(`Processing URL: ${requestUrl}`);

        try {
            const url = new URL(requestUrl);
            const idParam = url.searchParams.get('id');
            let eventType = 'Unknown';
            let tagId = 'Unknown ID';

            if (idParam) {
                tagId = idParam;
                // Determine the service type based on the ID prefix
                if (idParam.startsWith('GTM-')) {
                    eventType = 'Google Tag Manager (GTM-) SDK Load';
                } else if (idParam.startsWith('G-')) {
                    eventType = 'Google Analytics 4 (G-) SDK Load';
                } else if (idParam.startsWith('AW-')) {
                    eventType = 'Google Ads (AW-) SDK Load';
                } else if (idParam.startsWith('UA-')) {
                    eventType = 'Universal Analytics (UA-) SDK Load';
                } else if (idParam.startsWith('GT-')) {
                    eventType = 'Google Optimize (GT-) SDK Load';
                } else {
                    eventType = 'Other Google Service';
                }
            }

            return { 
                tagId, 
                eventType,
                calls: 1 
            };
        } catch (error) {
            console.error(`Invalid URL encountered: ${requestUrl}`, error);
            return { tagId: 'Invalid URL', eventType: 'Error', calls: 0 };
        }
    },
};
