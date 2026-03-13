/**
 * Utility functions for exporting data to CSV.
 */

/**
 * Converts an array of objects to a CSV string.
 * @param {Array<Object>} data - The dataset to convert.
 * @returns {string} The CSV formatted string.
 */
function convertToCSV(data) {
    if (!data || data.length === 0) {
        return '';
    }

    // Extract all unique keys from all objects to use as headers
    const allKeys = new Set();
    data.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
    });
    
    const headers = Array.from(allKeys);

    // Create the CSV header row
    const csvRows = [];
    csvRows.push(headers.map(header => `"${(header || '').toString().replace(/"/g, '""')}"`).join(','));

    // Create a row for each object
    data.forEach(row => {
        const values = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) {
                val = '';
            }
            const strVal = String(val).replace(/"/g, '""');
            // Enclose in quotes to handle commas, quotes, and line breaks within data
            return `"${strVal}"`;
        });
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
}

/**
 * Generates a valid CSV file and triggers a browser download.
 * @param {Array<Object>} data - The dataset to export.
 * @param {string} filename - The name of the file to save as (without .csv).
 */
export function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        console.warn('No data provided for export.');
        return;
    }

    const csvString = convertToCSV(data);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    if (link.download !== undefined) {
        // Browsers that support HTML5 download attribute
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        console.error('Browser does not support HTML5 download attribute.');
    }
}
