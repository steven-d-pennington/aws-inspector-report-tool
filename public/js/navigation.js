// Navigation filtering functionality
function filterByAccount(accountId) {
    const currentPath = window.location.pathname;
    const currentUrl = new URL(window.location);

    // Update or add the awsAccountId parameter
    if (accountId) {
        currentUrl.searchParams.set('awsAccountId', accountId);
    } else {
        currentUrl.searchParams.delete('awsAccountId');
    }

    // Preserve existing filters for vulnerabilities page
    if (currentPath === '/vulnerabilities') {
        // Keep existing filter parameters
        const existingParams = new URLSearchParams(window.location.search);
        for (const [key, value] of existingParams) {
            if (key !== 'awsAccountId') {
                currentUrl.searchParams.set(key, value);
            }
        }
    }

    // Navigate to the filtered URL
    window.location.href = currentUrl.toString();
}

// Initialize account filter dropdown on page load
document.addEventListener('DOMContentLoaded', function() {
    const accountFilter = document.getElementById('accountFilter');
    if (accountFilter) {
        // Get the current account ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const currentAccountId = urlParams.get('awsAccountId');

        // Set the dropdown to the current account ID
        if (currentAccountId) {
            accountFilter.value = currentAccountId;
        }
    }
});