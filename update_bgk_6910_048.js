const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const targetId = 'BGK-6910-048';
const rootDir = __dirname;
const bookingsPath = path.join(rootDir, 'bookings.json');
const dbPath = path.join(rootDir, 'database.db');

console.log(`[REPAIR] Checking ${targetId} status (reset to wait at L2 if corrupted by L1 bug)...`);

// 1. Update bookings.json
if (fs.existsSync(bookingsPath)) {
    try {
        const bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        const booking = bookings.find(b => b.id === targetId);
        if (booking && (booking.status === 'approved' || booking.currentApprovalLevel >= 4)) {
            booking.status = 'pending';
            booking.currentApprovalLevel = 2;
            booking.carId = '';
            booking.driverName = '';
            
            if (Array.isArray(booking.signatures)) {
                booking.signatures.forEach(sig => {
                    if (sig.level >= 2) {
                        sig.status = 'pending';
                        sig.approverName = '';
                        sig.comment = '';
                        sig.timestamp = '';
                        sig.signature = '';
                        if ('driverName' in sig) sig.driverName = '';
                    }
                });
            }

            fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2), 'utf8');
            console.log(`[SUCCESS] Repaired ${targetId} in bookings.json`);
        } else {
            console.log(`[INFO] ${targetId} in bookings.json is already correct or not found.`);
        }
    } catch (e) {
        console.error(`[ERROR] Updating bookings.json for ${targetId}:`, e);
    }
}

// 2. Update database.db if exists
if (fs.existsSync(dbPath)) {
    try {
        const db = new DatabaseSync(dbPath);
        const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(targetId);
        if (row && (row.status === 'approved' || row.currentApprovalLevel >= 4)) {
            let sigs = [];
            try { sigs = JSON.parse(row.signatures || '[]'); } catch(e) {}
            if (Array.isArray(sigs)) {
                sigs.forEach(sig => {
                    if (sig.level >= 2) {
                        sig.status = 'pending';
                        sig.approverName = '';
                        sig.comment = '';
                        sig.timestamp = '';
                        sig.signature = '';
                        if ('driverName' in sig) sig.driverName = '';
                    }
                });
            }
            db.prepare(`
                UPDATE bookings 
                SET status = 'pending', currentApprovalLevel = 2, carId = '', driverName = '', signatures = ? 
                WHERE id = ?
            `).run(JSON.stringify(sigs), targetId);
            console.log(`[SUCCESS] Repaired ${targetId} in database.db SQLite table`);
        } else {
            console.log(`[INFO] ${targetId} in database.db is already correct or not found.`);
        }
    } catch (err) {
        console.error(`[ERROR] Updating database.db for ${targetId}:`, err);
    }
}
