const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const dbPath = path.join(ROOT_DIR, 'database.db');
const tempDbPath = path.join(ROOT_DIR, 'database_temp.db');

console.log("Rebuilding database.db schema with createdAt as column #2 (right after id)...");

if (fs.existsSync(tempDbPath)) {
  fs.unlinkSync(tempDbPath);
}

const db = new DatabaseSync(tempDbPath);

// Create tables with createdAt placed right after id
db.exec(`
  CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    createdAt TEXT,
    requester TEXT,
    requesterEmail TEXT,
    managerEmail TEXT,
    position TEXT,
    department TEXT,
    office TEXT,
    division TEXT,
    controlUnit TEXT,
    driverLicenseFile TEXT,
    addressNo TEXT,
    addressMoo TEXT,
    addressRoad TEXT,
    addressSubdistrict TEXT,
    addressDistrict TEXT,
    addressProvince TEXT,
    purpose TEXT,
    destination TEXT,
    ref TEXT,
    passengers TEXT,
    startDate TEXT,
    endDate TEXT,
    trips INTEGER,
    travelType TEXT,
    carId TEXT,
    distance REAL,
    price REAL,
    goCheck INTEGER,
    backCheck INTEGER,
    status TEXT,
    currentApprovalLevel INTEGER,
    driverName TEXT,
    returnedEarly INTEGER,
    driverAccepted INTEGER,
    signatures TEXT,
    waitingForRequesterInput INTEGER,
    taxiInfo TEXT,
    active INTEGER DEFAULT 0
  );

  CREATE TABLE cars (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    plate TEXT,
    status TEXT,
    icon TEXT,
    driverName TEXT,
    phone TEXT,
    brand TEXT,
    driver TEXT,
    controlUnit TEXT
  );

  CREATE TABLE users (
    employee_id TEXT PRIMARY KEY,
    username TEXT,
    name TEXT,
    position TEXT,
    department1 TEXT,
    department2 TEXT,
    email TEXT,
    manager_email TEXT,
    role TEXT,
    canApprove TEXT,
    sign TEXT,
    customApprovalLevels TEXT
  );
`);

// Populate bookings from bookings.json
if (fs.existsSync(path.join(ROOT_DIR, 'bookings.json'))) {
  const bookings = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'bookings.json'), 'utf8'));
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, createdAt, requester, requesterEmail, managerEmail, position, department, office, division, controlUnit,
      driverLicenseFile, addressNo, addressMoo, addressRoad, addressSubdistrict, addressDistrict, addressProvince,
      purpose, destination, ref, passengers, startDate, endDate, trips, travelType, carId, distance, price,
      goCheck, backCheck, status, currentApprovalLevel, driverName, returnedEarly, driverAccepted, signatures,
      waitingForRequesterInput, taxiInfo, active
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  bookings.forEach(b => {
    insertBooking.run(
      b.id || '',
      b.createdAt || (b.signatures && b.signatures[0] && b.signatures[0].timestamp) || b.startDate || '',
      b.requester || '',
      b.requesterEmail || '',
      b.managerEmail || '',
      b.position || '',
      b.department || '',
      b.office || '',
      b.division || '',
      b.controlUnit || '',
      b.driverLicenseFile || '',
      b.addressNo || '',
      b.addressMoo || '',
      b.addressRoad || '',
      b.addressSubdistrict || '',
      b.addressDistrict || '',
      b.addressProvince || '',
      b.purpose || '',
      b.destination || '',
      b.ref || '',
      b.passengers || '',
      b.startDate || '',
      b.endDate || '',
      b.trips || 0,
      b.travelType || '',
      b.carId || '',
      b.distance || 0,
      b.price || 0,
      b.goCheck ? 1 : 0,
      b.backCheck ? 1 : 0,
      b.status || '',
      b.currentApprovalLevel || 0,
      b.driverName || '',
      b.returnedEarly ? 1 : 0,
      b.driverAccepted ? 1 : 0,
      b.signatures ? JSON.stringify(b.signatures) : '[]',
      b.waitingForRequesterInput ? 1 : 0,
      b.taxiInfo ? JSON.stringify(b.taxiInfo) : '{}',
      b.active ? 1 : 0
    );
  });
  console.log(`Populated ${bookings.length} bookings.`);
}

// Populate users
if (fs.existsSync(path.join(ROOT_DIR, 'users.json'))) {
  const users = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'users.json'), 'utf8'));
  const insUser = db.prepare('INSERT INTO users (employee_id, username, name, position, department1, department2, email, manager_email, role, canApprove, sign, customApprovalLevels) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  users.forEach(u => insUser.run(
    u.employee_id || '',
    u.username || '',
    u.name || '',
    u.position || '',
    u.department1 || '',
    u.department2 || '',
    u.email || '',
    u.manager_email || '',
    u.role || '',
    typeof u.canApprove === 'object' ? JSON.stringify(u.canApprove) : (u.canApprove !== undefined && u.canApprove !== null ? String(u.canApprove) : ''),
    u.sign || '',
    JSON.stringify(u.customApprovalLevels || [])
  ));
  console.log(`Populated ${users.length} users.`);
}

// Populate cars
if (fs.existsSync(path.join(ROOT_DIR, 'cars.json'))) {
  const cars = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'cars.json'), 'utf8'));
  const insCar = db.prepare('INSERT INTO cars (id, name, type, plate, status, icon, driverName, phone, brand, driver, controlUnit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  cars.forEach(c => insCar.run(
    c.id || '',
    c.name || '',
    c.type || '',
    c.plate || '',
    c.status || '',
    c.icon || '',
    c.driverName || '',
    c.phone || '',
    c.brand || '',
    c.driver || '',
    c.controlUnit || ''
  ));
  console.log(`Populated ${cars.length} cars.`);
}

try { db.close(); } catch(e) {}

try {
  fs.copyFileSync(tempDbPath, dbPath);
  try { fs.unlinkSync(tempDbPath); } catch(e) {}
  console.log("Database schema successfully rebuilt and saved directly to database.db.");
} catch(copyErr) {
  console.error("Error copying temp db to database.db:", copyErr);
}
