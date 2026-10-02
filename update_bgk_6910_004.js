const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const targetId = 'BGK-6910-004';
const rootDir = __dirname;
const bookingsPath = path.join(rootDir, 'bookings.json');
const dbPath = path.join(rootDir, 'database.db');

console.log(`[UPDATE] Resetting ${targetId} to wait at L2 (updating BOTH bookings.json and database.db)...`);

// 1. Update bookings.json
if (fs.existsSync(bookingsPath)) {
    const bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
    const index = bookings.findIndex(b => b.id === targetId);
    if (index !== -1) {
        bookings[index].status = 'pending';
        bookings[index].currentApprovalLevel = 2;
        bookings[index].carId = '';
        bookings[index].driverName = '';
        
        if (Array.isArray(bookings[index].signatures)) {
            bookings[index].signatures.forEach(sig => {
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
        console.log(`[SUCCESS] Updated ${targetId} in bookings.json`);
    } else {
        console.error(`[ERROR] Booking ${targetId} not found in bookings.json`);
    }
}

// 2. Update database.db if exists
if (fs.existsSync(dbPath)) {
    try {
        const db = new DatabaseSync(dbPath);
        const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(targetId);
        if (row) {
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
            const sigsJson = JSON.stringify(sigs);
            db.prepare('UPDATE bookings SET status = ?, currentApprovalLevel = ?, carId = ?, driverName = ?, signatures = ? WHERE id = ?')
              .run('pending', 2, '', '', sigsJson, targetId);
            console.log(`[SUCCESS] Updated ${targetId} in database.db (SQLite)`);
        }
    } catch(err) {
        console.error(`[ERROR] Database update failed:`, err);
    }
}
