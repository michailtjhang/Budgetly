const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    console.log('Original content length:', content.length);

    // Remove existing/corrupted DATABASE_URL lines
    const lines = content.split(/\r?\n/).filter(l => !l.includes('DATABASE_URL'));

    // Append correct line
    lines.push('DATABASE_URL="file:./dev.db"');

    fs.writeFileSync(envPath, lines.join('\n'));
    console.log('.env fixed.');
} else {
    console.log('.env not found, creating new one.');
    fs.writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"');
}
