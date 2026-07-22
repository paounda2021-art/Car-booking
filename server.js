const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;

// Initialize SQLite database (supports C:\apps\car-booking\database.db if opened in DB Browser)
const DB_PATH = fs.existsSync('C:\\apps\\car-booking\\database.db')
  ? 'C:\\apps\\car-booking\\database.db'
  : path.join(ROOT_DIR, 'database.db');

console.log(`[SQLite] Using database path: ${DB_PATH}`);
const db = new DatabaseSync(DB_PATH);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    requester TEXT,
    office TEXT,
    position TEXT,
    purpose TEXT,
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

  CREATE TABLE IF NOT EXISTS cars (
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

  CREATE TABLE IF NOT EXISTS users (
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
    customApprovalLevels TEXT
  );
`);

// Ensure schema is updated with active column for system_config
try { db.exec("ALTER TABLE bookings ADD COLUMN active INTEGER DEFAULT 0;"); } catch(e) {}
try { db.exec("ALTER TABLE cars ADD COLUMN name TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE cars ADD COLUMN icon TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE cars ADD COLUMN driverName TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE cars ADD COLUMN phone TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN customApprovalLevels TEXT;"); } catch(e) {}

// SQLite Helper Functions

function sqliteGetBookings() {
  try {
    const query = db.prepare("SELECT * FROM bookings");
    const rows = query.all();
    return rows.map(r => {
      const b = { ...r };
      b.goCheck = r.goCheck === 1;
      b.backCheck = r.backCheck === 1;
      b.returnedEarly = r.returnedEarly === 1;
      b.driverAccepted = r.driverAccepted === 1;
      b.waitingForRequesterInput = r.waitingForRequesterInput === 1;
      b.active = r.active === 1;
      
      try { b.signatures = JSON.parse(r.signatures || '[]'); } catch(e) { b.signatures = []; }
      try { b.taxiInfo = JSON.parse(r.taxiInfo || '{}'); } catch(e) { b.taxiInfo = {}; }
      return b;
    });
  } catch (e) {
    console.error("SQLite Read error (bookings):", e);
    return null;
  }
}

function sqliteSaveBookings(bookingsList) {
  try {
    const insertBooking = db.prepare(`
      INSERT OR REPLACE INTO bookings (
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
    console.log("SQLite Save completed (bookings count:", bookingsList.length + ")");
  } catch (e) {
    console.error("SQLite Write error (bookings):", e);
  }
}

// Automatic startup sync: load bookings.json into SQLite on server startup
try {
  const bookingsJsonPath = path.join(ROOT_DIR, 'bookings.json');
  if (fs.existsSync(bookingsJsonPath)) {
    const rawJson = fs.readFileSync(bookingsJsonPath, 'utf8').replace(/^\uFEFF/, '');
    const fileBookings = JSON.parse(rawJson);
    if (fileBookings && fileBookings.length > 0) {
      console.log(`[Startup Auto-Sync] Syncing ${fileBookings.length} records from bookings.json to SQLite database...`);
      sqliteSaveBookings(fileBookings);
    }
  }
} catch(e) {
  console.error("[Startup Auto-Sync] Error during database sync:", e);
}

function sqliteGetCars() {
  try {
    const query = db.prepare("SELECT * FROM cars");
    return query.all();
  } catch (e) {
    console.error("SQLite Read error (cars):", e);
    return null;
  }
}

function sqliteSaveCars(carsList) {
  try {
    db.exec("DELETE FROM cars");
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
    console.log("SQLite: Saved all cars successfully");
    return true;
  } catch (e) {
    console.error("SQLite Write error (cars):", e);
    return false;
  }
}

function sqliteGetUsers() {
  try {
    const query = db.prepare("SELECT * FROM users");
    const rows = query.all();
    return rows.map(r => {
      const u = { ...r };
      if (r.customApprovalLevels) {
        try {
          u.customApprovalLevels = JSON.parse(r.customApprovalLevels);
        } catch(e) {
          delete u.customApprovalLevels;
        }
      }
      return u;
    });
  } catch (e) {
    console.error("SQLite Read error (users):", e);
    return null;
  }
}

function sqliteSaveUsers(usersList) {
  try {
    db.exec("DELETE FROM users");
    const insertUser = db.prepare(`
      INSERT INTO users (employee_id, username, email, name, position, department1, department2, role, manager_email, sign, customApprovalLevels)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        u.sign || '',
        u.customApprovalLevels ? JSON.stringify(u.customApprovalLevels) : null
      );
    });
    console.log("SQLite: Saved all users successfully");
    return true;
  } catch (e) {
    console.error("SQLite Write error (users):", e);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = url.pathname;

  // API: get-bookings
  if (urlPath === '/api/get-bookings' && req.method === 'GET') {
    const sqlData = sqliteGetBookings();
    if (sqlData) {
      res.writeHead(200, { 
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(JSON.stringify(sqlData));
    } else {
      const bookingsFile = path.join(ROOT_DIR, 'bookings.json');
      fs.readFile(bookingsFile, 'utf8', (err, data) => {
        res.writeHead(200, { 
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(err ? '[]' : data);
      });
    }
    return;
  }

  // API: save-bookings
  if (urlPath === '/api/save-bookings' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      
      // Dual-Write 1: bookings.json file
      const bookingsFile = path.join(ROOT_DIR, 'bookings.json');
      fs.writeFile(bookingsFile, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        } else {
          // Dual-Write 2: SQLite database
          try {
            const list = JSON.parse(body);
            sqliteSaveBookings(list);
          } catch(sqliteErr) {
            console.error("SQLite Dual-Write failed:", sqliteErr);
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'success', message: 'Bookings saved successfully' }));
        }
      });
    });
    return;
  }

  // API: get-cars
  if (urlPath === '/api/get-cars' && req.method === 'GET') {
    const sqlData = sqliteGetCars();
    if (sqlData) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(sqlData));
    } else {
      const carsFile = path.join(ROOT_DIR, 'cars.json');
      fs.readFile(carsFile, 'utf8', (err, data) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(err ? '[]' : data);
      });
    }
    return;
  }

  // API: save-cars
  if (urlPath === '/api/save-cars' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      
      // Dual-Write 1: cars.json file
      const carsFile = path.join(ROOT_DIR, 'cars.json');
      fs.writeFile(carsFile, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        } else {
          // Dual-Write 2: SQLite database
          try {
            const list = JSON.parse(body);
            sqliteSaveCars(list);
          } catch(sqliteErr) {
            console.error("SQLite Dual-Write failed:", sqliteErr);
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'success', message: 'Cars saved successfully' }));
        }
      });
    });
    return;
  }

  // API: save-users
  if (urlPath === '/api/save-users' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      
      // Dual-Write 1: users.json file
      const usersFile = path.join(ROOT_DIR, 'users.json');
      fs.writeFile(usersFile, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        } else {
          // Dual-Write 2: SQLite database
          try {
            const list = JSON.parse(body);
            sqliteSaveUsers(list);
          } catch(sqliteErr) {
            console.error("SQLite Dual-Write failed:", sqliteErr);
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'success', message: 'Users saved successfully' }));
        }
      });
    });
    return;
  }

  // API: send-email
  if (urlPath === '/api/send-email' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      // Escape single quotes for PowerShell
      const escapedBody = body.replace(/'/g, "''");
      const escapedRootDir = ROOT_DIR.replace(/\\/g, '\\\\');
      
      const psCommand = `Start-Job -ScriptBlock {
        param($bodyText, $rootDir)
        try {
          $emailData = ConvertFrom-Json $bodyText
          $configPath = Join-Path $rootDir "smtp_config.json"
          if (Test-Path $configPath) {
            $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
            $mail = New-Object System.Net.Mail.MailMessage
            $fromAddr = if ($cfg.from) { $cfg.from } else { "carbooking@workd.go.th" }
            $mail.From = New-Object System.Net.Mail.MailAddress($fromAddr)
            $emailData.to.Split(',') | ForEach-Object { if ($_.Trim()) { $mail.To.Add($_.Trim()) } }
            $mail.Subject = $emailData.subject
            $mail.Body = $emailData.body
            $mail.IsBodyHtml = $true
            $mail.BodyEncoding = [System.Text.Encoding]::UTF8
            $mail.SubjectEncoding = [System.Text.Encoding]::UTF8

            $smtp = New-Object System.Net.Mail.SmtpClient($cfg.smtpServer, $cfg.port)
            $smtp.EnableSsl = $cfg.enableSsl
            $smtp.Timeout = 10000
            if ($cfg.username -and $cfg.password) {
              $smtp.UseDefaultCredentials = $false
              $smtp.Credentials = New-Object System.Net.NetworkCredential($cfg.username, $cfg.password)
            } else {
              $smtp.UseDefaultCredentials = $false
              $smtp.Credentials = $null
            }
            $smtp.Send($mail)
            $mail.Dispose()
            $smtp.Dispose()
          }
        } catch {
          Write-Host "Error sending email: $_"
        }
      } -ArgumentList '${escapedBody}', '${escapedRootDir}'`;

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/"/g, '\\"')}"`, (err) => {
        if (err) console.error('Failed to spawn email job:', err);
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'success', message: 'Email queued' }));
    });
    return;
  }

  // API: notify-driver-schedule-change
  if (urlPath === '/api/notify-driver-schedule-change' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const lineConfigPath = path.join(ROOT_DIR, 'line_config.json');

        const flexMessage = {
          type: "flex",
          altText: `📢 แจ้งเตือนเปลี่ยนวัน/เวลาเดินทาง เลขที่ ${body.bookingId || '-'}`,
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#d97706",
              paddingAll: "lg",
              contents: [
                {
                  type: "text",
                  text: "📢 แจ้งเตือนการเปลี่ยนแปลงวัน/เวลาเดินทาง",
                  weight: "bold",
                  color: "#ffffff",
                  size: "md",
                  wrap: true
                },
                {
                  type: "text",
                  text: `📌 เลขที่ใบขอ: ${body.bookingId || '-'}`,
                  color: "#fef3c7",
                  size: "xs",
                  margin: "xs"
                }
              ]
            },
            body: {
              type: "box",
              layout: "vertical",
              spacing: "md",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "👤 ผู้ขอใช้รถ:", size: "sm", color: "#64748b", flex: 4 },
                    { type: "text", text: `${body.requester || '-'}${body.requesterPosition ? ' (' + body.requesterPosition + ')' : ''}`, size: "sm", color: "#1e293b", weight: "bold", flex: 6, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "🚗 ยานพาหนะ:", size: "sm", color: "#64748b", flex: 4 },
                    { type: "text", text: `${body.carName || '-'} (${body.plate || '-'})`, size: "sm", color: "#1e293b", flex: 6, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "👤 พขร. ปฏิบัติหน้าที่:", size: "sm", color: "#64748b", flex: 4 },
                    { type: "text", text: body.driverName || 'ไม่ระบุ', size: "sm", color: "#1e293b", flex: 6, wrap: true }
                  ]
                },
                { type: "separator", margin: "md", color: "#e2e8f0" },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "⏰ วัน/เวลาเดิม:", size: "sm", color: "#ef4444", flex: 4 },
                    { type: "text", text: `${body.previousStart || '-'} ถึง ${body.previousEnd || '-'}`, size: "sm", color: "#ef4444", flex: 6, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "🆕 วัน/เวลาใหม่:", size: "sm", color: "#10b981", weight: "bold", flex: 4 },
                    { type: "text", text: `${body.newStart || '-'} ถึง ${body.newEnd || '-'}`, size: "sm", color: "#10b981", weight: "bold", flex: 6, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "📝 เหตุผล :", size: "sm", color: "#64748b", flex: 4 },
                    { type: "text", text: body.reason || 'ปรับเปลี่ยนเวลา', size: "sm", color: "#d97706", weight: "bold", flex: 6, wrap: true }
                  ]
                }
              ]
            }
          }
        };

        console.log("\n=========================================");
        console.log("[LINE Driver Flex Card Notification Log]");
        console.log(JSON.stringify(flexMessage, null, 2));
        console.log("=========================================\n");

        fs.readFile(lineConfigPath, 'utf8', (err, configData) => {
          if (!err) {
            try {
              const cfg = JSON.parse(configData);
              if (cfg.channelAccessToken && cfg.groupId) {
                const postData = JSON.stringify({
                  to: cfg.groupId,
                  messages: [flexMessage]
                });

                const options = {
                  hostname: 'api.line.me',
                  port: 443,
                  path: '/v2/bot/message/push',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.channelAccessToken}`,
                    'Content-Length': Buffer.byteLength(postData)
                  }
                };
                const lineReq = https.request(options, () => {});
                lineReq.on('error', (e) => console.error("LINE Flex Notify error:", e));
                lineReq.write(postData);
                lineReq.end();
              }
            } catch(e) {}
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'success', message: 'LINE Flex Card Notification dispatched', flexCard: flexMessage }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // API: notify-driver-group
  if (urlPath === '/api/notify-driver-group' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(body);
        console.log("LINE: Received notify-driver-group request for booking:", payload.bookingId);
        const simulatedUrl = `${payload.origin || 'http://localhost:8080'}/index.html?action=accept-job&id=${payload.bookingId}`;
        console.log("LINE: Simulated job acceptance link:", simulatedUrl);
        
        const baseOrigin = (payload.origin && payload.origin.startsWith('https://')) ? payload.origin : 'https://car-booking.fishmarket.co.th';
        
        // Load LINE config
        const lineConfigPath = path.join(ROOT_DIR, 'line_config.json');
        fs.readFile(lineConfigPath, 'utf8', (err, configData) => {
          let accessToken = '';
          let groupId = '';
          if (!err) {
            try {
              const cfg = JSON.parse(configData);
              accessToken = cfg.channelAccessToken || '';
              groupId = cfg.groupId || '';
            } catch (e) {
              console.error('Error parsing line_config.json:', e);
            }
          }

          // Check for default placeholders or empty values
          if (!accessToken || !groupId || accessToken.includes('YOUR_LINE_') || groupId.includes('YOUR_LINE_')) {
            console.warn('LINE config not configured or using placeholders in line_config.json');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ status: 'warning', message: 'LINE config not configured' }));
            return;
          }

          const isCancel = payload.type === 'cancel';
          const isAccept = payload.type === 'accept';
          const isFinish = payload.type === 'finish';
          const isWelfare = payload.isWelfare || (payload.carInfo && payload.carInfo.includes('รถสวัสดิการ')) || (payload.controlUnit === 'รถสวัสดิการ');

          let headerTitle = "📋 ใบสั่งงานพนักงานขับรถ";
          let headerColor = "#1e3a8a";
          let headerBg = "#f8fafc";
          let headerIdColor = "#1e40af";
          let altText = `📢 ใบสั่งงาน พขร. เลขที่ ${payload.bookingId || '-'} (อนุมัติเสร็จสิ้น) - ปลายทาง: ${payload.destination || ''}`;

          if (isWelfare) {
            headerTitle = "🚗 จัดสรรใช้รถสวัสดิการ";
            headerColor = "#0284c7";
            headerBg = "#f0f9ff";
            headerIdColor = "#0369a1";
            altText = `📢 จัดสรรใช้รถสวัสดิการ เลขที่ ${payload.bookingId || '-'} - ปลายทาง: ${payload.destination || ''}`;
          } else if (isCancel) {
            headerTitle = "⚠️ แจ้งยกเลิกใบสั่งงาน พขร.";
            headerColor = "#dc2626";
            headerBg = "#fef2f2";
            headerIdColor = "#b91c1c";
            altText = `⚠️ แจ้งยกเลิกคิวงาน พขร. เลขที่ ${payload.bookingId || '-'} - ปลายทาง: ${payload.destination || ''}`;
          } else if (isAccept) {
            headerTitle = "🟢 พขร. รับงานแล้ว";
            headerColor = "#10b981";
            headerBg = "#f0fdf4";
            headerIdColor = "#047857";
            altText = `🟢 พขร. รับงานแล้ว เลขที่ ${payload.bookingId || '-'} - ปลายทาง: ${payload.destination || ''}`;
          } else if (isFinish) {
            headerTitle = "🏁 พขร. จบงาน คืนรถแล้ว";
            headerColor = "#475569";
            headerBg = "#f1f5f9";
            headerIdColor = "#334155";
            altText = `🏁 พขร. จบงาน คืนรถแล้ว เลขที่ ${payload.bookingId || '-'} - ปลายทาง: ${payload.destination || ''}`;
          }

          // Construct body contents list dynamically
          const bodyContents = [];
          if (isCancel) {
            bodyContents.push(
              {
                type: "text",
                text: "❌ คิวงานนี้ถูกยกเลิกแล้ว",
                weight: "bold",
                size: "md",
                color: "#dc2626"
              },
              {
                type: "text",
                text: `💬 เหตุผล: ${payload.cancelReason || 'ไม่ระบุ'}`,
                size: "sm",
                color: "#ef4444",
                margin: "xs",
                wrap: true
              },
              {
                type: "separator",
                margin: "md",
                color: "#e2e8f0"
              }
            );
          }

          // Add standard fields
          bodyContents.push(
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👤 พขร. ปฏิบัติหน้าที่:",
                  size: "sm",
                  color: "#64748b",
                  flex: 4
                },
                {
                  type: "text",
                  text: payload.driverName || 'ไม่ระบุ',
                  size: "sm",
                  color: "#1e293b",
                  weight: "bold",
                  flex: 6,
                  wrap: true
                }
              ],
              margin: isCancel ? "md" : "none"
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "🚗 ยานพาหนะ:",
                  size: "sm",
                  color: "#64748b",
                  flex: 4
                },
                {
                  type: "text",
                  text: payload.carInfo || 'ไม่ระบุ',
                  size: "sm",
                  color: "#1e293b",
                  flex: 6,
                  wrap: true
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📍 สถานที่ปลายทาง:",
                  size: "sm",
                  color: "#64748b",
                  flex: 4
                },
                {
                  type: "text",
                  text: payload.destination || 'ไม่ระบุ',
                  size: "sm",
                  color: "#1e293b",
                  flex: 6,
                  wrap: true
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "📅 วันเวลาเดินทาง:",
                  size: "sm",
                  color: "#64748b",
                  flex: 4
                },
                {
                  type: "text",
                  text: payload.dateTime || 'ไม่ระบุ',
                  size: "sm",
                  color: "#1e293b",
                  flex: 6,
                  wrap: true
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👥 ผู้ขอใช้รถ:",
                  size: "sm",
                  color: "#64748b",
                  flex: 4
                },
                {
                  type: "text",
                  text: payload.passenger || 'ไม่ระบุ',
                  size: "sm",
                  color: "#1e293b",
                  flex: 6,
                  wrap: true
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "👨‍👩‍👦‍👦 ผู้ร่วมเดินทาง:",
                  size: "sm",
                  color: "#64748b",
                  flex: 4
                },
                {
                  type: "text",
                  text: payload.passengers || 'ไม่มี',
                  size: "sm",
                  color: "#1e293b",
                  flex: 6,
                  wrap: true
                }
              ],
              margin: "md"
            }
          );

          const postData = JSON.stringify({
            to: groupId,
            messages: [
              {
                type: "flex",
                altText: altText,
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: headerTitle,
                        weight: "bold",
                        size: "lg",
                        color: headerColor
                      },
                      {
                        type: "text",
                        text: `📌 เลขที่ใบขอจอง: ${payload.bookingId || '-'}`,
                        weight: "bold",
                        size: "sm",
                        color: headerIdColor,
                        margin: "xs"
                      },
                      {
                        type: "text",
                        text: "ระบบจองรถยนต์สะพานปลา (FMO)",
                        size: "xs",
                        color: "#64748b",
                        margin: "xs"
                      }
                    ],
                    backgroundColor: headerBg,
                    paddingAll: "15px"
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: bodyContents
                  },
                  footer: (() => {
                    if (isWelfare) {
                      // รถสวัสดิการ: ไม่ต้องมีปุ่ม กดรับงาน
                      return undefined;
                    }
                    const isLocal = !payload.origin || payload.origin.includes('localhost') || payload.origin.includes('127.0.0.1') || payload.origin.startsWith('http://');
                    const list = [];
                    
                    if (isFinish) {
                      list.push({
                        type: "button",
                        action: {
                          type: "uri",
                          label: "🏁 จบงาน คืนรถ เรียบร้อยแล้ว",
                          uri: `${payload.origin || 'https://car-booking.fishmarket.co.th'}`
                        },
                        style: "secondary",
                        color: "#9ca3af"
                      });
                    } else if (isAccept) {
                      if (isLocal) {
                        list.push(
                          {
                            type: "button",
                            action: {
                              type: "uri",
                              label: "✅ รับงานแล้ว (เรียบร้อย)",
                              uri: `${payload.origin || 'http://localhost:8080'}`
                            },
                            style: "secondary",
                            color: "#9ca3af",
                            margin: "xs"
                          },
                          {
                            type: "button",
                            action: {
                              type: "uri",
                              label: "🔴 จบงาน (คืนรถ)",
                              uri: `${payload.origin || 'http://localhost:8080'}/index.html?action=return-early&id=${payload.bookingId}`
                            },
                            style: "primary",
                            color: "#ef4444",
                            margin: "sm"
                          }
                        );
                      } else {
                        list.push(
                          {
                            type: "button",
                            action: {
                              type: "postback",
                              label: "✅ รับงานแล้ว (เรียบร้อย)",
                              data: `action=none`,
                              displayText: "✅ รับงานแล้ว"
                            },
                            style: "secondary",
                            color: "#9ca3af",
                            margin: "xs"
                          },
                          {
                            type: "button",
                            action: {
                              type: "postback",
                              label: "🔴 จบงาน (คืนรถ)",
                              data: `action=return-early&id=${payload.bookingId}`,
                              displayText: "🔴 จบงาน คืนรถ"
                            },
                            style: "primary",
                            color: "#ef4444",
                            margin: "sm"
                          }
                        );
                      }
                    } else if (!isCancel) {
                      if (isLocal) {
                        list.push({
                          type: "button",
                          action: {
                            type: "uri",
                            label: "✅ กดรับงาน",
                            uri: `${payload.origin || 'http://localhost:8080'}/index.html?action=accept-job&id=${payload.bookingId}`
                          },
                          style: "primary",
                          color: "#10b981"
                        });
                      } else {
                        list.push({
                          type: "button",
                          action: {
                            type: "postback",
                            label: "✅ กดรับงาน",
                            data: `action=accept-job&id=${payload.bookingId}`,
                            displayText: "✅ กดรับงาน"
                          },
                          style: "primary",
                          color: "#10b981"
                        });
                      }
                    }

                    if (list.length === 0) return undefined;
                    return {
                      type: "box",
                      layout: "vertical",
                      contents: list,
                      paddingAll: "15px"
                    };
                  })()
                }
              }
            ]
          });

          const options = {
            hostname: 'api.line.me',
            port: 443,
            path: '/v2/bot/message/push',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const lineReq = https.request(options, (lineRes) => {
            let resBody = '';
            lineRes.on('data', (d) => { resBody += d; });
            lineRes.on('end', () => {
              console.log('LINE: Push Response Status:', lineRes.statusCode, 'Body:', resBody);
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ status: 'success', message: 'Notification sent successfully', response: resBody }));
            });
          });

          lineReq.on('error', (e) => {
            console.error('LINE notification request error:', e);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ status: 'error', message: e.message }));
          });

          lineReq.write(postData);
          lineReq.end();
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API: line-webhook
  if (req.method === 'POST' && urlPath === '/api/line-webhook') {
    let chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(body);
        
        console.log("LINE Webhook received payload:", JSON.stringify(payload));
        
        if (payload.events && payload.events.length > 0) {
          const lineConfigPath = path.join(ROOT_DIR, 'line_config.json');
          fs.readFile(lineConfigPath, 'utf8', (err, configData) => {
            let accessToken = '';
            if (!err) {
              try {
                const cfg = JSON.parse(configData);
                accessToken = cfg.channelAccessToken || '';
              } catch (e) {
                console.error('Error parsing line_config.json:', e);
              }
            }
            
            const bookingsFile = path.join(ROOT_DIR, 'bookings.json');
            fs.readFile(bookingsFile, 'utf8', async (bErr, bData) => {
              if (bErr) {
                console.error("Error reading bookings.json:", bErr);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Read error' }));
                return;
              }
              
              let bookings = [];
              try {
                bookings = JSON.parse(bData);
              } catch (e) {
                console.error("Error parsing bookings.json:", e);
              }
              
              let updatedAny = false;
              
              for (const event of payload.events) {
                if (event.type === 'postback') {
                  const postbackData = event.postback.data;
                  const params = new URLSearchParams(postbackData);
                  const action = params.get('action');
                  const bookingId = params.get('id');
                  
                  console.log(`LINE Webhook: Postback received - action: ${action}, bookingId: ${bookingId}`);
                  
                  if (bookingId) {
                    const booking = bookings.find(b => b.id === bookingId);
                    if (booking) {
                      let updated = false;
                      if (action === 'accept-job' && !booking.driverAccepted) {
                        booking.driverAccepted = true;
                        updated = true;
                      } else if (action === 'return-early' && !booking.returnedEarly) {
                        booking.returnedEarly = true;
                        booking.endDate = new Date().toISOString();
                        updated = true;
                      }
                      
                      if (updated) {
                        updatedAny = true;
                        
                        if (accessToken) {
                          const defaultCars = [
                            { "id": "A", "name": "Toyota Commuter", "type": "รถตู้", "plate": "ฮษ 7446", "status": "available", "icon": "🚐", "driverName": "นายชลาดล  ทองคำ", "phone": "08-0992-3735" },
                            { "id": "B", "name": "Toyota Commuter", "type": "รถตู้", "plate": "1 นญ 1865 (เช่า)", "status": "available", "icon": "🚐", "driverName": "นายสันติ สุธรรม", "phone": "09-1021-4916" },
                            { "id": "C", "name": "Toyota Commuter", "type": "รถตู้", "plate": "1 นญ 2029 (เช่า)", "status": "available", "icon": "🚐", "driverName": "นายคมกฤษ คุ้มชัย", "phone": "09-4849-1122" },
                            { "id": "D", "name": "Toyota Commuter", "type": "รถตู้", "plate": "ฮล 2521 (รถสวัสดิการ)", "status": "available", "icon": "🚐", "driverName": "", "phone": "" }
                          ];
                          
                          const getCarPlateById = (carId) => {
                            const car = defaultCars.find(c => c.id === carId);
                            return car ? car.plate : '-';
                          };
                          
                          const formatThaiDateTime = (isoString) => {
                            if (!isoString) return '-';
                            const date = new Date(isoString);
                            const years = date.getFullYear() + 543;
                            const shortYear = String(years).slice(-2);
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            return `${day}/${month}/${shortYear} ${hours}.${minutes} น.`;
                          };

                          const isFinished = action === 'return-early';
                          const headerTitle = isFinished ? "🏁 เสร็จสิ้นใบสั่งงาน (พขร. คืนรถแล้ว)" : "🟢 พขร. รับงานแล้ว";
                          const headerColor = isFinished ? "#64748b" : "#10b981";
                          const headerBg = isFinished ? "#f1f5f9" : "#f0fdf4";
                          const altText = isFinished ? `🏁 เสร็จสิ้นคิวงาน พขร. - ${booking.id}` : `🟢 พขร. รับงานแล้ว - ${booking.id}`;
                          
                          const carPlate = getCarPlateById(booking.carId);
                          const carInfo = booking.carId === 'taxi' ? 'รถรับจ้างสาธารณะ (TAXI)' : `รถยนต์ อสป. ทะเบียน ${carPlate}`;
                          const dateTime = formatThaiDateTime(booking.startDate);
                          
                          const bodyContents = [
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "👤 พขร. ปฏิบัติหน้าที่:", size: "sm", color: "#64748b", flex: 4 },
                                { type: "text", text: booking.driverName || 'ไม่ระบุ', size: "sm", color: "#1e293b", weight: "bold", flex: 6, wrap: true }
                              ]
                            },
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "🚗 ยานพาหนะ:", size: "sm", color: "#64748b", flex: 4 },
                                { type: "text", text: carInfo, size: "sm", color: "#1e293b", flex: 6, wrap: true }
                              ],
                              margin: "md"
                            },
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "📍 สถานที่ปลายทาง:", size: "sm", color: "#64748b", flex: 4 },
                                { type: "text", text: booking.destination || 'ไม่ระบุ', size: "sm", color: "#1e293b", flex: 6, wrap: true }
                              ],
                              margin: "md"
                            },
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "📅 วันเวลาเดินทาง:", size: "sm", color: "#64748b", flex: 4 },
                                { type: "text", text: dateTime, size: "sm", color: "#1e293b", flex: 6, wrap: true }
                              ],
                              margin: "md"
                            },
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "👤 ผู้ขอใช้รถ:", size: "sm", color: "#64748b", flex: 4 },
                                { type: "text", text: booking.requester || '', size: "sm", color: "#1e293b", flex: 6, wrap: true }
                              ],
                              margin: "md"
                            },
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "👨‍👩‍👦‍👦 ผู้ร่วมเดินทาง:", size: "sm", color: "#64748b", flex: 4 },
                                { type: "text", text: booking.passengers || 'ไม่มี', size: "sm", color: "#1e293b", flex: 6, wrap: true }
                              ],
                              margin: "md"
                            }
                          ];

                          const flexContents = {
                            type: "bubble",
                            header: {
                              type: "box",
                              layout: "vertical",
                              contents: [
                                { type: "text", text: headerTitle, weight: "bold", size: "lg", color: headerColor },
                                { type: "text", text: "ระบบจองรถยนต์สะพานปลา (FMO)", size: "xs", color: "#64748b", margin: "xs" }
                              ],
                              backgroundColor: headerBg,
                              paddingAll: "15px"
                            },
                            body: {
                              type: "box",
                              layout: "vertical",
                              contents: bodyContents
                            }
                          };

                          if (!isFinished) {
                            flexContents.footer = {
                              type: "box",
                              layout: "vertical",
                              contents: [
                                {
                                  type: "button",
                                  action: {
                                    type: "postback",
                                    label: "🔴 จบงาน (คืนรถ)",
                                    data: `action=return-early&id=${booking.id}`,
                                    displayText: "🔴 จบงาน"
                                  },
                                  style: "secondary",
                                  color: "#ef4444"
                                }
                              ]
                            };
                          }

                          const postData = JSON.stringify({
                            replyToken: event.replyToken,
                            messages: [{
                              type: "flex",
                              altText: altText,
                              contents: flexContents
                            }]
                          });
                          
                          const reqOptions = {
                            hostname: 'api.line.me',
                            port: 443,
                            path: '/v2/bot/message/reply',
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': 'Bearer ' + accessToken,
                              'Content-Length': Buffer.byteLength(postData)
                            }
                          };
                          
                          const lReq = https.request(reqOptions, (lRes) => {
                            let rBody = '';
                            lRes.on('data', d => rBody += d);
                            lRes.on('end', () => console.log('LINE Webhook: Reply sent. Status:', lRes.statusCode, 'Body:', rBody));
                          });
                          lReq.on('error', e => console.error('LINE Reply API error:', e));
                          lReq.write(postData);
                          lReq.end();
                        }
                      }
                    }
                  }
                }
              }
              
              if (updatedAny) {
                fs.writeFile(bookingsFile, JSON.stringify(bookings, null, 2), 'utf8', (wErr) => {
                  if (wErr) console.error("Error writing bookings.json:", wErr);
                  else {
                    console.log("LINE Webhook: bookings.json updated successfully");
                    try {
                      sqliteSaveBookings(bookings);
                    } catch(sqliteErr) {
                      console.error("SQLite Dual-Write failed in webhook:", sqliteErr);
                    }
                  }
                });
              }
              
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('OK');
            });
          });
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        }
      } catch (e) {
        console.error("LINE Webhook parse error:", e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // API: test-line
  if (urlPath === '/api/test-line') {
    const lineConfigPath = path.join(ROOT_DIR, 'line_config.json');
    fs.readFile(lineConfigPath, 'utf8', (err, configData) => {
      let accessToken = '';
      let groupId = '';
      if (!err) {
        try {
          const cfg = JSON.parse(configData);
          accessToken = cfg.channelAccessToken || '';
          groupId = cfg.groupId || '';
        } catch (e) {
          console.error('Error parsing line_config.json:', e);
        }
      }

      if (!accessToken || !groupId) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('LINE config is missing or invalid.');
        return;
      }

      const postData = JSON.stringify({
        to: groupId,
        messages: [
          {
            type: "text",
            text: "🔔 ทดสอบระบบแจ้งเตือนไลน์กลุ่ม พขร. (Test Notification)"
          }
        ]
      });

      const options = {
        hostname: 'api.line.me',
        port: 443,
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const lineReq = https.request(options, (lineRes) => {
        let resBody = '';
        lineRes.on('data', (d) => { resBody += d; });
        lineRes.on('end', () => {
          console.log('LINE Test Response Status:', lineRes.statusCode, 'Body:', resBody);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          let parsed = {};
          try { parsed = JSON.parse(resBody); } catch(e) {}
          res.end(JSON.stringify({ status: lineRes.statusCode, response: parsed }));
        });
      });

      lineReq.on('error', (e) => {
        console.error('LINE Test Request Error:', e);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Request error: ' + e.message);
      });

      lineReq.write(postData);
      lineReq.end();
    });
    return;
  }

  // Serve static files
  let safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT_DIR, safePath);

  // Security check: ensure path is inside root
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Car Booking Server running on http://localhost:${PORT}`);
});
