const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
try {
  const db = new DatabaseSync(dbPath);
  console.log("=========================================");
  console.log("   SQLite Database Inspection Summary    ");
  console.log("=========================================");
  
  // 1. Count users
  const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  console.log(`👥 Total Users  : ${usersCount} records`);
  
  // 2. Count cars
  const carsCount = db.prepare("SELECT COUNT(*) AS count FROM cars").get().count;
  console.log(`🚗 Total Cars   : ${carsCount} records`);
  
  // 3. Count bookings
  const bookingsCount = db.prepare("SELECT COUNT(*) AS count FROM bookings").get().count;
  console.log(`📋 Total Bookings: ${bookingsCount} records`);
  
  console.log("-----------------------------------------");
  console.log("Sample Booking Record:");
  const sampleB = db.prepare("SELECT id, requester, status, startDate FROM bookings LIMIT 1").get();
  if (sampleB) {
    console.log(`  - ID: ${sampleB.id}`);
    console.log(`  - Requester: ${sampleB.requester}`);
    console.log(`  - Status: ${sampleB.status}`);
    console.log(`  - Start Date: ${sampleB.startDate}`);
  } else {
    console.log("  No bookings found in database.");
  }
  console.log("=========================================");
  db.close();
} catch (e) {
  console.error("Error inspecting database:", e);
}
