const fs = require('fs');
const content = fs.readFileSync('./ui/src/locales/zh-CN.json', 'utf8');

// Validate JSON
try {
    const parsed = JSON.parse(content);
    console.log('JSON valid: YES');
    console.log('Top-level keys:', Object.keys(parsed).length);
    
    // Count occurrences of top-level keys in raw string
    const matches = content.match(/^\s+"([^"]+)":/gm);
    const keyCounts = {};
    if (matches) {
        matches.forEach(m => {
            const key = m.match(/"([^"]+)"/)[1];
            keyCounts[key] = (keyCounts[key] || 0) + 1;
        });
    }
    
    const duplicates = Object.entries(keyCounts).filter((e) => e[1] > 1);
    console.log('Duplicate top-level keys:', duplicates.length);
    if (duplicates.length > 0) {
        duplicates.forEach(([k, v]) => console.log('  ' + k + ': ' + v + ' times'));
    } else {
        console.log('No duplicates - file is clean!');
    }
    
    console.log('File lines:', content.split('\n').length);
} catch (e) {
    console.log('JSON ERROR:', e.message);
}
