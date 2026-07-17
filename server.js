const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8080;
const ROOT_DIR = __dirname;

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
    const bookingsFile = path.join(ROOT_DIR, 'bookings.json');
    fs.readFile(bookingsFile, 'utf8', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(err ? '[]' : data);
    });
    return;
  }

  // API: save-bookings
  if (urlPath === '/api/save-bookings' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const bookingsFile = path.join(ROOT_DIR, 'bookings.json');
      fs.writeFile(bookingsFile, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'success', message: 'Bookings saved successfully' }));
        }
      });
    });
    return;
  }

  // API: get-cars
  if (urlPath === '/api/get-cars' && req.method === 'GET') {
    const carsFile = path.join(ROOT_DIR, 'cars.json');
    fs.readFile(carsFile, 'utf8', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(err ? '[]' : data);
    });
    return;
  }

  // API: save-cars
  if (urlPath === '/api/save-cars' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const carsFile = path.join(ROOT_DIR, 'cars.json');
      fs.writeFile(carsFile, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        } else {
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
      const usersFile = path.join(ROOT_DIR, 'users.json');
      fs.writeFile(usersFile, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        } else {
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

  // API: notify-driver-group
  if (urlPath === '/api/notify-driver-group' && req.method === 'POST') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(body);
        console.log("LINE: Received notify-driver-group request for booking:", payload.bookingId);
        
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
          
          const headerTitle = isCancel ? "⚠️ แจ้งยกเลิกใบสั่งงาน พขร." : "📋 ใบสั่งงานพนักงานขับรถ";
          const headerColor = isCancel ? "#dc2626" : "#1e3a8a";
          const headerBg = isCancel ? "#fef2f2" : "#f8fafc";
          const altText = isCancel 
            ? `⚠️ แจ้งยกเลิกคิวงาน พขร. - ปลายทาง: ${payload.destination || ''}` 
            : `📢 ใบสั่งงาน พขร. คิวใหม่ (อนุมัติเสร็จสิ้น) - ปลายทาง: ${payload.destination || ''}`;

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
                  footer: !isCancel ? {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "button",
                        action: {
                          type: "uri",
                          label: "✅ กดรับงาน",
                          uri: `${payload.origin || 'http://localhost:8080'}/index.html?action=accept-job&id=${payload.bookingId}`
                        },
                        style: "primary",
                        color: "#10b981"
                      }
                    ]
                  } : undefined
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
