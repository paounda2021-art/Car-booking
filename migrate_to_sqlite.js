const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const dbPath = path.join(ROOT_DIR, 'database.db');

console.log("Starting SQLite database migration...");

// 1. Initialize SQLite Database Sync
const db = new DatabaseSync(dbPath);

try {
  // 2. Drop existing tables if any
  db.exec("DROP TABLE IF EXISTS bookings");
  db.exec("DROP TABLE IF EXISTS cars");
  db.exec("DROP TABLE IF EXISTS users");

  // 3. Create tables
  console.log("Creating tables...");
  
  // Table: users
  db.exec(`
    CREATE TABLE users (
      employee_id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT,
      name TEXT,
      position TEXT,
      department1 TEXT,
      department2 TEXT,
      role TEXT,
      manager_email TEXT,
      sign TEXT
    )
  `);

  // Table: cars
  db.exec(`
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
    )
  `);

  // Table: bookings
  db.exec(`
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
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
      active INTEGER
    )
  `);

  // 4. Load JSON files
  const usersJsonPath = path.join(ROOT_DIR, 'users.json');
  const carsJsonPath = path.join(ROOT_DIR, 'cars.json');
  const bookingsJsonPath = path.join(ROOT_DIR, 'bookings.json');

  const usersList = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
  const carsList = JSON.parse(fs.readFileSync(carsJsonPath, 'utf8'));
  const bookingsList = JSON.parse(fs.readFileSync(bookingsJsonPath, 'utf8'));

  // 5. Populate users
  console.log(`Migrating ${usersList.length} users...`);
  const insertUser = db.prepare(`
    INSERT INTO users (employee_id, username, email, name, position, department1, department2, role, manager_email, sign)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  usersList.forEach(u => {
    insertUser.run(
      u.employee_id || '',
      u.username || '',
      u.email || '',
      u.name || '',
      u.position || '',
      u.department1 || '',
      u.department2 || '',
      u.role || '',
      u.manager_email || '',
      u.sign || ''
    );
  });

  // 6. Populate cars
  console.log(`Migrating ${carsList.length} cars...`);
  const insertCar = db.prepare(`
    INSERT INTO cars (id, name, type, plate, status, icon, driverName, phone, brand, driver, controlUnit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  carsList.forEach(c => {
    insertCar.run(
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
    );
  });

  // 7. Populate bookings
  console.log(`Migrating ${bookingsList.length} bookings...`);
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, requester, requesterEmail, managerEmail, position, department, office, division, controlUnit,
      driverLicenseFile, addressNo, addressMoo, addressRoad, addressSubdistrict, addressDistrict, addressProvince,
      purpose, destination, ref, passengers, startDate, endDate, trips, travelType, carId, distance, price,
      goCheck, backCheck, status, currentApprovalLevel, driverName, returnedEarly, driverAccepted, signatures,
      waitingForRequesterInput, taxiInfo, active
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  bookingsList.forEach(b => {
    // Convert boolean flags to 1 / 0
    const goCheck = b.goCheck ? 1 : 0;
    const backCheck = b.backCheck ? 1 : 0;
    const returnedEarly = b.returnedEarly ? 1 : 0;
    const driverAccepted = b.driverAccepted ? 1 : 0;
    const waitingForRequesterInput = b.waitingForRequesterInput ? 1 : 0;
    const active = b.active ? 1 : 0;

    // Serialize objects/arrays to JSON string
    const signaturesStr = b.signatures ? JSON.stringify(b.signatures) : '[]';
    const taxiInfoStr = b.taxiInfo ? JSON.stringify(b.taxiInfo) : '{}';

    insertBooking.run(
      b.id || '',
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
      goCheck,
      backCheck,
      b.status || '',
      b.currentApprovalLevel || 0,
      b.driverName || '',
      returnedEarly,
      driverAccepted,
      signaturesStr,
      waitingForRequesterInput,
      taxiInfoStr,
      active
    );
  });

  console.log("SQLite Database migration completed successfully!");
} catch (e) {
  console.error("Migration error:", e);
} finally {
  db.close();
}
