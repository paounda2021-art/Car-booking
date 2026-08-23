const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT_DIR = __dirname;

function parseThaiDateParts(dStr) {
  if (!dStr) return { day: '..', monthStr: '..........', yearTh: '....' };
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return { day: '..', monthStr: '..........', yearTh: '....' };
  const day = d.getDate();
  const monthStr = thaiMonths[d.getMonth()];
  const yearTh = d.getFullYear() + 543;
  return { day, monthStr, yearTh };
}

function buildReportHTMLContent(b, usersList, carsList) {
  const reqDateParts = parseThaiDateParts(b.createdAt || b.startDate);
  const reqDate = `${reqDateParts.day} ${reqDateParts.monthStr} ${reqDateParts.yearTh}`;

  const startParts = parseThaiDateParts(b.startDate);
  const endParts = parseThaiDateParts(b.endDate);

  const car = (carsList || []).find(c => c.id === b.carId);
  const carName = car ? car.name : 'ไม่ระบุ';
  const carPlate = car ? car.plate : '-';

  // Signature lookup
  let l1Sig = '', l2Sig = '', l3Sig = '', l4Sig = '';
  let l1Name = '', l2Name = '', l3Name = '', l4Name = '';
  let l1Time = '', l2Time = '', l3Time = '', l4Time = '';

  if (b.signatures && Array.isArray(b.signatures)) {
    const s1 = b.signatures.find(s => s.level === 1 && s.status === 'approved');
    const s2 = b.signatures.find(s => s.level === 2 && s.status === 'approved');
    const s3 = b.signatures.find(s => s.level === 3 && s.status === 'approved');
    const s4 = b.signatures.find(s => s.level === 4 && s.status === 'approved');

    if (s1) {
      l1Sig = s1.signature;
      l1Name = s1.approverName || 'น.ส.ประทุม  ผักเจียมแว่น';
      l1Time = s1.timestamp ? new Date(s1.timestamp).toLocaleDateString('th-TH') : '';
    }
    if (s2) {
      l2Sig = s2.signature;
      l2Name = s2.approverName || 'นายฉลอง  เจียมผักแว่น';
      l2Time = s2.timestamp ? new Date(s2.timestamp).toLocaleDateString('th-TH') : '';
    }
    if (s3) {
      l3Sig = s3.signature;
      l3Name = s3.approverName || 'น.ส.สายสุนีย์  พูลวณิชย์สกุล';
      l3Time = s3.timestamp ? new Date(s3.timestamp).toLocaleDateString('th-TH') : '';
    }
    if (s4) {
      l4Sig = s4.signature;
      l4Name = s4.approverName || 'น.ส.ปิยวรรณ  แก้วกล้า';
      l4Time = s4.timestamp ? new Date(s4.timestamp).toLocaleDateString('th-TH') : '';
    }
  }

  // Fallbacks from users.json if not present in b.signatures
  if (!l1Sig && usersList) {
    const u1 = usersList.find(u => u.username === 'prathum.c' || (u.name && u.name.includes('ประทุม')));
    if (u1 && u1.sign) l1Sig = u1.sign;
  }
  if (!l2Sig && usersList) {
    const u2 = usersList.find(u => u.username === 'chalong.c' || (u.name && u.name.includes('ฉลอง')));
    if (u2 && u2.sign) l2Sig = u2.sign;
  }
  if (!l3Sig && usersList) {
    const u3 = usersList.find(u => u.username === 'saisunee.p' || (u.name && u.name.includes('สายสุนีย์')));
    if (u3 && u3.sign) l3Sig = u3.sign;
  }
  if (!l4Sig && usersList) {
    const u4 = usersList.find(u => u.username === 'piyawan.k' || (u.name && u.name.includes('ปิยวรรณ')));
    if (u4 && u4.sign) l4Sig = u4.sign;
  }

  // Read logo as base64
  let logoBase64 = '';
  const logoPath = path.join(ROOT_DIR, 'logoFMO.png');
  if (fs.existsSync(logoPath)) {
    logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  }

  const isTaxi = b.travelType === 'public_car' || b.travelType === 'taxi' || b.carId === 'taxi';

  return `
    <div class="fmo-header-block">
      <div class="fmo-header-left">
        <div class="fmo-line" style="font-size:13px;">[อ้างอิงเอกสารอนุมัติ/อนุญาต] ที่ <span class="dotted-fill" style="text-align:left; font-weight:normal; font-size:13px;">${b.ref || '-'}</span></div>
      </div>
      <div class="fmo-header-right">
        <div class="fmo-logo-wrapper">
          <img src="${logoBase64}" class="fmo-logo" alt="FMO Logo" style="width:55px; height:55px;">
        </div>
        <div class="fmo-title-main" style="font-size:18px; font-weight:bold;">องค์การสะพานปลา</div>
        <div style="font-size:11px; color:#555; margin-top:0.15rem;">สำนักงานบริหารการพัสดุ ฝ่ายบัญชีการเงิน</div>
      </div>
    </div>

    <div class="fmo-divider-title" style="margin-top:0.4rem; margin-bottom:1rem; text-align:center; font-weight:bold; font-size:14px; text-decoration:underline;">
      ใบขออนุญาตใช้รถยนต์และใบเสนออนุมัติเบิกจ่ายค่าพาหนะ
    </div>

    <div class="fmo-subject-block" style="font-size:13px;">
      <div style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem;">
        <span style="white-space: nowrap;">เลขที่ใบคำขอใช้: <strong class="dotted-val" style="min-width:120px;">${b.id}</strong></span>
        <span style="white-space: nowrap; margin-left: 15px;">วันที่: <strong class="dotted-val" style="min-width:140px;">${reqDate}</strong></span>
      </div>

      <div class="fmo-line">
        <span>เรียน</span>
        <strong style="margin-left: 10px;">หัวหน้าสำนักงานบริหารการพัสดุ</strong>
      </div>

      <div class="fmo-line">
        <span>ข้าพเจ้า</span>
        <span class="dotted-fill" style="text-align:center;">${b.requester || '-'}</span>
        <span>ตำแหน่ง</span>
        <span class="dotted-fill" style="text-align:center;">${b.position || 'พนักงานบริหารงานทั่วไป'}</span>
      </div>

      <div class="fmo-line">
        <span>แผนก</span>
        <span class="dotted-fill" style="text-align:center;">${b.department1 || 'ผสบ.'}</span>
        <span>สำนัก</span>
        <span class="dotted-fill" style="text-align:center;">${b.department2 || 'สนอ.'}</span>
        <span>ฝ่าย</span>
        <span class="dotted-fill" style="text-align:center;">${b.department1 || 'ฝ่าย สนอ.'}</span>
        <span>ขออนุญาตใช้รถยนต์ในความควบคุมของ</span>
      </div>

      <div class="fmo-line">
        <span>สำนักงานบริหารการพัสดุเพื่อติดต่องาน</span>
        <span style="margin-left:10px;"><span class="checkbox-box">${b.controlUnit === 'อสป.' ? '✓' : ''}</span> ( ) อสป.</span>
        <span style="margin-left:10px;"><span class="checkbox-box">${b.controlUnit === 'สินเชื่อ' ? '✓' : ''}</span> ( ) สินเชื่อ</span>
        <span style="margin-left:10px;"><span class="checkbox-box">${b.controlUnit === 'ส่งเสริมการประมง' ? '✓' : ''}</span> ( ) ส่งเสริมการประมง</span>
        <span style="margin-left:10px;"><span class="checkbox-box">${b.controlUnit === 'รถสวัสดิการ' ? '✓' : ''}</span> ( ) รถสวัสดิการ</span>
      </div>

      <div class="fmo-line">
        <span>เรื่อง</span>
        <span class="dotted-fill">${b.purpose || '-'}</span>
      </div>

      <div class="fmo-line">
        <span>ที่</span>
        <span class="dotted-fill">${b.destination || '-'}</span>
      </div>

      <div class="fmo-line">
        <span>โดยมีผู้โดยสารไปกับรถคือ</span>
        <span class="dotted-fill">${b.passengers || '-'}</span>
      </div>

      <div class="fmo-line">
        <span>ตั้งแต่วันที่</span>
        <span class="dotted-val" style="min-width:40px;">${startParts.day}</span>
        <span>เดือน</span>
        <span class="dotted-val" style="min-width:100px;">${startParts.monthStr}</span>
        <span>พ.ศ.</span>
        <span class="dotted-val" style="min-width:60px;">${startParts.yearTh}</span>
        <span>เวลา</span>
        <span class="dotted-val" style="min-width:60px;">${b.startTime || '08.00'}</span>
        <span>นาฬิกา</span>
      </div>

      <div class="fmo-line">
        <span>จนถึงวันที่</span>
        <span class="dotted-val" style="min-width:40px;">${endParts.day}</span>
        <span>เดือน</span>
        <span class="dotted-val" style="min-width:100px;">${endParts.monthStr}</span>
        <span>พ.ศ.</span>
        <span class="dotted-val" style="min-width:60px;">${endParts.yearTh}</span>
        <span>เวลา</span>
        <span class="dotted-val" style="min-width:60px;">${b.endTime || '16.30'}</span>
        <span>นาฬิกา</span>
      </div>

      <div class="fmo-line">
        <span>จำนวน</span>
        <span class="dotted-val" style="min-width:40px;">${b.tripsCount || 2}</span>
        <span>เที่ยว และข้าพเจ้าขอรับรองว่าจะถือปฏิบัติตามข้อบังคับองค์การสะพานปลา ว่าด้วยการใช้ และเก็บรักษาพนักงานรถ ขององค์การสะพานปลา พ.ศ. 2550 และแก้ไข (ฉบับที่ 2) พ.ศ. 2555 และแก้ไข (ฉบับที่ 3) พ.ศ. 2559 และแก้ไข (ฉบับที่ 4) พ.ศ. 2561 โดยเคร่งครัด เสร็จงานแล้ว จะนำรถยนต์ส่งมอบต่อสำนักงานบริหารการพัสดุทันที</span>
      </div>

      <div style="margin-top:0.4rem; font-weight:bold;">
        การเดินทางครั้งนี้ได้ขอความเห็นชอบเสนอขอใช้พาหนะ ดังนี้:
      </div>
    </div>

    <!-- DECISION GRID TABLE -->
    <div class="fmo-decision-grid" style="display:grid; grid-template-columns:1fr 1fr; border-top:1.5px solid #000; border-bottom:1.5px solid #000; margin-top:0.4rem;">
      <!-- COLUMN 1: Fleet Admin (L2) -->
      <div class="fmo-column" style="padding:0.35rem; border-right:1.5px solid #000; font-size:11.5px;">
        <div style="text-align:center; font-weight:bold; text-decoration:underline; margin-bottom:0.4rem;">
          ความเห็นของงานจัดรถยนต์ (L2)
        </div>
        
        <div>เห็นควรจัดสรรรถยนต์ อสป.:</div>
        <div style="margin-top:0.25rem;">
          <span class="checkbox-box">${!isTaxi ? '✓' : ''}</span> รถตู้ อสป. ทะเบียน <span class="dotted-val" style="min-width:100px;">${!isTaxi ? carPlate : '-'}</span>
        </div>
        <div>
          พขร. <span class="dotted-val" style="min-width:140px;">${!isTaxi ? (b.driverName || '-') : '-'}</span>
        </div>

        <div style="margin-top:0.4rem;">เห็นควรจัดสรรรถรับจ้างสาธารณะ (TAXI):</div>
        <div style="margin-top:0.25rem;">
          <span class="checkbox-box">${isTaxi ? '✓' : ''}</span> รถรับจ้างสาธารณะ (TAXI)
        </div>
        <div>
          ระยะทางประมาณ <span class="dotted-val" style="min-width:50px;">${b.distance || '-'}</span> กม. วงเงินงบประมาณ <span class="dotted-val" style="min-width:60px;">${b.price || '-'}</span> บาท
        </div>

        <div style="margin-top:0.6rem; display:flex; flex-direction:column; align-items:center;">
          <div style="height:35px; width:140px; border-bottom:1px dashed #777; display:flex; align-items:center; justify-content:center;">
            ${l2Sig ? `<img src="${l2Sig}" style="max-height:35px; max-width:130px; object-fit:contain;">` : ''}
          </div>
          <div style="margin-top:0.25rem; font-size:11px;">ลงนามโดย: ${l2Name || 'นายฉลอง  เจียมผักแว่น'}</div>
          <div style="font-size:10px; color:#555;">เมื่อ: ${l2Time || '-'}</div>
        </div>
      </div>

      <!-- COLUMN 2: Approvals (L1, L3, L4) -->
      <div class="fmo-column" style="padding:0.35rem; font-size:11.5px;">
        <div style="text-align:center; font-weight:bold; text-decoration:underline; margin-bottom:0.4rem;">
          ลำดับขั้นการตรวจสอบและอนุมัติ
        </div>

        <!-- L1 -->
        <div style="margin-bottom:0.4rem;">
          <div><span class="checkbox-box">${l1Sig ? '✓' : ''}</span> หัวหน้างาน (L1) - อนุมัติแล้ว</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.15rem;">
            <div style="height:30px; width:110px; border-bottom:1px dashed #777; display:flex; align-items:center; justify-content:center;">
              ${l1Sig ? `<img src="${l1Sig}" style="max-height:30px; max-width:100px; object-fit:contain;">` : ''}
            </div>
            <div style="font-size:10px; text-align:right;">
              <div>${l1Name || 'น.ส.ประทุม  ผักเจียมแว่น'}</div>
              <div style="color:#555;">${l1Time}</div>
            </div>
          </div>
        </div>

        <!-- L3 -->
        <div style="margin-bottom:0.4rem; border-top:1px solid #ddd; padding-top:0.25rem;">
          <div><span class="checkbox-box">${l3Sig ? '✓' : ''}</span> หส.พด. (L3) - อนุมัติแล้ว</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.15rem;">
            <div style="height:30px; width:110px; border-bottom:1px dashed #777; display:flex; align-items:center; justify-content:center;">
              ${l3Sig ? `<img src="${l3Sig}" style="max-height:30px; max-width:100px; object-fit:contain;">` : ''}
            </div>
            <div style="font-size:10px; text-align:right;">
              <div>${l3Name || 'น.ส.สายสุนีย์  พูลวณิชย์สกุล'}</div>
              <div style="color:#555;">${l3Time}</div>
            </div>
          </div>
        </div>

        <!-- L4 -->
        <div style="border-top:1px solid #ddd; padding-top:0.25rem;">
          <div><span class="checkbox-box">${l4Sig ? '✓' : ''}</span> ผฝ.บง. (L4) - อนุมัติแล้ว</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.15rem;">
            <div style="height:35px; width:120px; border-bottom:1px dashed #777; display:flex; align-items:center; justify-content:center;">
              ${l4Sig ? `<img src="${l4Sig}" style="max-height:35px; max-width:110px; object-fit:contain;">` : ''}
            </div>
            <div style="font-size:10px; text-align:right;">
              <div>${l4Name || 'น.ส.ปิยวรรณ  แก้วกล้า'}</div>
              <div style="color:#555;">${l4Time}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

let sharedBrowser = null;

async function getSharedBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  try {
    sharedBrowser = await puppeteer.launch({
      headless: 'new',
      windowsHide: true,
      pipe: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });
    return sharedBrowser;
  } catch(e) {
    console.error('Error launching shared Puppeteer browser:', e);
    return null;
  }
}

async function generatePDFReportServerSide(bookingId) {
  if (!bookingId) return null;
  console.log(`🚀 Starting Server-Side Puppeteer PDF generation for booking: ${bookingId}...`);

  try {
    // Read fresh data
    const bookingsPath = path.join(ROOT_DIR, 'bookings.json');
    const usersPath = path.join(ROOT_DIR, 'users.json');
    const carsPath = path.join(ROOT_DIR, 'cars.json');

    const bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
    const usersList = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const carsList = JSON.parse(fs.readFileSync(carsPath, 'utf8'));

    const b = bookings.find(x => x.id === bookingId);
    if (!b) {
      console.warn(`Booking ${bookingId} not found for server-side PDF generation.`);
      return null;
    }

    const reportDir = path.join(ROOT_DIR, 'Report');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const htmlBody = buildReportHTMLContent(b, usersList, carsList);
    const cssPath = path.join(ROOT_DIR, 'style.css');
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

    const fullHTML = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>Report ${b.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
          body {
            font-family: 'Sarabun', sans-serif !important;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-size: 12px;
            line-height: 1.4;
          }
          ${cssContent}
          .report-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 10px 15px !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        </style>
      </head>
      <body>
        <div class="report-sheet pdf-mode">
          ${htmlBody}
        </div>
      </body>
      </html>
    `;

    const browser = await getSharedBrowser();
    if (!browser) return null;

    const page = await browser.newPage();
    let pdfBuffer;
    try {
      await page.setContent(fullHTML, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
      });
    } finally {
      await page.close();
    }

    const fileName = `Report_${b.id}.pdf`;
    const filePath = path.join(reportDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    console.log(`✅ Server-side PDF Report successfully generated & saved: ${filePath} (${pdfBuffer.length} bytes)`);
    return {
      status: 'success',
      filename: fileName,
      path: `Report/${fileName}`,
      url: `/Report/${fileName}`,
      size: pdfBuffer.length
    };
  } catch (err) {
    console.error(`❌ Error in generatePDFReportServerSide for ${bookingId}:`, err);
    return null;
  }
}

module.exports = {
  generatePDFReportServerSide
};
