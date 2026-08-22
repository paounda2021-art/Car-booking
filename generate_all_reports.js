const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const reportDir = path.join(ROOT_DIR, 'Report');

if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

console.log("Report directory ensured at:", reportDir);

// Read bookings
const bookingsFile = path.join(ROOT_DIR, 'bookings.json');
if (fs.existsSync(bookingsFile)) {
  const bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
  const approved = bookings.filter(b => b.status === 'approved');
  console.log(`Found ${approved.length} approved bookings out of ${bookings.length} total bookings.`);
  
  // List files currently in Report/
  const existingFiles = fs.readdirSync(reportDir);
  console.log(`Current files in Report/ (${existingFiles.length}):`, existingFiles);
}
