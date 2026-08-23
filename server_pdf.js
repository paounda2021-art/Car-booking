const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT_DIR = __dirname;

function formatThaiDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function formatThaiTimeOnlyNoSuffix(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '00.00';
  const h = dateObj.getHours().toString().padStart(2, '0');
  const m = dateObj.getMinutes().toString().padStart(2, '0');
  return `${h}.${m}`;
}

function getSignatureImg(level, signatureVal, approverName, usersList) {
  if (signatureVal && typeof signatureVal === 'string' && signatureVal.trim().startsWith('data:image') && signatureVal.length > 30) {
    return signatureVal.trim().replace(/[\r\n]/g, '');
  }

  let username = '';
  if (level === 1) username = 'prathum.c';
  else if (level === 2) username = 'chalong.c';
  else if (level === 3) username = 'saisunee.p';
  else if (level === 4) username = 'piyawan.k';

  if (Array.isArray(usersList)) {
    const u = usersList.find(x =>
      (username && x.username && x.username.toLowerCase() === username.toLowerCase()) ||
      (level === 4 && (x.username === 'piyawan.k' || x.username === 'supbhachart.c' || (x.name && x.name.includes('ปิยวรรณ'))))
    );
    if (u && u.sign && typeof u.sign === 'string' && u.sign.trim().startsWith('data:image') && u.sign.length > 30) {
      return u.sign.trim().replace(/[\r\n]/g, '');
    }
    if (level === 0 && approverName) {
      const u0 = usersList.find(x => x.name && x.name.replace(/\s+/g, '') === approverName.replace(/\s+/g, ''));
      if (u0 && u0.sign && typeof u0.sign === 'string' && u0.sign.trim().startsWith('data:image') && u0.sign.length > 30) {
        return u0.sign.trim().replace(/[\r\n]/g, '');
      }
    }
  }

  return '';
}

function buildReportHTMLContent(b, usersList, carsList) {
  if (!b) return '';

  const logoPath = path.join(ROOT_DIR, 'logoFMO.png');
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  }

  const l0Sig = b.signatures ? (b.signatures.find(s => s.level === 0) || {}) : {};
  const l1Sig = b.signatures ? (b.signatures.find(s => s.level === 1) || {}) : {};
  const l2Sig = b.signatures ? (b.signatures.find(s => s.level === 2) || {}) : {};
  const l3Sig = b.signatures ? (b.signatures.find(s => s.level === 3) || {}) : {};
  const l4Sig = b.signatures ? (b.signatures.find(s => s.level === 4) || {}) : {};

  const l0SigImg = (l0Sig.status === 'approved') ? getSignatureImg(0, l0Sig.signature, b.requester, usersList) : getSignatureImg(0, '', b.requester, usersList);
  const l1SigImg = (l1Sig.status === 'approved') ? getSignatureImg(1, l1Sig.signature, l1Sig.approverName, usersList) : getSignatureImg(1, '', l1Sig.approverName, usersList);
  const l2SigImg = (l2Sig.status === 'approved') ? getSignatureImg(2, l2Sig.signature, l2Sig.approverName, usersList) : getSignatureImg(2, '', l2Sig.approverName, usersList);
  const l3SigImg = (l3Sig.status === 'approved') ? getSignatureImg(3, l3Sig.signature, l3Sig.approverName, usersList) : getSignatureImg(3, '', l3Sig.approverName, usersList);
  const l4SigImg = (l4Sig.status === 'approved') ? getSignatureImg(4, l4Sig.signature, l4Sig.approverName, usersList) : getSignatureImg(4, '', l4Sig.approverName, usersList);

  const reqDate = formatThaiDate(l0Sig.timestamp || b.startDate);
  const l1Date = l1Sig.timestamp ? formatThaiDate(l1Sig.timestamp) : '';
  const l2Date = l2Sig.timestamp ? formatThaiDate(l2Sig.timestamp) : '';
  const l3Date = l3Sig.timestamp ? formatThaiDate(l3Sig.timestamp) : '';
  const l4Date = l4Sig.timestamp ? formatThaiDate(l4Sig.timestamp) : '';

  const parseThaiDateParts = (isoString) => {
    if (!isoString) return { day: '...', month: '..........', year: '....', time: '.....' };
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { day: '...', month: '..........', year: '....', time: '.....' };
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return {
      day: date.getDate().toString(),
      month: months[date.getMonth()],
      year: (date.getFullYear() + 543).toString(),
      time: formatThaiTimeOnlyNoSuffix(date)
    };
  };

  const startParts = parseThaiDateParts(b.startDate);
  const endParts = parseThaiDateParts(b.endDate);

  const car = (carsList || []).find(c => c.id === b.carId);
  const carName = car ? car.name : 'ไม่ระบุ';
  const carPlate = car ? car.plate : '-';

  if (b.controlUnit === 'รถสวัสดิการ') {
    return `
    <!-- PAGE 1: WELFARE CAR REQUEST FORM -->
    <div class="welfare-car-report" style="font-family: 'Sarabun', 'TH Sarabun PSK', sans-serif; font-size: 13px; line-height: 1.5; color: #000; padding: 10px 0;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <div style="font-size: 12px; color: #333;">
          เลขที่ใบคำขอใช้: <span class="dotted-val" style="min-width: 100px;">${b.id}</span>
        </div>
        <div style="text-align: right; font-weight: bold; font-size: 14px;">
          องค์การสะพานปลา
        </div>
      </div>
      
      <div style="display: flex; justify-content: flex-end; margin-bottom: 0.75rem;">
        วันที่ <span class="dotted-val" style="min-width: 180px;">${reqDate}</span>
      </div>

      <div style="font-weight: bold; font-size: 14.5px; margin-bottom: 0.5rem; text-align: left;">
        เรื่อง ขอยืมรถยนต์สวัสดิการ
      </div>

      <div style="font-weight: bold; font-size: 13.5px; margin-bottom: 0.75rem; text-align: left;">
        เรียน ผู้อำนวยการฝ่ายบัญชีการเงิน ผ่าน หัวหน้าสำนักงานบริหารการพัสดุ
      </div>

      <!-- Paragraph 1 -->
      <div style="text-indent: 2.5rem; text-align: justify; margin-bottom: 0.6rem; line-height: 1.7;">
        1. ข้าพเจ้า <span class="dotted-val" style="min-width: 180px;">${b.requester}</span>
        ตำแหน่ง <span class="dotted-val" style="min-width: 140px;">${b.position || '-'}</span>
        สังกัด <span class="dotted-val" style="min-width: 150px;">${b.division || b.department}</span>
        อยู่บ้านเลขที่ <span class="dotted-val" style="min-width: 50px;">${b.addressNo || '&nbsp;'}</span>
        หมู่ <span class="dotted-val" style="min-width: 40px;">${b.addressMoo || '&nbsp;'}</span>
        ถนน <span class="dotted-val" style="min-width: 120px;">${b.addressRoad || '&nbsp;'}</span>
        ตำบล/แขวง <span class="dotted-val" style="min-width: 100px;">${b.addressSubdistrict || '&nbsp;'}</span>
        อำเภอ/เขต <span class="dotted-val" style="min-width: 100px;">${b.addressDistrict || '&nbsp;'}</span>
        จังหวัด <span class="dotted-val" style="min-width: 100px;">${b.addressProvince || '&nbsp;'}</span>
        พร้อมด้วย <span class="dotted-val" style="min-width: 160px;">${b.passengers || '-'}</span>
        มีความประสงค์จะขอยืมรถยนต์สวัสดิการ จำนวน <span class="dotted-val" style="min-width: 30px; text-align: center;">1</span> คัน
        เพื่อใช้ <span class="dotted-val" style="min-width: 180px;">${b.purpose}</span>
        ไปที่ <span class="dotted-val" style="min-width: 180px;">${b.destination || '-'}</span>
        โดยให้ <span class="dotted-val" style="min-width: 180px; text-align: center;">${b.driverName || b.requester}</span> เป็นผู้ขับรถ
        ตั้งแต่วันที่ <span class="dotted-val" style="min-width: 40px; text-align: center;">${startParts.day}</span>
        เดือน <span class="dotted-val" style="min-width: 90px; text-align: center;">${startParts.month}</span>
        พ.ศ. <span class="dotted-val" style="min-width: 50px; text-align: center;">${startParts.year}</span>
        เวลา <span class="dotted-val" style="min-width: 60px; text-align: center;">${startParts.time}</span> นาฬิกา
        ถึงวันที่ <span class="dotted-val" style="min-width: 40px; text-align: center;">${endParts.day}</span>
        เดือน <span class="dotted-val" style="min-width: 90px; text-align: center;">${endParts.month}</span>
        พ.ศ. <span class="dotted-val" style="min-width: 50px; text-align: center;">${endParts.year}</span>
        เวลา <span class="dotted-val" style="min-width: 60px; text-align: center;">${endParts.time}</span> นาฬิกา
      </div>

      <!-- Paragraph 2 -->
      <div style="text-indent: 2.5rem; text-align: justify; margin-bottom: 0.6rem; line-height: 1.7;">
        2. ข้าพเจ้ายินยอมจ่ายค่าทำการล่วงเวลาหรือค่าทำงานในวันหยุด หรือค่าเบี้ยเลี้ยง ตลอดจนค่าที่พักให้ผู้ขับรถสวัสดิการ และค่าใช้จ่ายต่าง ๆ ตลอดจนรับผิดชอบในความสูญและ/หรือเสียหายที่เกิดขึ้นแก่รถยนต์ในระหว่างที่ยืมใช้ ถ้าข้าพเจ้าบิดพริ้ว ยอมให้องค์การสะพานปลาหักเงินเดือนหรือเงินได้อื่นใดของข้าพเจ้าชดใช้ค่าใช้จ่ายต่าง ๆ จนครบถ้วนทันที
      </div>

      <!-- Paragraph 3 -->
      <div style="text-indent: 2.5rem; text-align: justify; margin-bottom: 1.25rem; line-height: 1.7;">
        3. ข้าพเจ้าขอมอบให้ <span class="dotted-val" style="min-width: 250px;">&nbsp;</span> เป็นผู้รับมอบรถยนต์แทน
      </div>

      <!-- Borrowers Signature Grid (4 columns) -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 1.25rem; text-align: center;">
        <div style="width: 22%;">
          <div style="height: 35px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px dotted #000; position: relative;">
            ${l0SigImg ? `<img src="${l0SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain;">` : ''}
          </div>
          <div style="margin-top: 4px; font-size: 11.5px;">1. ( <span style="font-weight: bold;">${b.requester}</span> )</div>
          <div style="font-size: 11px; color: #555;">ผู้ขอยืมรถ</div>
        </div>
        <div style="width: 22%;">
          <div style="height: 35px; border-bottom: 1px dotted #000;"></div>
          <div style="margin-top: 4px; font-size: 11.5px;">2. ( ................................. )</div>
          <div style="font-size: 11px; color: #555;">ผู้ขอยืมรถ</div>
        </div>
        <div style="width: 22%;">
          <div style="height: 35px; border-bottom: 1px dotted #000;"></div>
          <div style="margin-top: 4px; font-size: 11.5px;">3. ( ................................. )</div>
          <div style="font-size: 11px; color: #555;">ผู้ขอยืมรถ</div>
        </div>
        <div style="width: 22%;">
          <div style="height: 35px; border-bottom: 1px dotted #000;"></div>
          <div style="margin-top: 4px; font-size: 11.5px;">4. ( ................................. )</div>
          <div style="font-size: 11px; color: #555;">ผู้ขอยืมรถ</div>
        </div>
      </div>

      <!-- Driver's License attachment (Page 1) -->
      <div style="margin-bottom: 1.25rem; border: 1px dashed #000; padding: 0.5rem; border-radius: 4px; display: flex; align-items: center; gap: 1rem; font-size: 12px; background: #fafafa;">
        <div style="font-weight: bold; min-width: 120px;">สำเนาใบขับขี่ที่แนบ:</div>
        <div style="flex-grow: 1; text-align: left;">
          ${b.driverLicenseFile ? (b.driverLicenseFile.startsWith('data:application/pdf') ? 
            '<span style="font-size: 11px; color: #333;">[เอกสารสำเนาใบขับขี่ประเภท PDF แนบในระบบเรียบร้อยแล้ว]</span>' : 
            `<img src="${b.driverLicenseFile}" style="max-height: 85px; max-width: 220px; object-fit: contain; border: 1px solid #ccc;">`
          ) : '<span style="color: red;">[ไม่ได้แนบไฟล์ใบขับขี่]</span>'}
        </div>
      </div>

      <!-- Section: บันทึกความเห็นและคำสั่ง -->
      <div style="border: 1px solid #000; padding: 0.5rem 0.75rem; border-radius: 4px;">
        <div style="font-weight: bold; text-decoration: underline; margin-bottom: 0.5rem; font-size: 13px; text-align: center;">
          บันทึกความเห็นและคำสั่ง
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 12px;">
          <!-- Column 1: L1 and L2 -->
          <div style="display: flex; flex-direction: column; gap: 0.75rem; border-right: 1px dashed #ccc; padding-right: 0.75rem; text-align: left;">
            <!-- L1 Supervisor -->
            <div style="position: relative;">
              <div style="font-weight: bold; color: #111;">1. ความเห็นของหัวหน้าแผนก/สังกัด (L1)</div>
              <div style="margin-top: 2px;">
                ความเห็น: <span class="dotted-val" style="min-width: 140px; text-align: left;">${l1Sig.comment || '-'}</span>
              </div>
              <div style="display: flex; align-items: flex-end; gap: 0.25rem; margin-top: 4px;">
                ลงชื่อ: 
                <div style="border-bottom: 1px dotted #000; width: 120px; height: 25px; position: relative;">
                  ${l1SigImg ? `<img src="${l1SigImg}" style="max-height: 25px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
                </div>
              </div>
              <div style="margin-top: 2px;">
                ( <span style="min-width: 100px; display: inline-block; text-align: center;">${l1Sig.approverName || '........................................'}</span> )
              </div>
              <div style="font-size: 10px; color: #555; margin-top: 2px;">วันที่: ${l1Date || '........................................'}</div>
            </div>

            <!-- L2 Fleet Admin -->
            <div style="position: relative; border-top: 1px dashed #eee; padding-top: 0.4rem;">
              <div style="font-weight: bold; color: #111;">2. การจัดสรรรถยนต์สวัสดิการ (L2)</div>
              <div style="margin-top: 2px;">
                จัดรถทะเบียน: <span class="dotted-val" style="min-width: 120px;">${carPlate !== '-' ? carPlate : '......................'}</span>
              </div>
              <div style="margin-top: 2px;">
                ผู้ขับรถ: <span class="dotted-val" style="min-width: 140px;">${b.driverName || '................................'}</span>
              </div>
              <div style="margin-top: 2px;">
                ความเห็น: <span class="dotted-val" style="min-width: 140px; text-align: left;">${l2Sig.comment || '-'}</span>
              </div>
              <div style="display: flex; align-items: flex-end; gap: 0.25rem; margin-top: 4px;">
                ลงชื่อ: 
                <div style="border-bottom: 1px dotted #000; width: 120px; height: 25px; position: relative;">
                  ${l2SigImg ? `<img src="${l2SigImg}" style="max-height: 25px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
                </div>
                <span>ผู้จัดรถ</span>
              </div>
              <div style="margin-top: 2px;">
                ( <span style="min-width: 100px; display: inline-block; text-align: center;">${l2Sig.approverName || '........................................'}</span> )
              </div>
              <div style="font-size: 10px; color: #555; margin-top: 2px;">วันที่: ${l2Date || '........................................'}</div>
            </div>
          </div>

          <!-- Column 2: L3 and L4 -->
          <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
            <!-- L3 Director -->
            <div style="position: relative;">
              <div style="font-weight: bold; color: #111;">3. การตรวจสอบของงานพัสดุ / หส.พด. (L3)</div>
              <div style="margin-top: 2px;">
                ความเห็น: <span class="dotted-val" style="min-width: 140px; text-align: left;">${l3Sig.comment || '-'}</span>
              </div>
              <div style="display: flex; align-items: flex-end; gap: 0.25rem; margin-top: 4px;">
                ลงชื่อ: 
                <div style="border-bottom: 1px dotted #000; width: 120px; height: 25px; position: relative;">
                  ${l3SigImg ? `<img src="${l3SigImg}" style="max-height: 25px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
                </div>
                <span>หส.พด.</span>
              </div>
              <div style="margin-top: 2px;">
                ( <span style="min-width: 100px; display: inline-block; text-align: center;">${l3Sig.approverName || '........................................'}</span> )
              </div>
              <div style="font-size: 10px; color: #555; margin-top: 2px;">วันที่: ${l3Date || '........................................'}</div>
            </div>

            <!-- L4 Executive -->
            <div style="position: relative; border-top: 1px dashed #eee; padding-top: 0.4rem;">
              <div style="font-weight: bold; color: #111;">4. คำสั่งอนุมัติของผู้อำนวยการกองคลัง (L4)</div>
              <div style="margin-top: 2px;">
                คำสั่ง: <span class="dotted-val" style="min-width: 140px; text-align: left;">${l4Sig.comment || 'อนุมัติการยืมใช้รถยนต์สวัสดิการ'}</span>
              </div>
              <div style="display: flex; align-items: flex-end; gap: 0.25rem; margin-top: 4px;">
                ลงชื่อ: 
                <div style="border-bottom: 1px dotted #000; width: 120px; height: 25px; position: relative;">
                  ${l4SigImg ? `<img src="${l4SigImg}" style="max-height: 25px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
                </div>
                <span>ผู้อนุมัติ</span>
              </div>
              <div style="margin-top: 2px;">
                ( <span style="min-width: 100px; display: inline-block; text-align: center;">${l4Sig.approverName || '........................................'}</span> )
              </div>
              <div style="font-size: 10px; color: #555; margin-top: 2px;">วันที่: ${l4Date || '........................................'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PAGE 2: VEHICLE CONDITION CHECKLIST -->
    <div class="page-break"></div>
    <div style="padding-top: 0.5rem; font-family: 'Sarabun', 'TH Sarabun PSK', sans-serif; color: #000;">
      <!-- Title Header -->
      <div style="text-align: center; line-height: 1.4; margin-bottom: 0.8rem;">
        <div style="font-weight: bold; font-size: 13px;">องค์การสะพานปลา สำนักงานบริหารการพัสดุ ฝ่ายบัญชีการเงิน</div>
        <div style="font-weight: bold; font-size: 15px; margin-top: 0.15rem; text-decoration: underline;">ใบตรวจสอบสภาพรถยนต์สวัสดิการ ก่อนและหลังการนำรถไปใช้งาน</div>
      </div>

      <!-- Header fields -->
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 0.5rem; text-align: left;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding: 2px 0;">
            <strong>ผู้ขอยืมรถ:</strong> <span class="dotted-val" style="min-width: 180px; text-align: left;">${b.requester}</span>
          </td>
          <td style="width: 50%; vertical-align: top; padding: 2px 0;">
            <strong>รถยนต์ ยี่ห้อ/รุ่น:</strong> <span class="dotted-val" style="min-width: 160px; text-align: left;">${carName}</span>
          </td>
        </tr>
        <tr>
          <td style="vertical-align: top; padding: 2px 0;">
            <strong>ตำแหน่ง/สังกัด:</strong> <span class="dotted-val" style="min-width: 180px; text-align: left;">${b.division || b.department}</span>
          </td>
          <td style="vertical-align: top; padding: 2px 0;">
            <strong>เลขทะเบียนรถ:</strong> <span class="dotted-val" style="min-width: 160px; text-align: left;">${carPlate}</span>
          </td>
        </tr>
      </table>

      <!-- 3-Column Checklist Layout -->
      <div style="display: grid; grid-template-columns: 230px 1fr 230px; gap: 0.5rem; border: 1.5px solid #000; font-size: 11px; text-align: left; padding: 1px;">
        <!-- Left Column: Before Use -->
        <div style="border-right: 1.5px solid #000; padding: 4px;">
          <div style="font-weight: bold; text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 4px; font-size: 11.5px; background-color: #f8fafc;">
            ก่อนนำรถไปใช้งาน
          </div>
          
          <!-- Checklist table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 2px 0;">รายการตรวจสภาพ</th>
                <th style="width: 35px; text-align: center;">ซ้าย</th>
                <th style="width: 35px; text-align: center;">ขวา</th>
              </tr>
            </thead>
            <tbody>
              ${['กันชนหน้า', 'กันชนหลัง', 'ฝากระโปรงหน้า', 'ฝากระโปรงหลัง', 'บังโคลนหน้า', 'บังโคลนหลัง', 'ประตูหน้า', 'ประตูหลัง', 'กระจกมองข้าง', 'หลังคา'].map(item => `
                <tr style="border-bottom: 1px dashed #ccc;">
                  <td style="padding: 2px 0;">${item}</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="font-weight: bold; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; font-size: 10.5px;">
            รายการเพิ่มเติม
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 2px;">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 2px 0;">รายการตรวจเพิ่มเติม</th>
                <th style="width: 35px; text-align: center;">มี</th>
                <th style="width: 35px; text-align: center;">ไม่มี</th>
              </tr>
            </thead>
            <tbody>
              ${['น้ำในหม้อน้ำ', 'น้ำมันเครื่อง', 'น้ำมันเบรก', 'น้ำมันเพาเวอร์', 'น้ำกลั่น', 'น้ำมันเกียร์', 'น้ำมันเฟืองท้าย'].map(item => `
                <tr style="border-bottom: 1px dashed #ccc;">
                  <td style="padding: 2px 0;">${item}</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Middle Column: Visual Gauges and Outlines -->
        <div style="border-right: 1.5px solid #000; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
          <div style="font-weight: bold; text-align: center; border-bottom: 1.5px solid #000; width: 100%; padding-bottom: 2px; margin-bottom: 6px; font-size: 11.5px; background-color: #f8fafc;">
            ระดับน้ำมัน / เลขไมล์
          </div>
          
          <!-- Fuel Gauge SVG -->
          <div style="text-align: center; margin-top: 4px; width: 100%;">
            <div style="font-size: 9px; font-weight: bold;">ระดับน้ำมัน</div>
            <svg width="110" height="60" viewBox="0 0 110 60" style="display: block; margin: 2px auto 0 auto;">
              <path d="M 15 50 A 40 40 0 0 1 95 50" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="2 1"/>
              <line x1="55" y1="50" x2="55" y2="18" stroke="#000" stroke-width="2" />
              <polygon points="55,14 52,20 58,20" fill="#000" />
              <circle cx="55" cy="50" r="4.5" fill="#000" />
              <text x="5" y="52" font-size="9" font-family="Sarabun" font-weight="bold">E</text>
              <text x="50" y="10" font-size="9" font-family="Sarabun" font-weight="bold">1/2</text>
              <text x="98" y="52" font-size="9" font-family="Sarabun" font-weight="bold">F</text>
            </svg>
          </div>

          <!-- Odometer reading box -->
          <div style="border: 1px solid #000; border-radius: 4px; padding: 4px; width: 95%; text-align: center; font-size: 10px; margin: 4px 0; background-color: #fafafa;">
            <div>ตัวเลขไมล์ ก.ม.</div>
            <div style="margin-top: 4px; font-weight: bold;">ก่อนใช้: <span class="dotted-val" style="min-width: 60px;">&nbsp;</span></div>
            <div style="margin-top: 2px; font-weight: bold;">หลังใช้: <span class="dotted-val" style="min-width: 60px;">&nbsp;</span></div>
          </div>

          <!-- Van outlines SVG -->
          <div style="width: 100%; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; text-align: center;">
            <div style="font-size: 9px; font-weight: bold; margin-bottom: 4px;">แผนภาพรอยขีดข่วนตัวถังรถยนต์</div>
            
            <svg width="130" height="210" viewBox="0 0 130 210" style="display: block; margin: 0 auto; border: 1px dashed #ccc; background-color: #fff;">
              <text x="65" y="10" font-size="7" font-family="Sarabun" text-anchor="middle" font-weight="bold">ระบุจุดบกพร่องรอบคัน</text>
              <g stroke="#333" fill="none" stroke-width="1.1" transform="translate(42, 15)">
                <rect x="10" y="5" width="26" height="70" rx="5" />
                <path d="M 12 18 L 34 18 L 32 22 L 14 22 Z" fill="#eee" />
                <rect x="12" y="70" width="22" height="4" rx="0.5" fill="#eee" />
                <line x1="10" y1="14" x2="36" y2="14" />
                <text x="23" y="2" font-size="6" font-family="Sarabun" text-anchor="middle">บน</text>
              </g>
              <g stroke="#333" fill="none" stroke-width="1.1" transform="translate(10, 100)">
                <path d="M 4 8 L 28 8 A 2 2 0 0 1 30 10 L 30 26 A 1.5 1.5 0 0 1 28 28 L 4 28 A 1.5 1.5 0 0 1 2 26 L 2 10 A 2 2 0 0 1 4 8 Z" />
                <path d="M 3 10 L 29 10 L 27 18 L 5 18 Z" fill="#eee" />
                <rect x="4" y="22" width="4" height="2" rx="0.5" fill="#fff" />
                <rect x="24" y="22" width="4" height="2" rx="0.5" fill="#fff" />
                <text x="16" y="2" font-size="6" font-family="Sarabun" text-anchor="middle">หน้า</text>
              </g>
            </svg>
          </div>
        </div>

        <!-- Right Column: After Use -->
        <div style="padding: 4px;">
          <div style="font-weight: bold; text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 4px; font-size: 11.5px; background-color: #f8fafc;">
            เมื่อยืมส่งคืนรถ
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 2px 0;">รายการตรวจสภาพ</th>
                <th style="width: 35px; text-align: center;">ซ้าย</th>
                <th style="width: 35px; text-align: center;">ขวา</th>
              </tr>
            </thead>
            <tbody>
              ${['กันชนหน้า', 'กันชนหลัง', 'ฝากระโปรงหน้า', 'ฝากระโปรงหลัง', 'บังโคลนหน้า', 'บังโคลนหลัง', 'ประตูหน้า', 'ประตูหลัง', 'กระจกมองข้าง', 'หลังคา'].map(item => `
                <tr style="border-bottom: 1px dashed #ccc;">
                  <td style="padding: 2px 0;">${item}</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="font-weight: bold; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; font-size: 10.5px;">
            รายการเพิ่มเติม
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 2px;">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 2px 0;">รายการตรวจเพิ่มเติม</th>
                <th style="width: 35px; text-align: center;">มี</th>
                <th style="width: 35px; text-align: center;">ไม่มี</th>
              </tr>
            </thead>
            <tbody>
              ${['น้ำในหม้อน้ำ', 'น้ำมันเครื่อง', 'น้ำมันเบรก', 'น้ำมันเพาเวอร์', 'น้ำกลั่น', 'น้ำมันเกียร์', 'น้ำมันเฟืองท้าย'].map(item => `
                <tr style="border-bottom: 1px dashed #ccc;">
                  <td style="padding: 2px 0;">${item}</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                  <td style="text-align: center;">[ &nbsp; ]</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bottom Signature Section for Page 2 -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 11px; border: 1.5px solid #000; text-align: left;">
        <tr>
          <td style="width: 50%; border-right: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 6px; vertical-align: top;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 0.5rem;">ได้รับตรวจสอบสภาพรถและอุปกรณ์ให้ผู้ยืมรับไปใช้งานแล้ว</div>
            <div style="margin-bottom: 1rem; min-height: 20px; border-bottom: 1px dashed #ccc;">หมายเหตุ: </div>
            <div style="text-align: center;">
              ลงชื่อ ................................................................ ผู้ตรวจสอบ<br>
              ( ................................................................ )<br>
              วันที่ .........../.........../...........
            </div>
          </td>
          <td style="width: 50%; border-bottom: 1.5px solid #000; padding: 6px; vertical-align: top;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 0.5rem;">ได้รับรถและตรวจสภาพแล้วถูกต้องทุกรายการ / เว้นแต่</div>
            <div style="margin-bottom: 1rem; min-height: 20px; border-bottom: 1px dashed #ccc;">ข้อบกพร่องที่พบ: </div>
            <div style="text-align: center;">
              ลงชื่อ ................................................................ ผู้ยืม/รับรถ<br>
              ( <span style="font-weight: bold;">${b.requester}</span> )<br>
              วันที่ .........../.........../...........
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 6px; vertical-align: top;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 0.3rem;">เสนอ หส.พด. (ฝ่ายเจ้าหน้าที่พัสดุ)</div>
            <div style="margin-bottom: 0.5rem;">ได้ทำการตรวจสอบสภาพรถยนต์สวัสดิการ เรียบร้อยแล้วเมื่อผู้ยืมนำส่งคืน ปรากฏว่า:</div>
            <div style="border-bottom: 1px dashed #999; height: 18px; margin-bottom: 0.8rem;"></div>
            <table style="width: 100%; border: none;">
              <tr>
                <td style="width: 50%; text-align: center;">
                  ลงชื่อ ................................................................ ผู้ตรวจสอบ<br>
                  ( ................................................................ )<br>
                  ตำแหน่ง ................................................................
                </td>
                <td style="width: 50%; text-align: center; vertical-align: bottom;">
                  วันที่ .........../.........../...........
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
    `;
  }

  return `
    <!-- HEADER SECTION -->
    <div class="fmo-header-block">
      <div class="fmo-header-left">
        <div class="fmo-line" style="font-size:13px;">[อ้างอิงเอกสารอนุมัติ/อนุญาต] ที่ <span class="dotted-fill" style="text-align:left; font-weight:normal; font-size:13px;">${b.ref || '-'}</span></div>
      </div>
      <div class="fmo-header-right">
        <div class="fmo-logo-wrapper">
          <img src="${logoBase64}" class="fmo-logo" alt="FMO Logo">
        </div>
        <div class="fmo-title-main" style="font-size:18px;">องค์การสะพานปลา</div>
        <div style="font-size:11px; color:#555; margin-top:0.15rem;">สำนักงานบริหารการพัสดุ ฝ่ายบัญชีการเงิน</div>
      </div>
    </div>

    <div class="fmo-divider-title" style="margin-top:0.75rem; margin-bottom:1.5rem;">
      ใบขออนุญาตใช้รถยนต์และใบเสนออนุมัติเบิกจ่ายค่าพาหนะ
    </div>

    <!-- MAIN REQUEST INFO -->
    <div class="fmo-subject-block">
      <div style="display: grid; grid-template-columns: auto 140px; row-gap: 0.3rem; column-gap: 0.75rem; margin-left: auto; width: fit-content; margin-bottom: 1rem; font-size: 14px; margin-right: 0; align-items: end;">
        <div style="white-space: nowrap;">เลขที่ใบคำขอใช้</div>
        <div class="dotted-val" style="text-align: center; width: 100%;">${b.id}</div>
        <div style="white-space: nowrap;">วันที่</div>
        <div class="dotted-val" style="text-align: center; width: 100%;">${reqDate}</div>
      </div>
      <div class="fmo-line" style="margin-top:0.4rem;">
        เรียน &nbsp;&nbsp; <span style="font-weight: bold;">หัวหน้าสำนักงานบริหารการพัสดุ</span>
      </div>
      <div class="fmo-line" style="margin-top:0.4rem;">
        ข้าพเจ้า <span class="dotted-val" style="min-width: 200px;">${b.requester}</span>
        ตำแหน่ง <span class="dotted-val" style="min-width: 180px;">${b.position || '-'}</span>
        <span class="dotted-fill"></span>
      </div>
      <div class="fmo-line">
        แผนก <span class="dotted-val" style="min-width: 100px;">${b.department || '-'}</span>
        สำนัก <span class="dotted-val" style="min-width: 100px;">${b.office || '-'}</span>
        ฝ่าย <span class="dotted-val" style="min-width: 120px;">${b.division || '-'}</span>
        ขออนุญาตใช้รถยนต์ในความควบคุมของ
      </div>
      <div class="fmo-line" style="margin-top:0.4rem; line-height: 1.8;">
        สำนักงานบริหารการพัสดุเพื่อติดต่องาน &nbsp;&nbsp;&nbsp;&nbsp;
        ( <span style="font-family: 'Sarabun', sans-serif; font-weight: bold; display: inline-block; width: 12px; text-align: center;">${b.controlUnit === 'อสป.' ? '✓' : '&nbsp;'}</span> ) อสป.
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ( <span style="font-family: 'Sarabun', sans-serif; font-weight: bold; display: inline-block; width: 12px; text-align: center;">${b.controlUnit === 'สินเชื่อ' ? '✓' : '&nbsp;'}</span> ) สินเชื่อ
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ( <span style="font-family: 'Sarabun', sans-serif; font-weight: bold; display: inline-block; width: 12px; text-align: center;">${b.controlUnit === 'ส่งเสริมการประมง' ? '✓' : '&nbsp;'}</span> ) ส่งเสริมการประมง
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ( <span style="font-family: 'Sarabun', sans-serif; font-weight: bold; display: inline-block; width: 12px; text-align: center;">${b.controlUnit === 'รถสวัสดิการ' ? '✓' : '&nbsp;'}</span> ) รถสวัสดิการ
      </div>
      <div class="fmo-line" style="margin-top:0.4rem;">
        เรื่อง <span class="dotted-fill" style="text-align:left;">${b.purpose}${b.destination ? ' ณ ' + b.destination : ''}</span>
      </div>
      <div class="fmo-line" style="margin-top:0.4rem;">
        ที่ <span class="dotted-fill" style="text-align:left;">${b.destination || '-'}</span>
      </div>
      <div class="fmo-line" style="line-height: 1.8; margin-top: 0.4rem;">
        โดยมีผู้โดยสารไปกับรถคือ <span class="dotted-fill" style="text-align:left;">${b.passengers || '-'}</span>
      </div>
      <div class="fmo-line" style="line-height: 1.8; margin-top: 0.4rem;">
        ตั้งแต่วันที่ &nbsp;<span class="dotted-val" style="min-width: 45px;">${startParts.day}</span>&nbsp;
        เดือน &nbsp;<span class="dotted-val" style="min-width: 100px;">${startParts.month}</span>&nbsp;
        พ.ศ. &nbsp;<span class="dotted-val" style="min-width: 55px;">${startParts.year}</span>&nbsp;
        เวลา &nbsp;<span class="dotted-val" style="min-width: 70px;">${startParts.time}</span>&nbsp; นาฬิกา
      </div>
      <div class="fmo-line" style="line-height: 1.8;">
        จนถึงวันที่ &nbsp;<span class="dotted-val" style="min-width: 45px;">${endParts.day}</span>&nbsp;
        เดือน &nbsp;<span class="dotted-val" style="min-width: 100px;">${endParts.month}</span>&nbsp;
        พ.ศ. &nbsp;<span class="dotted-val" style="min-width: 55px;">${endParts.year}</span>&nbsp;
        เวลา &nbsp;<span class="dotted-val" style="min-width: 70px;">${endParts.time}</span>&nbsp; นาฬิกา
      </div>
      <div class="fmo-line" style="line-height: 1.8; text-align: justify; text-justify: inter-character; margin-top: 0.4rem; display: block; width: 100%;">
        จำนวน &nbsp;<span class="dotted-val" style="min-width: 45px;">${b.trips || '1'}</span>&nbsp; เที่ยว 
        และข้าพเจ้ารับรองว่าจะถือปฏิบัติตามข้อบังคับองค์การสะพานปลา ว่าด้วยการใช้ และเก็บรักษารถ ขององค์การสะพานปลา พ.ศ. 2550 และแก้ไข (ฉบับที่ 2) พ.ศ. 2555 และ แก้ไข (ฉบับที่ 3) พ.ศ. 2559 และแก้ไข (ฉบับที่ 4) พ.ศ. 2561 โดยเคร่งครัด เสร็จงานแล้ว จะนำรถยนต์ส่งมอบต่อสำนักงานบริหารการพัสดุทันที
      </div>
      <div class="fmo-line" style="margin-top: 0.8rem;">
        การเดินทางครั้งนี้ ได้ขอความเห็นชอบเสนอขอใช้พาหนะ ดังนี้:
      </div>
      <div style="margin-left:1.5rem; margin-top:0.4rem; display:flex; flex-direction:column; gap:0.4rem;">
        <div style="display:flex; align-items:center; line-height: 1.8;">
          <span style="margin-right: 4px;">- ขอได้โปรดพิจารณาอนุญาตรถยนต์ อสป. &nbsp;&nbsp;</span>
          <span class="checkbox-box">${(b.travelType === 'fmo_car' && b.goCheck) ? '✓' : ''}</span> (ไป) &nbsp;&nbsp;
          <span class="checkbox-box">${(b.travelType === 'fmo_car' && b.backCheck) ? '✓' : ''}</span> (กลับ)
          ${b.travelType === 'fmo_car' && carName ? `&nbsp;&nbsp; [คันที่จัดสรร: <span class="dotted-val">${carName}</span> ทะเบียน: <span class="dotted-val">${carPlate}</span>]` : ''}
        </div>
        <div style="display:flex; align-items:center; line-height: 1.8; margin-top:0.1rem;">
          <span style="margin-right: 4px;">- บริการรถโดยสารสาธารณะ, รถรับจ้าง ระยะทางรวม <span class="dotted-val" style="min-width:40px;">${b.travelType === 'public_car' ? b.distance : ''}</span> กม. &nbsp;&nbsp;</span>
          <span class="checkbox-box">${(b.travelType === 'public_car' && b.goCheck) ? '✓' : ''}</span> (ไป) &nbsp;&nbsp;
          <span class="checkbox-box">${(b.travelType === 'public_car' && b.backCheck) ? '✓' : ''}</span> (กลับ) &nbsp;&nbsp;
          ราคาประมาณ <span class="dotted-val" style="min-width:60px;">${b.travelType === 'public_car' ? b.price : ''}</span> บาท
        </div>
      </div>
    </div>

    <!-- CONCLUDING PHRASE & SIGNATURES WRAPPER -->
    <div style="width: 360px; margin-left: auto; margin-right: 0; text-align: left; margin-top: 0.8rem;">
      <!-- SIGNATURES ABOVE GRID (Requester & Supervisor) -->
      <table style="border: none; border-collapse: collapse; font-size: 12.5px; width: 100%;">
        <tr>
          <td colspan="3" style="padding: 2px 0 8px 0; text-align: left; font-size: 13px; font-weight: normal; white-space: nowrap;">
            จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ
          </td>
        </tr>
        <tr>
          <td style="padding: 2px 0; text-align: left; white-space: nowrap; width: 45px;">ลงชื่อ</td>
          <td style="width: 175px; border-bottom: 1px dotted #000; position: relative; height: 40px; padding: 0;">
            ${l0SigImg ? `<img src="${l0SigImg}" style="max-height: 40px; max-width: 100%; object-fit: contain; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);">` : ''}
          </td>
          <td style="padding: 2px 0 2px 5px; text-align: left; white-space: nowrap; width: 140px;">ผู้ขอใช้รถ</td>
        </tr>
        <tr>
          <td></td>
          <td style="text-align: center; padding: 2px 0; font-size: 12px; color: #111;">
            ( <span style="min-width: 120px; display: inline-block;">${b.requester}</span> )
          </td>
          <td></td>
        </tr>
        <tr style="height: 10px;"><td></td><td></td><td></td></tr>
        <tr>
          <td style="padding: 2px 0; text-align: left; white-space: nowrap;">ลงชื่อ</td>
          <td style="width: 175px; border-bottom: 1px dotted #000; position: relative; height: 40px; padding: 0;">
            ${l1SigImg ? `<img src="${l1SigImg}" style="max-height: 40px; max-width: 100%; object-fit: contain; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);">` : ''}
          </td>
          <td style="padding: 2px 0 2px 5px; text-align: left; white-space: nowrap;">หัวหน้าสนง./หัวหน้าแผนก</td>
        </tr>
        <tr>
          <td></td>
          <td style="text-align: center; padding: 2px 0; font-size: 12px; color: #111;">
            ( <span style="min-width: 120px; display: inline-block;">${l1Sig.approverName || '........................................'}</span> )
          </td>
          <td></td>
        </tr>
        <tr>
          <td></td>
          <td style="text-align: center; padding: 2px 0; font-size: 10px; color: #555;">
            วันที่ ${l1Date || '........................................'}
          </td>
          <td></td>
        </tr>
      </table>
    </div>

    <!-- TWO COLUMN DECISION AREA -->
    <div class="fmo-divider-title" style="margin-top: 1.5rem; margin-bottom: 0; border-bottom: none;">ความเห็นของผู้ควบคุมรถ/คำสั่งอนุญาต</div>
    <div class="fmo-decision-grid" style="margin-top: 0;">
      
      <!-- LEFT COLUMN -->
      <div class="fmo-column">
        ${b.travelType === 'public_car' ? '<div class="fmo-watermark">อนุมัติไปรถรับจ้าง</div>' : ''}
        <div class="fmo-col-header" style="font-weight: bold;">กรณีใช้รถยนต์ของ อสป.</div>
        <div style="margin-bottom: 0.5rem; font-weight: bold;">เสนอ หส.พด.</div>
        
        <div style="margin-top:0.4rem; line-height:1.6;">
          สพด. ได้จัดรถ <span class="dotted-val" style="min-width:140px;">${(b.travelType === 'fmo_car' && b.carId) ? carName + ' (' + carPlate + ')' : '-'}</span><br>
          โดยมี <span class="dotted-val" style="min-width:150px;">${(b.travelType === 'fmo_car' && b.driverName) ? b.driverName : '-'}</span> เป็นพนักงานขับรถ
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; width: 100%;">
          <div style="display: flex; align-items: flex-end; gap: 0.25rem; width: 100%; justify-content: center; position: relative;">
            <span>ลงชื่อ</span>
            <div style="width: 150px; border-bottom: 1px dotted #000; position: relative; height: 35px; text-align: center; display: flex; align-items: center; justify-content: center;">
              ${(b.travelType === 'fmo_car' && l2SigImg) ? `<img src="${l2SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : '-'}
            </div>
            <span>ผู้จัดรถ</span>
          </div>
          ${(b.travelType === 'fmo_car' && l2SigImg) ? `<div style="font-size: 11.5px; color: #111; margin-top: 0.15rem; text-align: center;">( ${l2Sig.approverName} )</div>` : ''}
          <div style="color: #555; text-align: center; margin-top: 0.2rem; width: 100%; font-size: 10.5px;">
            วันที่ ${(b.travelType === 'fmo_car' && l2Sig.timestamp) ? l2Date : '-'}
          </div>
        </div>

        <div style="margin-top:0.8rem; line-height:1.6; border-top: 1px dashed #ccc; padding-top: 0.5rem;">
          <span class="checkbox-box">${(b.travelType === 'fmo_car' && l3Sig.status === 'approved') ? '✓' : ''}</span> อนุญาต &nbsp;
          <span class="checkbox-box">${(b.travelType === 'fmo_car' && l3Sig.status === 'approved') ? '✓' : ''}</span> เรียน ผฝ.บง.พิจารณาอนุญาต
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; width: 100%;">
          <div style="display: flex; align-items: flex-end; gap: 0.25rem; width: 100%; justify-content: center; position: relative;">
            <span>ลงชื่อ</span>
            <div style="width: 150px; border-bottom: 1px dotted #000; position: relative; height: 35px; text-align: center; display: flex; align-items: center; justify-content: center;">
              ${(b.travelType === 'fmo_car' && l3SigImg) ? `<img src="${l3SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : '-'}
            </div>
            <span>หส.พด.</span>
          </div>
          ${(b.travelType === 'fmo_car' && l3SigImg) ? `<div style="font-size: 11.5px; color: #111; margin-top: 0.15rem; text-align: center;">( ${l3Sig.approverName} )</div>` : ''}
          <div style="color: #555; text-align: center; margin-top: 0.2rem; width: 100%; font-size: 10.5px;">
            วันที่ ${(b.travelType === 'fmo_car' && l3Sig.timestamp) ? l3Date : '-'}
          </div>
        </div>

        <div style="margin-top:0.8rem; line-height:1.6; border-top: 1px dashed #ccc; padding-top: 0.5rem;">
          <span class="checkbox-box">${(b.travelType === 'fmo_car' && l4Sig.status === 'approved') ? '✓' : ''}</span> อนุญาต
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; width: 100%;">
          <div style="display: flex; align-items: flex-end; gap: 0.25rem; width: 100%; justify-content: center; position: relative;">
            <span>ลงชื่อ</span>
            <div style="width: 150px; border-bottom: 1px dotted #000; position: relative; height: 35px; text-align: center; display: flex; align-items: center; justify-content: center;">
              ${(b.travelType === 'fmo_car' && l4SigImg) ? `<img src="${l4SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : '-'}
            </div>
            <span>ผฝ.บง.</span>
          </div>
          ${(b.travelType === 'fmo_car' && l4SigImg) ? `<div style="font-size: 11.5px; color: #111; margin-top: 0.15rem; text-align: center;">( ${l4Sig.approverName} )</div>` : ''}
          <div style="color: #555; text-align: center; margin-top: 0.2rem; width: 100%; font-size: 10.5px;">
            วันที่ ${(b.travelType === 'fmo_car' && l4Sig.timestamp) ? l4Date : '-'}
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="fmo-column">
        ${b.travelType === 'fmo_car' ? '<div class="fmo-watermark">อนุมัติรถ อสป.</div>' : ''}
        <div class="fmo-col-header" style="font-weight: bold;">กรณีขออนุญาตให้ไปรถรับจ้าง (รถโดยสารสาธารณะ)</div>
        <div style="margin-bottom: 0.5rem; font-weight: bold;">เสนอ หส.พด., ผฝ.บง.</div>
        
        <div style="margin-top:0.4rem; line-height:1.6;">
          สพด. ไม่สามารถจัดรถให้ได้เนื่องจากรถยนต์ไม่ว่าง เห็นควรให้ไปโดยรถรับจ้าง(รถโดยสารสาธารณะ) เพื่อโปรดอนุญาต
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; width: 100%;">
          <div style="display: flex; align-items: flex-end; gap: 0.25rem; width: 100%; justify-content: center; position: relative;">
            <span>อนุญาตลงชื่อ</span>
            <div style="width: 150px; border-bottom: 1px dotted #000; position: relative; height: 35px; text-align: center;">
              ${(b.travelType === 'public_car' && l2SigImg) ? `<img src="${l2SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
            </div>
            <span>ผู้จัดรถ</span>
          </div>
          ${(b.travelType === 'public_car' && l2SigImg) ? `<div style="font-size: 11.5px; color: #111; margin-top: 0.15rem; text-align: center;">( ${l2Sig.approverName} )</div>` : ''}
          <div style="color: #555; text-align: center; margin-top: 0.2rem; width: 100%; font-size: 10.5px;">
            วันที่ ${(b.travelType === 'public_car' && l2Sig.timestamp) ? l2Date : '............/............/............'}
          </div>
        </div>

        <div style="margin-top:0.8rem; line-height:1.6; border-top: 1px dashed #ccc; padding-top: 0.5rem;">
          <div style="font-weight: bold; margin-bottom: 0.25rem;">เสนอ ผฝ.บง.</div>
          เพื่อโปรดพิจารณาอนุญาตตามเสนอ
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; width: 100%;">
          <div style="display: flex; align-items: flex-end; gap: 0.25rem; width: 100%; justify-content: center; position: relative;">
            <span>ลงชื่อ</span>
            <div style="width: 150px; border-bottom: 1px dotted #000; position: relative; height: 35px; text-align: center;">
              ${(b.travelType === 'public_car' && l3SigImg) ? `<img src="${l3SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
            </div>
            <span>หส.พด.</span>
          </div>
          ${(b.travelType === 'public_car' && l3SigImg) ? `<div style="font-size: 11.5px; color: #111; margin-top: 0.15rem; text-align: center;">( ${l3Sig.approverName} )</div>` : ''}
          <div style="color: #555; text-align: center; margin-top: 0.2rem; width: 100%; font-size: 10.5px;">
            วันที่ ${(b.travelType === 'public_car' && l3Sig.timestamp) ? l3Date : '............/............/............'}
          </div>
        </div>

        <div style="margin-top:0.8rem; line-height:1.6; border-top: 1px dashed #ccc; padding-top: 0.5rem;">
          <span class="checkbox-box">${(b.travelType === 'public_car' && l4Sig.status === 'approved') ? '✓' : ''}</span> อนุญาต
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; width: 100%;">
          <div style="display: flex; align-items: flex-end; gap: 0.25rem; width: 100%; justify-content: center; position: relative;">
            <span>ลงชื่อ</span>
            <div style="width: 150px; border-bottom: 1px dotted #000; position: relative; height: 35px; text-align: center;">
              ${(b.travelType === 'public_car' && l4SigImg) ? `<img src="${l4SigImg}" style="max-height: 35px; max-width: 100%; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);">` : ''}
            </div>
            <span>ผฝ.บง.</span>
          </div>
          ${(b.travelType === 'public_car' && l4SigImg) ? `<div style="font-size: 11.5px; color: #111; margin-top: 0.15rem; text-align: center;">( ${l4Sig.approverName} )</div>` : ''}
          <div style="color: #555; text-align: center; margin-top: 0.2rem; width: 100%; font-size: 10.5px;">
            วันที่ ${(b.travelType === 'public_car' && l4Sig.timestamp) ? l4Date : '............/............/............'}
          </div>
        </div>
      </div>

    </div>

    <!-- REMARK FOOTER -->
    <div style="margin-top: 1.5rem; font-size: 11px; color: #555; line-height: 1.5; border-top: 1px dashed #bbb; padding-top: 0.5rem;">
      * หมายเหตุ: ลายมือชื่ออิเล็กทรอนิกส์และบันทึกข้อความได้รับการลงนามผ่านระบบยืนยันตัวตนดิจิทัลอย่างเป็นทางการตามมาตรฐาน FMO<br>
      * ลำดับขั้นตอนพิจารณาอนุมัติ 4 ขั้นตอน: 1. หัวหน้างาน, 2. งานจัดรถยนต์พัสดุ, 3. หัวหน้าแผนกพัสดุ (หส.พด.), 4. ผู้อำนวยการฝ่ายการเงินอนุมัติเบิกจ่าย (ผฝ.บง.)
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
          .page-break {
            page-break-before: always;
            break-before: page;
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
      page.setDefaultNavigationTimeout(10000);
      page.setDefaultTimeout(10000);

      try {
        await page.setContent(fullHTML, { waitUntil: 'domcontentloaded', timeout: 8000 });
      } catch (e) {
        console.warn(`[Puppeteer] setContent warning for ${b.id}:`, e.message);
      }

      await new Promise(r => setTimeout(r, 200));

      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
      });
    } finally {
      try { await page.close(); } catch(e) {}
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
