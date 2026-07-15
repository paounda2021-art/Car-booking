// FMO Car Booking Application Controller
// Helper to format Date/Time to Thai format with 24h time and " น." suffix
function formatThaiDateTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const dateStr = d.toLocaleDateString('th-TH', { dateStyle: 'short' });
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
  return `${dateStr} ${timeStr} น.`;
}

function formatThaiDateTimeLong(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const dateStr = d.toLocaleDateString('th-TH', { dateStyle: 'long' });
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
  return `${dateStr} ${timeStr} น.`;
}

function formatThaiTimeOnly(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.') + ' น.';
}

function formatThaiTimeOnlyNoSuffix(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
}

// Local data storage and state management
const DEFAULT_CARS = [
  { id: 'A', name: 'Toyota Commuter', type: 'รถตู้', plate: 'ฮษ 7446', status: 'available', icon: '🚐', driverName: 'นายชลาดล  ทองคำ', phone: '08-0992-3735' },
  { id: 'B', name: 'Toyota Commuter', type: 'รถตู้', plate: '1 นญ 1865 (เช่า)', status: 'available', icon: '🚐', driverName: 'นายสันติ สุธรรม', phone: '09-1021-4916' },
  { id: 'C', name: 'Toyota Commuter', type: 'รถตู้', plate: '1 นญ 2029 (เช่า)', status: 'available', icon: '🚐', driverName: 'นายคมกฤษ คุ้มชัย', phone: '09-4849-1122' },
  { id: 'D', name: 'Toyota Commuter', type: 'รถตู้', plate: 'ฮล 2521 (รถสวัสดิการ)', status: 'available', icon: '🚐', driverName: '', phone: '' }
];

let bookings = [];
let cars = [];
let usersList = [];
let currentUser = null;

// Calendar view state
let calCurrentDate = new Date();
let calFilterCar = 'all';

// Active booking ID for approval action
let activeBookingIdForApproval = null;

// Welfare Car driver license file upload state (base64)
let uploadedDriverLicenseBase64 = null;

// Simulated Email Notification logs
let emailLogs = JSON.parse(localStorage.getItem('email_logs_data') || '[]');

let isSystemActive = localStorage.getItem('system_active') === 'true';

let fpStart = null;
let fpEnd = null;

// Helper to open base64 files (PDF/images) in new tab safely using Blob URLs
function openBase64File(base64DataUrl, filenamePrefix = 'file') {
  try {
    const parts = base64DataUrl.split(';base64,');
    if (parts.length < 2) return;
    
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);
    
    const newTab = window.open(blobUrl, '_blank');
    if (!newTab) {
      const extension = contentType.split('/')[1] || 'pdf';
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${filenamePrefix}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error("Failed to open base64 file:", error);
    showToast("เกิดข้อผิดพลาดในการเปิดไฟล์เอกสาร", "error");
  }
}

// Helper to check if current user has already booked a Welfare Car in the fiscal year of the given date
function checkWelfareBookingLimit(startDateStr) {
  if (!startDateStr || !currentUser) return false;
  
  const getFiscalYear = (dateInput) => {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0 = Jan, 9 = Oct
    return m >= 9 ? y + 1 : y;
  };
  
  const targetFiscalYear = getFiscalYear(startDateStr);
  return bookings.some(b => {
    const emailMatches = (b.requesterEmail || '').toLowerCase() === (currentUser.email || '').toLowerCase();
    const isWelfare = b.controlUnit === 'รถสวัสดิการ';
    const isNotRejected = b.status !== 'rejected';
    const sameFiscalYear = getFiscalYear(b.startDate) === targetFiscalYear;
    return emailMatches && isWelfare && isNotRejected && sameFiscalYear;
  });
}

// Helper to look up driver's phone number by driver name
function getDriverPhoneByName(driverName) {
  if (!driverName || driverName === '-') return '';
  const searchName = driverName.replace(/\s+/g, '');
  const carObj = cars.find(c => c.driverName && c.driverName.replace(/\s+/g, '') === searchName);
  if (carObj && carObj.phone) return carObj.phone;
  const defaultCar = DEFAULT_CARS.find(c => c.driverName && c.driverName.replace(/\s+/g, '') === searchName);
  if (defaultCar && defaultCar.phone) return defaultCar.phone;
  return '';
}

// Helper to compress uploaded images via canvas to stay within storage limits
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 800;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Helper to dynamically resolve the manager email of a booking
function resolveManagerEmail(booking) {
  if (!booking) return 'ranida.c@fishmarket.co.th';
  
  // 1. If managerEmail is set and is NOT the fallback email 'ranida.c@fishmarket.co.th'
  if (booking.managerEmail && booking.managerEmail.trim() !== '' && booking.managerEmail !== 'ranida.c@fishmarket.co.th') {
    return booking.managerEmail;
  }
  
  // 2. Look up the requester in the usersList loaded from users.json
  if (typeof usersList !== 'undefined' && Array.isArray(usersList) && booking.requester) {
    const requesterName = booking.requester.trim();
    const userObj = usersList.find(u => 
      u.name.trim() === requesterName || 
      (booking.requesterEmail && u.email && u.email.toLowerCase() === booking.requesterEmail.toLowerCase())
    );
    if (userObj && userObj.manager_email && userObj.manager_email.trim() !== '') {
      return userObj.manager_email;
    }
  }
  
  // 3. Fallback: if booking has managerEmail, use it even if it is the fallback email
  if (booking.managerEmail && booking.managerEmail.trim() !== '') {
    return booking.managerEmail;
  }
  
  return 'ranida.c@fishmarket.co.th'; // Default fallback
}

// Helper to dynamically resolve the requester email of a booking
function resolveRequesterEmail(booking) {
  if (!booking) return 'ranida.c@fishmarket.co.th';
  if (booking.requesterEmail && booking.requesterEmail.trim() !== '' && booking.requesterEmail !== 'ranida.c@fishmarket.co.th') {
    return booking.requesterEmail;
  }
  if (typeof usersList !== 'undefined' && Array.isArray(usersList) && booking.requester) {
    const requesterName = booking.requester.trim();
    const userObj = usersList.find(u => u.name.trim() === requesterName);
    if (userObj && userObj.email && userObj.email.trim() !== '') {
      return userObj.email;
    }
  }
  if (booking.requesterEmail && booking.requesterEmail.trim() !== '') {
    return booking.requesterEmail;
  }
  return 'ranida.c@fishmarket.co.th';
}

// Asynchronous helper to send email notification via server-side API proxy
async function sendEmailNotification(toEmail, subject, htmlBody) {
  if (!toEmail) {
    console.warn("sendEmailNotification: No recipient specified. Skipping email send.");
    return;
  }
  
  // Format HTML body with clean styling matching the agency style
  const formattedHtml = `
    <div style="font-family: 'Sarabun', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #0f172a; margin: 0 0 5px 0; font-size: 20px;">ระบบจองใช้ยานพาหนะและเบิกจ่ายค่าพาหนะ</h2>
        <span style="color: #64748b; font-size: 13px;">องค์การสะพานปลา (FMO)</span>
      </div>
      <div style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        ${htmlBody}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.4;">
        อีเมลฉบับนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับอีเมลนี้<br>
        องค์การสะพานปลา &copy; 2026
      </div>
    </div>
  `;

  // Log simulated email alert in client UI
  emailLogs.unshift({
    timestamp: new Date().toISOString(),
    to: toEmail,
    subject: subject,
    body: formattedHtml
  });
  if (emailLogs.length > 30) {
    emailLogs = emailLogs.slice(0, 30);
  }
  localStorage.setItem('email_logs_data', JSON.stringify(emailLogs));
  updateEmailInboxUI();

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: toEmail,
        subject: subject,
        body: formattedHtml
      })
    });
    const data = await response.json();
    console.log("Email sent status:", data);
  } catch (error) {
    console.error("Failed to fetch email API:", error);
  }
}

// Premium Toast Notification Helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message ${type}`;

  // SVG Icons based on type
  let iconHtml = '';
  let titleText = 'แจ้งข้อมูล';

  if (type === 'success') {
    titleText = 'ทำรายการสำเร็จ';
    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`;
  } else if (type === 'error') {
    titleText = 'เกิดข้อผิดพลาด';
    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
  } else if (type === 'warning') {
    titleText = 'คำแนะนำ / แจ้งเตือน';
    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>`;
  } else {
    titleText = 'แจ้งเพื่อทราบ';
    iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.086 1.086L12.5 13.5a.75.75 0 11-1.086-1.086l.041-.02a.75.75 0 00-.205-.536z" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75a3 3 0 116 0 3 3 0 01-6 0z" /></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconHtml}</div>
    <div class="toast-content">
      <div class="toast-title">${titleText}</div>
      <div class="toast-desc">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Trigger Slide In
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  const closeToast = () => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    // Remove element after transition ends
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  };

  // Auto remove after 4.5 seconds
  const autoRemoveTimeout = setTimeout(closeToast, 4500);

  // Manual close click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(autoRemoveTimeout);
    closeToast();
  });
}

// Signature pad instances
let requesterSig = null;
let approverSig = null;

// Helper to format time relative to today
const formatTime = (hoursOffset, minVal = 0) => {
  const today = new Date();
  const d = new Date(today);
  d.setHours(d.getHours() + hoursOffset, minVal, 0, 0);
  return d.toISOString();
};

// Programmatic mock signature generator (draws cursive name on hidden canvas)
function generateMockSignature(name) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw stylish blue ink signature
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.font = 'italic 16px Sarabun, sans-serif';
    ctx.strokeText(name, 12, 28);
    
    // Draw a nice sweeping underline squiggle
    ctx.beginPath();
    ctx.moveTo(10, 32);
    ctx.quadraticCurveTo(45, 42, 140, 32);
    ctx.stroke();
    
    return canvas.toDataURL();
  } catch (e) {
    console.error("Failed to generate mock signature", e);
    return "";
  }
}

// Get signature image (database base64 or generated mock signature)
function getSignatureImg(level, signatureVal, approverName) {
  if (signatureVal && signatureVal.startsWith('data:image')) {
    return signatureVal;
  }
  
  let username = '';
  if (level === 1) username = 'prathum.c';
  else if (level === 2) username = 'chalong.c';
  else if (level === 3) username = 'saisunee.p';
  else if (level === 4) username = 'piyawan.k';
  
  if (username && typeof usersList !== 'undefined') {
    const u = usersList.find(x => x.username.toLowerCase() === username.toLowerCase());
    if (u && u.sign && u.sign.startsWith('data:image')) {
      return u.sign;
    }
  } else if (level === 0 && approverName && typeof usersList !== 'undefined') {
    const u = usersList.find(x => x.name.replace(/\s+/g, '') === approverName.replace(/\s+/g, ''));
    if (u && u.sign && u.sign.startsWith('data:image')) {
      return u.sign;
    }
  }
  
  return generateMockSignature(approverName || 'ลงนาม');
}

// Load initial database records from local storage and users.json
async function initDatabase() {
  // Load cars data
  const existingCars = localStorage.getItem('cars_data');
  if (existingCars) {
    try {
      const parsed = JSON.parse(existingCars);
      if (parsed.length < 4 || !parsed[0].hasOwnProperty('driverName') || existingCars.includes('Camry') || existingCars.includes('กข 1234')) {
        localStorage.removeItem('cars_data');
      }
    } catch(e) {
      localStorage.removeItem('cars_data');
    }
  }
  // Load default cars data if empty or contains Mojibake
  let carsData = localStorage.getItem('cars_data');
  if (carsData) {
    if (carsData.includes('เธ') || carsData.includes('เฏร') || carsData.includes('เน€') || carsData.includes('à¸')) {
      localStorage.removeItem('cars_data');
    }
  }
  if (!localStorage.getItem('cars_data')) {
    localStorage.setItem('cars_data', JSON.stringify(DEFAULT_CARS));
  }
  cars = JSON.parse(localStorage.getItem('cars_data'));

  // Load users from users.json
  try {
    const response = await fetch('users.json?v=2.9');
    usersList = await response.json();
  } catch (error) {
    console.error("Error loading users list from users.json:", error);
  }

  // Try to load bookings from Cloudflare KV database first
  let dbBookingsLoaded = false;
  try {
    const dbResponse = await fetch('/api/get-bookings');
    if (dbResponse.ok) {
      let dbBookings = await dbResponse.json();
      if (dbBookings && Array.isArray(dbBookings)) {
        // Extract system config row
        const systemConfig = dbBookings.find(b => b.id === 'system_config');
        isSystemActive = systemConfig ? (systemConfig.active === true || systemConfig.active === 'true') : false;
        localStorage.setItem('system_active', isSystemActive);
        dbBookings = dbBookings.filter(b => b.id !== 'system_config');

        // Self-cleaning: if KV database contains test mock bookings (e.g. BKG-FMO-001), wipe the database automatically!
        const hasMockData = dbBookings.some(b => b.id && b.id.startsWith('BKG-FMO-00'));
        if (hasMockData) {
          console.warn("Wiping test bookings from Cloudflare KV database...");
          await fetch('/api/save-bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([])
          });
          dbBookings = [];
        }
        localStorage.setItem('bookings_data', JSON.stringify(dbBookings));
        dbBookingsLoaded = true;
      }
    }
  } catch (error) {
    console.error("Failed to load bookings from Cloudflare KV database:", error);
  }

  // Clear simulated email logs for production
  // localStorage.removeItem('email_logs_data');
  // emailLogs = [];

  // Load default bookings mock data if empty or contains old spelling or Mojibake or JPEG signature format, or contains mock IDs
  let bookingsData = localStorage.getItem('bookings_data');
  if (bookingsData) {
    if (bookingsData.includes('ผักเจียมแว่น') || bookingsData.includes('à¸') || !bookingsData.includes('data:image/png;base64') || bookingsData.includes('เธ') || bookingsData.includes('เฏร') || bookingsData.includes('เน€') || bookingsData.includes('BKG-FMO-00')) {
      localStorage.removeItem('bookings_data');
    }
  }

  if (!localStorage.getItem('bookings_data')) {
    localStorage.setItem('bookings_data', JSON.stringify([]));
  }
  bookings = JSON.parse(localStorage.getItem('bookings_data'));

  // Migration: Add missing destination fields to sample bookings
  let bookingsUpdated = false;
  bookings.forEach(b => {
    if (!b.destination) {
      if (b.id === 'BKG-FMO-001') {
        b.destination = 'กรมสรรพากร';
        bookingsUpdated = true;
      } else if (b.id === 'BKG-FMO-002') {
        b.destination = 'ศูนย์ประมงสมุทรปราการ';
        bookingsUpdated = true;
      } else if (b.id === 'BKG-FMO-003') {
        b.destination = 'สำนักงานสรรพสามิต';
        bookingsUpdated = true;
      }
    }
    // Match mock requester names with official database 'น.ส.สิรัญญา  แหวนเพ็ชร'
    if (b.requester === 'ศิรัญญา วรวงศ์') {
      b.requester = 'น.ส.สิรัญญา  แหวนเพ็ชร';
      bookingsUpdated = true;
    }
    if (b.signatures) {
      b.signatures.forEach(sig => {
        if (sig.approverName === 'ศิรัญญา วรวงศ์') {
          sig.approverName = 'น.ส.สิรัญญา  แหวนเพ็ชร';
          bookingsUpdated = true;
        }
      });
    }
    // Fix department and division mapping if incorrectly set to old hardcoded defaults
    if (b.division === 'ฝ่ายบริหารงานทั่วไป' && b.department && b.department !== '-') {
      b.division = b.department;
      b.department = '-';
      bookingsUpdated = true;
    }
    // Migrate pending_l1 status to pending
    if (b.status === 'pending_l1') {
      b.status = 'pending';
      bookingsUpdated = true;
    }
  });

  // Fix driver and comments in existing BKG-FMO-001 if loaded
  bookings.forEach(b => {
    if (b.id === 'BKG-FMO-001') {
      if (b.driverName === 'นายดีเลิศ สมใจ') {
        b.driverName = 'นายชลาดล  ทองคำ';
        bookingsUpdated = true;
      }
      if (b.signatures) {
        b.signatures.forEach(sig => {
          if (sig.level === 2 && sig.driverName === 'นายดีเลิศ สมใจ') {
            sig.driverName = 'นายชลาดล  ทองคำ';
            sig.comment = 'จัดรถคันทะเบียน ฮษ 7446 คนขับ นายชลาดล  ทองคำ';
            bookingsUpdated = true;
          }
        });
      }
    }
  });

  if (!dbBookingsLoaded || bookingsUpdated) {
    saveBookings();
  }

  // Patch old email logs to add "สถานที่ปลายทาง" if missing, or convert "สถานที่ไป" to "สถานที่ปลายทาง"
  try {
    let rawLogs = localStorage.getItem('email_logs_data');
    if (rawLogs) {
      let logs = JSON.parse(rawLogs);
      let updated = false;
      logs.forEach(log => {
        if (log.body) {
          // 1. Convert old "สถานที่ไป:" to "สถานที่ปลายทาง:" if present
          if (log.body.includes('สถานที่ไป:')) {
            log.body = log.body.replace(/สถานที่ไป:/g, 'สถานที่ปลายทาง:');
            updated = true;
          }
          // 2. Add "สถานที่ปลายทาง:" if missing but has "ประเภทการเดินทาง:"
          if (log.body.includes('ประเภทการเดินทาง:') && !log.body.includes('สถานที่ปลายทาง:')) {
            let match = log.body.match(/BKG-FMO-\d+/);
            if (!match && log.subject) {
              match = log.subject.match(/BKG-FMO-\d+/);
            }
            let dest = '-';
            if (match) {
              const bId = match[0];
              const booking = bookings.find(b => b.id === bId);
              if (booking && booking.destination) {
                dest = booking.destination;
              }
            }
            const insertRow = `<tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${dest}</td></tr>`;
            log.body = log.body.replace('<tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:', insertRow + '\n          <tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:');
            updated = true;
          }

          // 3. Fix placeholder/empty destination cells (like '-' or 'undefined')
          if (log.body.includes('สถานที่ปลายทาง:')) {
            let match = log.body.match(/BKG-FMO-\d+/);
            if (!match && log.subject) {
              match = log.subject.match(/BKG-FMO-\d+/);
            }
            if (match) {
              const bId = match[0];
              const booking = bookings.find(b => b.id === bId);
              if (booking && booking.destination && booking.destination !== '-') {
                const regex = /(สถานที่ปลายทาง:<\/td><td style="padding: 6px 0;">)(?:-|undefined)?(<\/td>)/;
                if (regex.test(log.body)) {
                  log.body = log.body.replace(regex, `$1${booking.destination}$2`);
                  updated = true;
                }
              }
            }
          }

          // 4. Remove the green report button from old logs if present
          if (log.body.includes('พิมพ์ใบขอใช้รถ/ออกรายงาน')) {
            log.body = log.body.replace(/<div[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>\s*<a[^>]*>พิมพ์ใบขอใช้รถ\/ออกรายงาน<\/a>\s*<\/div>/gi, '');
            log.body = log.body.replace(/<div[^>]*style='[^']*text-align:\s*center[^']*'[^>]*>\s*<a[^>]*>พิมพ์ใบขอใช้รถ\/ออกรายงาน<\/a>\s*<\/div>/gi, '');
            log.body = log.body.replace(/<div[^>]*>\s*<a[^>]*>พิมพ์ใบขอใช้รถ\/ออกรายงาน<\/a>\s*<\/div>/gi, '');
            log.body = log.body.replace(/<a[^>]*>พิมพ์ใบขอใช้รถ\/ออกรายงาน<\/a>/gi, '');
            updated = true;
          }

          // 5. Change "วงเงินอนุมัติเบิกจ่าย: 600 บาท" to "วงเงินอนุมัติเบิกจ่าย: ไม่เกิน 600 บาท" in old logs
          if (log.body.includes('วงเงินอนุมัติเบิกจ่าย:') && !log.body.includes('ไม่เกิน')) {
            log.body = log.body.replace(/(วงเงินอนุมัติเบิกจ่าย:<\/td><td[^>]*>)\s*(\d+ บาท)/g, '$1ไม่เกิน $2');
            updated = true;
          }

          // 6. Change "รถยนต์ อสป." or "รถยนต์ อสป. ทะเบียน ..." to "รถตู้ อสป. ทะเบียน [ทะเบียน]" in old logs
          if (log.body.includes('ประเภทการเดินทาง:') && (log.body.includes('รถยนต์ อสป.') || log.body.includes('รถยนต์ อสป. ทะเบียน'))) {
            let match = log.body.match(/BKG-FMO-\d+/);
            if (!match && log.subject) {
              match = log.subject.match(/BKG-FMO-\d+/);
            }
            if (match) {
              const bId = match[0];
              const booking = bookings.find(b => b.id === bId);
              if (booking && booking.travelType === 'fmo_car') {
                let carObj = cars.find(c => c.id === booking.carId);
                if (!carObj && booking.driverName) {
                  carObj = cars.find(c => booking.driverName.includes(c.driverName));
                }
                const carPlate = carObj ? carObj.plate : '-';
                const regexType = /(ประเภทการเดินทาง:<\/td><td style="padding: 6px 0;">)(รถยนต์ อสป\.(?:\s*ทะเบียน\s*[^<]*)?)(<\/td>)/g;
                if (regexType.test(log.body)) {
                  log.body = log.body.replace(regexType, `$1รถตู้ อสป. ทะเบียน ${carPlate}$3`);
                  updated = true;
                }
              }
            }
          }

          // 7. Change change-allocation notification text from "รถยนต์ อสป. ทะเบียน" to "รถตู้ อสป. ทะเบียน"
          if (log.body.includes('รถยนต์ อสป. ทะเบียน')) {
            log.body = log.body.replace(/รถยนต์ อสป\. ทะเบียน/g, 'รถตู้ อสป. ทะเบียน');
            updated = true;
          }

          // 8. Patch the red button to have a link if it doesn't already have one, or if it is a button/div
          if (log.body.includes('กรอกรายละเอียดค่าพาหนะ')) {
            if (!log.body.includes('href="https://car-booking.fishmarket.co.th/"')) {
              // Replace any button or div tag wrapping "กรอกรายละเอียดค่าพาหนะ" with the <a> tag
              log.body = log.body.replace(
                /<(?:button|div|a)[^>]*>\s*กรอกรายละเอียดค่าพาหนะ\s*<\/(?:button|div|a)>/g,
                `<a href="https://car-booking.fishmarket.co.th/" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">กรอกรายละเอียดค่าพาหนะ</a>`
              );
              updated = true;
            }
          }

          // 9. Patch "พนักงานขับรถ:" in old logs to show phone number if missing
          if (log.body.includes('พนักงานขับรถ:')) {
            let match = log.body.match(/BKG-FMO-\d+/);
            if (!match && log.subject) {
              match = log.subject.match(/BKG-FMO-\d+/);
            }
            if (match) {
              const bId = match[0];
              const booking = bookings.find(b => b.id === bId);
              if (booking && booking.driverName && booking.driverName !== '-') {
                let carObj = cars.find(c => c.id === booking.carId);
                if (!carObj) {
                  carObj = cars.find(c => c.driverName && c.driverName.replace(/\s+/g, '') === booking.driverName.replace(/\s+/g, ''));
                }
                if (carObj && carObj.phone) {
                  const driverPhone = ` (โทร. ${carObj.phone})`;
                  const expectedText = `${booking.driverName}${driverPhone}`;
                  if (!log.body.includes(expectedText)) {
                    const regexDriver = new RegExp(`(พนักงานขับรถ:<\\/td><td[^>]*>)\\s*${booking.driverName.replace(/\s+/g, '\\s*')}\\s*(<\\/td>)`, 'g');
                    if (regexDriver.test(log.body)) {
                      log.body = log.body.replace(regexDriver, `$1${expectedText}$2`);
                      updated = true;
                    }
                  }
                }
              }
            }
          }
        }
      });
      if (updated) {
        localStorage.setItem('email_logs_data', JSON.stringify(logs));
        emailLogs = logs;
      }
    }
  } catch (e) {
    console.error("Error patching old email logs:", e);
  }
  checkSystemActivation();
}

// ==========================================
// 1. ฟังก์ชันบันทึกข้อมูล (เซฟลงเครื่องเพียวๆ 100%)
// ==========================================
async function saveBookings() {
  // 🛡️ เกราะป้องกันขั้นสุดยอด: ห้ามเอา 0 รายการไปเซฟทับข้อมูลเดิมเด็ดขาด!
  if (bookings.length === 0) {
    console.warn("🛑 บล็อกการทำงาน: ป้องกันการเซฟ 0 รายการทับข้อมูลเดิม!");
    return; // สั่งหยุดการทำงานทันที ไม่ให้มันเซฟลงเครื่อง
  }

  // ถ้ามีข้อมูล (มากกว่า 0) ค่อยให้เซฟลงเครื่อง
  localStorage.setItem('bookings_data', JSON.stringify(bookings));
  console.log("💾 บันทึกข้อมูลสำเร็จ! จำนวนทั้งหมด:", bookings.length, "รายการ");

  try {
    const payload = [...bookings];
    payload.push({
      id: 'system_config',
      requester: 'system',
      startDate: '',
      endDate: '',
      status: '',
      active: isSystemActive
    });

    // พยายามส่งไปบันทึกที่ฐานข้อมูล Cloudflare (API)
    await fetch('/api/save-bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log("☁️ บันทึกข้อมูลลงฐานข้อมูลคลาวด์ (Cloudflare KV) สำเร็จ!");
  } catch (error) {
    console.error("Failed to save bookings to Cloudflare KV database:", error);
  }
}

// ==========================================
// 2. ฟังก์ชันโหลดข้อมูล (ดึงจากเครื่องเพียวๆ 100%)
// ==========================================
function fetchBookings() {
  const savedData = localStorage.getItem('bookings_data');
  
  if (savedData && savedData !== 'undefined') {
    bookings = JSON.parse(savedData);
    console.log("📂 ดึงข้อมูลจากเครื่องสำเร็จ! จำนวน:", bookings.length, "รายการ");
  } else {
    bookings = [];
    console.log("📂 ยังไม่มีข้อมูลในระบบ เริ่มต้นใหม่ที่ 0 รายการ");
  }

  // โหลดเสร็จสั่งโชว์หน้าจอทันที
  updateStats();
  if (currentUser) {
    renderDashboard();
    renderBookingsLists();
    renderMonthCalendar();
  }
}
// Check for conflicting bookings for FMO cars
function hasBookingConflict(carId, startDateStr, endDateStr, excludeId = null) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  return bookings.some(b => {
    if (b.id === excludeId || b.status === 'rejected' || b.travelType !== 'fmo_car' || b.carId !== carId) return false;
    const bStart = new Date(b.startDate);
    const bEnd = new Date(b.endDate);
    return (start < bEnd && end > bStart);
  });
}

function loginUser(userObj) {
  if (!userObj) return;

 // 1. ดึงสิทธิ์จากตาราง/ฟังก์ชันกลาง
  assignUserPermissions(userObj);

  // =====================================================================
  // 🚨 ระบบผู้ช่วยอัจฉริยะ: ดักจับตำแหน่งอัตโนมัติ (ไม่ต้องไปแก้ฐานข้อมูล) 🚨
  // =====================================================================
  const positionText = userObj.position || '';
  const usernameLower = (userObj.username || '').toLowerCase();
  const isSpecialUser = ['saisunee.p', 'sarena.m', 'chalong.c', 'sakda.a', 'panadon.p', 'piyawan.k', 'jaruwan.s', 'supachai.j', 'patiyoot.k'].includes(usernameLower);
  
  // ถ้าในชื่อตำแหน่งมีคำว่า "หัวหน้าสำนักงาน", "หัวหน้าแผนก", "ร.หส.", หรือ "ร.หผ." ให้จัดการอัปเกรดเป็น L1 ทันที
  if (!isSpecialUser && (
    positionText.includes('หัวหน้าสำนักงาน') ||
    positionText.includes('หัวหน้าแผนก') ||
    positionText.includes('ร.หส.') ||
    positionText.includes('ร.หผ.')
  )) {
    if (!userObj.canApprove) {
      userObj.canApprove = [];
    }
    if (!userObj.canApprove.includes(1)) {
      userObj.canApprove.push(1); // แจกสิทธิ์ L1
    }
    userObj.role = 'supervisor'; // ปรับบทบาทเป็นหัวหน้างาน
  }
  // =====================================================================
  // 🚨 --- จบเงื่อนไขพิเศษ --- 🚨

  // 2. ตั้งค่าเริ่มต้นสำหรับบทบาท (Default คือ L0)
  let roleKey = 'requester';
  let roleName = 'ผู้เสนอขอจอง (L0)';

  // 3. คำนวณหาบทบาทหลัก (roleKey/roleName) อัตโนมัติจากสิทธิ์อนุมัติสูงสุดที่มีในตารางจริง
  if (userObj.canApprove && userObj.canApprove.length > 0) {
    let primaryLevel = Math.max(...userObj.canApprove);
    const username = (userObj.username || '').toLowerCase();
    if (username === 'saisunee.p') {
      primaryLevel = 3; // สายสุนีย์: สถานะหลักคือ L3
    } else if (username === 'sarena.m') {
      primaryLevel = 1; // ซารีนา: สถานะหลักคือ L1
    }

    if (primaryLevel === 1) {
      roleKey = 'supervisor';
      roleName = (username === 'jaruwan.s' || username === 'supachai.j' || username === 'patiyoot.k') ? 'ผู้เสนอขอจองและหัวหน้างาน (L0 & L1)' : 'หัวหน้าสำนักงาน/หัวหน้าแผนก (L1)';
    } else if (primaryLevel === 2) {
      roleKey = 'fleet_admin';
      roleName = username === 'sakda.a' ? 'ผู้เสนอขอจองและผู้จัดรถ (L0 & L2)' : 'ผู้จัดรถ / งานยานพาหนะ (L2)';
    } else if (primaryLevel === 3) {
      roleKey = 'director';
      roleName = username === 'panadon.p' ? 'ผู้เสนอขอจองและหัวหน้าสำนักงานบริหารการพัสดุ (L0 & L3)' : 'หัวหน้าสำนักงานบริหารการพัสดุ (หส.พด.) (L3)';
    } else if (primaryLevel === 4) {
      roleKey = 'executive';
      roleName = 'ผู้อำนวยการฝ่ายบัญชีการเงิน (ผฝ.บง.) (L4)';
    }
  } else {
    // Fallback หากไม่มีระบุในตารางสิทธิ์พิเศษ ให้เช็คตาม role เดิมของระบบ
    if (userObj.role === 'admin' || userObj.role === 'fleet_admin') {
      roleKey = 'fleet_admin';
      roleName = 'ผู้จัดรถ / งานยานพาหนะ (L2)';
    } else if (userObj.role === 'director') {
      roleKey = 'director';
      roleName = 'หัวหน้าสำนักงานบริหารการพัสดุ (หส.พด.) (L3)';
    } else if (userObj.role === 'executive') {
      roleKey = 'executive';
      roleName = 'ผู้อำนวยการฝ่ายบัญชีการเงิน (ผฝ.บง.) (L4)';
    } else if (userObj.role === 'supervisor') {
      roleKey = 'supervisor';
      roleName = 'หัวหน้าสำนักงาน/หัวหน้าแผนก (L1)';
    }
  }

  // 4. บันทึกข้อมูลเข้าสู่วัตถุหลัก currentUser ของระบบ
  currentUser = {
    employee_id: userObj.employee_id,
    username: userObj.username,
    name: userObj.name,
    position: userObj.position || 'เจ้าหน้าที่',
    department: userObj.department1 || userObj.department || 'ฝบร.',
    office: userObj.department2 || userObj.office || 'สกม.',
    division: userObj.department1 || userObj.division || userObj.department || 'ฝบร.',
    role: roleKey,
    roleName: roleName,
    canApprove: userObj.canApprove || [], // ส่งต่อรายการ L ที่อนุมัติได้ไปด้วย
    email: userObj.email || '',
    manager_email: userObj.manager_email || '',
    sign: userObj.sign || ''
  };

  // บันทึกลง LocalStorage
  localStorage.setItem('current_user', JSON.stringify(currentUser));
  
  // 5. ปรับเปลี่ยนหน้าจอซ่อนหน้า Login เปิดหน้าแอปพลิเคชัน
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');

  // 6. อัปเดตข้อมูลโปรไฟล์ผู้ใช้งานที่มุมขวาบน (Topbar)
  document.getElementById('user-display-name').textContent = currentUser.name;
  
  // คำนวณป้ายสิทธิ์หลักที่จะไปต่อท้ายชื่อตำแหน่ง
  let levelCode = '(L0)';
  if (currentUser.canApprove && currentUser.canApprove.length > 0) {
    let displayLevel = Math.max(...currentUser.canApprove);
    const username = (currentUser.username || '').toLowerCase();
    if (username === 'saisunee.p') {
      displayLevel = 3; // สายสุนีย์: สถานะหลักคือ L3
    } else if (username === 'sarena.m') {
      displayLevel = 1; // ซารีนา: สถานะหลักคือ L1
    }
    
    if (username === 'sakda.a') {
      levelCode = '(L0 & L2)';
    } else if (username === 'panadon.p') {
      levelCode = '(L0 & L3)';
    } else if (username === 'jaruwan.s' || username === 'supachai.j' || username === 'patiyoot.k') {
      levelCode = '(L0 & L1)';
    } else {
      levelCode = `(L${displayLevel})`;
    }
  }

  // 🚨 ท่าไม้ตาย: ดักจับก่อนแสดงผล ถ้าตำแหน่งมีคำว่า "หัวหน้าสำนักงาน", "หัวหน้าแผนก", "ร.หส.", หรือ "ร.หผ." บังคับเป็น L1 ทันที
  const isSpecialApprover = currentUser.username && ['saisunee.p', 'sarena.m', 'chalong.c', 'sakda.a', 'panadon.p', 'piyawan.k', 'jaruwan.s', 'supachai.j', 'patiyoot.k'].includes(currentUser.username.toLowerCase());
  if (!isSpecialApprover && currentUser.position && (
    currentUser.position.includes('หัวหน้าสำนักงาน') ||
    currentUser.position.includes('หัวหน้าแผนก') ||
    currentUser.position.includes('ร.หส.') ||
    currentUser.position.includes('ร.หผ.')
  )) {
    levelCode = '(L1)';
    currentUser.role = 'supervisor'; // บังคับเปลี่ยนบทบาท
    if (!currentUser.canApprove) currentUser.canApprove = [];
    if (!currentUser.canApprove.includes(1)) currentUser.canApprove.push(1);
  }

  document.getElementById('user-role-label').textContent = `${currentUser.position} ${levelCode}`;
  document.getElementById('user-avatar').textContent = currentUser.name.charAt(0);


  // 7. กำหนดค่าเริ่มต้นใส่ฟอร์มใบขอรถอัตโนมัติ
  document.getElementById('input-requester').value = currentUser.name;
  document.getElementById('input-position').value = currentUser.position;
  document.getElementById('input-department').value = '-';
  document.getElementById('input-office').value = currentUser.office;
  document.getElementById('input-division').value = currentUser.department;

  // 8. ควบคุมการเปิด-ปิด ตัวเลือกบทบาทอนุมัติ (Dropdown) และ ปุ่มเขียนใบขอรถ
  initApprovalSwitcher(); // ควบคุม Dropdown สลับบทบาท (จะทำงานเมื่อมีหลาย L)

  const btnOpenBooking = document.getElementById('btn-open-booking');
  // เช็คว่าคนนี้เป็นผู้อนุมัติระดับสูงล้วนๆ หรือไม่ (L3, L4 เท่านั้นและไม่มี L1 ปน)
  // แต่ยกเว้น พนาดร (panadon.p) ที่เป็น L0 และ L3 ทำให้ต้องเห็นปุ่มเขียนใบเสนอจอง
  const isOnlyHighLevelApprover = currentUser.canApprove.length > 0 && 
                                  currentUser.canApprove.every(lvl => lvl >= 3) && 
                                  (currentUser.username || '').toLowerCase() !== 'panadon.p';
  
  if (isOnlyHighLevelApprover) {
    btnOpenBooking.classList.add('hidden'); // ซ่อนปุ่มเขียนใบถาวรสำหรับ L3, L4
  } else {
    btnOpenBooking.classList.remove('hidden'); // พนักงานทั่วไป, L1 หรือ L2 สามารถเห็นปุ่มเขียนใบได้ปกติ
  }

  // ซ่อนปุ่มเข้าสู่ระบบ / แสดงการ์ดโปรไฟล์
  document.getElementById('btn-top-login').classList.add('hidden');
  document.getElementById('header-user-profile').classList.remove('hidden');
  
  // แสดงปุ่มปิดระบบชั่วคราวเฉพาะ ranida.c
  const btnDeactivate = document.getElementById('btn-deactivate-system');
  if (btnDeactivate) {
    if (usernameLower === 'ranida.c') {
      btnDeactivate.classList.remove('hidden');
    } else {
      btnDeactivate.classList.add('hidden');
    }
  }

  // 9. รันฟังก์ชันคำนวณสถิติและโหลดตารางหน้าจอต่างๆ
  populateCarsDropdown();
  updateStats();
  renderDashboard();
  renderBookingsLists();
  renderMonthCalendar();

  // 10. จัดการสิทธิ์การมองเห็นเมนูด้านซ้าย (Sidebar Redirection)
  const isRequesterOrSupervisor = (currentUser.role === 'requester' || currentUser.role === 'supervisor');
  const reportNavItem = document.getElementById('nav-item-driver-report');
  
  if (isRequesterOrSupervisor && !currentUser.canApprove.includes(4)) { 
    // หากเป็นคนขอทั่วไป หรือหัวหน้างาน L1 (แต่ต้องไม่ใช่รักษาการ L4 แบบคุณซารีนา) ให้ซ่อนแดชบอร์ดวิ่งไปหน้าประวัติแทน
    document.getElementById('nav-dashboard').closest('.nav-item').classList.add('hidden');
    document.getElementById('nav-bookings').closest('.nav-item').classList.remove('hidden');
    document.getElementById('nav-calendar').closest('.nav-item').classList.remove('hidden');
    if (reportNavItem) reportNavItem.classList.add('hidden');
    showView('bookings');
  } else {
    // ผู้จัดรถ (L2), ผอ.พัสดุ (L3), ผู้บริหาร (L4) ให้เข้าถึงหน้าแดชบอร์ดภาพรวมได้
    document.getElementById('nav-dashboard').closest('.nav-item').classList.remove('hidden');
    document.getElementById('nav-bookings').closest('.nav-item').classList.remove('hidden');
    document.getElementById('nav-calendar').closest('.nav-item').classList.remove('hidden');
    if (reportNavItem) {
      if (currentUser.role === 'fleet_admin') {
        reportNavItem.classList.remove('hidden');
        populateDriversDropdown(); // โหลดข้อมูลพนักงานขับรถเฉพาะ L2
      } else {
        reportNavItem.classList.add('hidden');
      }
    }
    
    // หากมีรายการรออนุมัติสำหรับผู้ใช้คนนี้ (L2, L3, L4) ให้พาไปยังหน้า "งานรออนุมัติจากคุณ" ในหน้า bookings
    const pendingTasks = getMyPendingTasksList();
    if (pendingTasks && pendingTasks.length > 0) {
      showView('bookings');
    } else {
      showView('dashboard');
    }
  }
}

// ==========================================
// ระบบออกจากระบบ (Logout) แบบรัดกุม 100%
// ==========================================
const logoutBtn = document.getElementById('btn-logout');

if (logoutBtn) {
  // ใช้ onclick เพื่อบังคับทับคำสั่งเก่า ป้องกันการกดแล้วทำงานซ้อนกัน
  logoutBtn.onclick = function() {
    
    // 1. ล้างข้อมูลผู้ใช้ออกจากหน่วยความจำเบราว์เซอร์
    localStorage.removeItem('current_user');
    sessionStorage.removeItem('activeApprovalLevel');
    currentUser = null;

    // 2. สั่งซ่อนโปรไฟล์และกล่อง Dropdown ทันที (ให้หน้าจอสะอาดที่สุด)
    const headerProfile = document.getElementById('header-user-profile');
    if (headerProfile) {
      headerProfile.classList.add('hidden');
    }
    
    const approvalContainer = document.getElementById('approval-level-container');
    if (approvalContainer) {
      approvalContainer.style.display = 'none';
      approvalContainer.classList.add('hidden');
    }

    // 3. ท่าไม้ตาย: สั่งรีเฟรชหน้าเว็บเพื่อกลับสู่หน้าแรก (บุคคลทั่วไป)
    window.location.reload();
  };
}



async function clearDatabase() {
  // 1. แจ้งเตือนยืนยันให้ชัดเจน
  if (confirm("⚠️ อันตราย: คุณกำลังจะล้าง 'ข้อมูลการจองทั้งหมด' และ 'ประวัติอีเมลจำลอง' ออกจากระบบ!\n\nการกระทำนี้จะส่งผลกับผู้ใช้งานทุกคน และไม่สามารถกู้คืนข้อมูลกลับมาได้\nคุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?")) {
    
    // 2. ล้างตัวแปรและข้อมูลใน LocalStorage ฝั่งหน้าเว็บ
    bookings = [];
    emailLogs = [];
    localStorage.removeItem('bookings_data');
    localStorage.removeItem('email_logs_data');
    localStorage.removeItem('deleted_email_logs');
    
    // ล้างค่าสถานะการสลับบทบาทอนุมัติ (Dropdown) ที่ค้างอยู่
    sessionStorage.removeItem('activeApprovalLevel'); 

    // 3. แสดงข้อความแจ้งเตือนระหว่างรอ
    showToast("กำลังล้างข้อมูลระบบ...", "warning");
    
    // 4. ส่งคำสั่งไปล้างข้อมูลในฐานข้อมูล (Cloudflare KV / Server)
    try {
      const response = await fetch('/api/save-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([]) // ส่ง Array ว่างไปทับข้อมูลเดิม
      });
      
      if (response.ok) {
        showToast("ล้างข้อมูลสำเร็จแล้ว! กำลังโหลดระบบใหม่...", "success");
        
        // 5. โหลดหน้าเว็บใหม่เพื่อให้ระบบรับค่าที่ว่างเปล่าไปแสดงผล
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast("ไม่สามารถล้างข้อมูลในระบบ Cloudflare KV ได้", "error");
      }
    } catch (error) {
      console.error("Failed to clear bookings in KV namespace:", error);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล", "error");
    }
  }
}

function checkLoginStatus() {
  const cached = localStorage.getItem('current_user');
  if (cached) {
    if (cached.includes('à¸') || cached.includes('เจียมผักแว่น')) {
      localStorage.removeItem('current_user');
      currentUser = null;
      window.location.reload();
      return;
    }
    let parsed = JSON.parse(cached);
    if (usersList && usersList.length > 0) {
      const dbUser = usersList.find(u => u.username.toLowerCase() === parsed.username.toLowerCase());
      if (dbUser) {
        loginUser(dbUser);
        showView('calendar');
        return;
      }
    }
    loginUser(parsed);
    showView('calendar');
  } else {
    // Guest mode: land on calendar, hide dashboard and bookings, show login button
    currentUser = null;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    
    // Sidebar items visibility
    document.getElementById('nav-dashboard').closest('.nav-item').classList.add('hidden');
    document.getElementById('nav-bookings').closest('.nav-item').classList.add('hidden');
    document.getElementById('nav-calendar').closest('.nav-item').classList.remove('hidden');
    const reportNavItem = document.getElementById('nav-item-driver-report');
    if (reportNavItem) reportNavItem.classList.add('hidden');
    
    // Header actions
    document.getElementById('btn-top-login').classList.remove('hidden');
    document.getElementById('header-user-profile').classList.add('hidden');
    document.getElementById('btn-open-booking').classList.add('hidden');

    
    // Populate dropdown and render views
    populateCarsDropdown();
    updateStats();
    renderMonthCalendar();
    
    showView('calendar');
  }
}

function populateCarsDropdown() {
  const select = document.getElementById('select-car');
  if (select) {
    select.innerHTML = '<option value="">-- กรุณาเลือกรถยนต์ --</option>';
    cars.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.name} (${c.plate})</option>`;
    });
  }

  const filterCalCar = document.getElementById('filter-cal-car');
  if (filterCalCar) {
    filterCalCar.innerHTML = '<option value="all">รถยนต์ทั้งหมด</option>';
    cars.forEach(c => {
      filterCalCar.innerHTML += `<option value="${c.id}">${c.name} (${c.plate})</option>`;
    });
    filterCalCar.innerHTML += '<option value="public">รถรับจ้างสาธารณะ</option>';
  }
}

// Navigation / View management
const views = ['dashboard', 'bookings', 'calendar', 'report', 'driver-report'];
function showView(viewName) {
  // Protect dashboard view from unauthorized roles and guests
  if (!currentUser && viewName === 'dashboard') {
    viewName = 'calendar';
  } else if (currentUser && (currentUser.role === 'requester' || (currentUser.role === 'supervisor' && !currentUser.canApprove.includes(4))) && viewName === 'dashboard') {
    viewName = 'bookings';
  }

  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewName) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  // Nav menu class toggling
  const navItems = ['dashboard', 'bookings', 'calendar', 'driver-report'];
  navItems.forEach(n => {
    const link = document.getElementById(`nav-${n}`);
    if (link) {
      if (n === viewName) link.classList.add('active');
      else link.classList.remove('active');
    }
  });

  // Update top bar text based on active view
  const title = document.getElementById('view-title');
  const subtitle = document.getElementById('view-subtitle');
  if (viewName === 'dashboard') {
    title.textContent = 'ภาพรวมระบบ';
    subtitle.textContent = 'ระบบจองรถยนต์และขออนุมัติเบิกจ่ายตามฟอร์ม องค์การสะพานปลา';
  } else if (viewName === 'bookings') {
    title.textContent = 'รายการจองรถยนต์';
    subtitle.textContent = 'จัดการ อนุมัติ และติดตามความคืบหน้าคำขอทั้งหมด';
  } else if (viewName === 'calendar') {
    title.textContent = 'ปฏิทินปฏิบัติงานใช้รถ';
    subtitle.textContent = 'ตารางเวลาปฏิบัติงานและการจองใช้ยานพาหนะของ อสป.';
  } else if (viewName === 'driver-report') {
    title.textContent = 'รายงานการปฏิบัติงาน พขร.';
    subtitle.textContent = 'ตรวจสอบสถิติ สรุปผลงาน และสั่งพิมพ์รายงานการใช้รถของ พขร. รายวัน/สัปดาห์/เดือน';
  }
}

// Update stats on Dashboard
function updateStats() {
  autoGenerateMissingEmailLogs();
  const statTotalCars = document.getElementById('stat-total-cars');
  const statAvailCars = document.getElementById('stat-avail-cars');
  const statPending = document.getElementById('stat-pending-approvals');
  const statTotalBkg = document.getElementById('stat-total-bookings');

  if (statTotalCars) statTotalCars.textContent = `${cars.length} คัน`;
  
  const now = new Date();
  const busyCarIds = bookings
    .filter(b => (b.status === 'approved' || (b.status.startsWith('pending') && b.currentApprovalLevel >= 3)) && b.travelType === 'fmo_car' && new Date(b.startDate) <= now && new Date(b.endDate) >= now)
    .map(b => b.carId);
  const availCount = cars.filter(c => !busyCarIds.includes(c.id)).length;
  if (statAvailCars) statAvailCars.textContent = `${availCount} คัน`;

  // 1. ดึงระดับการอนุมัติที่เลือกจาก Dropdown ปัจจุบัน (ค่าเริ่มต้นคือ 'all')
  const activeLevel = sessionStorage.getItem('activeApprovalLevel') || 'all';
  let pendingCount = 0;

  if (currentUser) {
    bookings.forEach(b => {
      // 🚨 จุดที่แก้ไข: เปลี่ยนเป็นเช็คว่าสถานะ "ขึ้นต้นด้วย pending" (รองรับ pending_l1, pending_l2)
      if (b.status.startsWith('pending') && !b.waitingForRequesterInput) {
        
        // ตรวจสอบว่า งานเลเวลนี้ (b.currentApprovalLevel) อยู่ในสิทธิ์ที่ User คนนี้อนุมัติได้จริงไหม
        const canApproveThisLevel = currentUser.canApprove && currentUser.canApprove.includes(b.currentApprovalLevel);
        
        // ตรวจสอบว่า ตรงกับระดับอนุมัติที่เลือกสลับบทบาทใน Dropdown อยู่หรือไม่
        const isSelectedLevel = (activeLevel === 'all' || parseInt(activeLevel) === b.currentApprovalLevel);

        if (canApproveThisLevel && isSelectedLevel) {
          // เงื่อนไขคัดกรองพิเศษเพิ่มเติมสำหรับระดับ L1 (Supervisor)
          if (b.currentApprovalLevel === 1) {
            const mEmail = resolveManagerEmail(b).toLowerCase();
            const cEmail = (currentUser.email || '').toLowerCase();
            if (mEmail === cEmail || mEmail === '') {
              pendingCount++;
            }
          } 
          // เงื่อนไขสำหรับระดับ L2, L3, L4 (ยึดตาม Dropdown ที่เลือกได้ทันที)
          else {
            pendingCount++;
          }
        }
      }
    });
  }

  // 2. อัปเดตตัวเลขแสดงผลใน Dashboard และแท็บต่างๆ
  if (statPending) statPending.textContent = `${pendingCount} รายการ`;
  if (statTotalBkg) statTotalBkg.textContent = `${bookings.length} รายการ`;

  const pendingBadge = document.getElementById('pending-badge-count');
  const tabPendingBadge = document.getElementById('tab-pending-count');
  if (pendingBadge) pendingBadge.textContent = pendingCount;
  if (tabPendingBadge) tabPendingBadge.textContent = pendingCount;

  // 3. เพิ่มการอัปเดตตัวเลขแจ้งเตือนสีแดงที่กระดิ่ง
  // (น้องเน็ตดักจับคลาส .notification-badge เผื่อไว้ให้ด้วย ป้องกันกระดิ่งไม่ยอมโชว์)
  const emailBadge = document.getElementById('email-inbox-badge') || document.querySelector('.notification-badge');
  if (emailBadge) {
    const activeLogs = getActiveEmailLogs();
    const count = activeLogs.length;
    emailBadge.textContent = count;
    emailBadge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  // 4. คำนวณจำนวนรายการที่ฉันขอ (L0) - เพิ่มการดักด้วยอีเมลให้แม่นยำขึ้น
  let myCount = 0;
  if (currentUser) {
    myCount = bookings.filter(b => (b.requesterEmail && b.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) || b.requester === currentUser.name).length;
  }
  const tabMyCountBadge = document.getElementById('tab-my-bookings-count');
  if (tabMyCountBadge) tabMyCountBadge.textContent = myCount;

  const tabAllHistoryBadge = document.getElementById('tab-all-history-count');
  if (tabAllHistoryBadge) {
    const historyCount = bookings.filter(b => {
      if (b.status !== 'approved' && b.status !== 'rejected') return false;
      const isMyRequest = currentUser && (
        (b.requesterEmail && b.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) || 
        b.requester === currentUser.name
      );
      const canSeeAll = currentUser && (
        currentUser.role === 'fleet_admin' || 
        currentUser.role === 'director' || 
        currentUser.role === 'executive'
      );
      return (canSeeAll || isMyRequest);
    }).length;
    tabAllHistoryBadge.textContent = historyCount;
  }
}
function renderDashboard() {
  updateStats();

  const carListContainer = document.getElementById('car-list-container');
  if (!carListContainer) return;
  carListContainer.innerHTML = '';

  const now = new Date();

  cars.forEach(car => {
    // Find if car has an active booking right now (approved OR pending-assigned by L2)
    const activeBkg = bookings.find(b => {
      const isAssigned = b.status === 'approved' || (b.status.startsWith('pending') && b.currentApprovalLevel >= 3);
      if (!isAssigned || b.travelType !== 'fmo_car' || b.carId !== car.id) return false;
      return new Date(b.startDate) <= now && new Date(b.endDate) >= now;
    });

    const isAvailable = !activeBkg;
    let cardClass = 'car-card available';
    let badgeText = '🟢 ว่าง';
    let badgeClass = 'car-status-badge status-avail';
    let statusDesc = 'ว่างพร้อมปฏิบัติหน้าที่';
    let actionBtnHtml = '';

    if (activeBkg) {
      const isApproved = activeBkg.status === 'approved';
      cardClass = isApproved ? 'car-card occupied' : 'car-card occupied pending-res';
      badgeText = isApproved ? '🔴 ปฏิบัติงาน' : '🟡 จองแล้ว (รออนุมัติ)';
      badgeClass = isApproved ? 'car-status-badge status-busy' : 'car-status-badge status-pending';
      statusDesc = isApproved ? `ไม่ว่าง (เรื่อง: ${activeBkg.purpose})` : `จองล่วงหน้า (เรื่อง: ${activeBkg.purpose})`;

      const isL2 = currentUser && currentUser.role === 'fleet_admin';
      if (isL2 && isApproved) {
        actionBtnHtml = `
          <button class="btn btn-warning btn-sm btn-return-early" data-booking-id="${activeBkg.id}" style="width: 100%; margin-top: 0.5rem; font-size: 0.75rem; padding: 0.25rem 0.5rem;">
            เปลี่ยนเป็นว่าง (คืนรถก่อนเวลา)
          </button>
        `;
      }
    }

    const card = document.createElement('div');
    card.className = cardClass;
    card.innerHTML = `
      <div class="car-card-header">
        <span class="car-icon">${car.icon}</span>
        <span class="${badgeClass}">${badgeText}</span>
      </div>
      <div class="car-details">
        <h3>${car.name}</h3>
        <p class="car-plate">ทะเบียน: <strong>${car.plate}</strong></p>
        <p class="car-type">ประเภท: ${car.type}</p>
        ${car.driverName ? `
          <p class="car-driver">คนขับ: <strong>${car.driverName}</strong></p>
          ${car.phone ? `<p class="car-phone">เบอร์โทร: <strong>${car.phone}</strong></p>` : ''}
        ` : ''}
        <p class="car-status-desc">${statusDesc}</p>
        ${actionBtnHtml}
      </div>
    `;
    carListContainer.appendChild(card);
  });

  renderTimelineScheduler();
}

// Render horizontal Scheduler timeline visual list
function renderTimelineScheduler() {
  const container = document.getElementById('timeline-scheduler-container');
  if (!container) return;
  container.innerHTML = '';

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const timelineStart = new Date(todayStart);
  timelineStart.setHours(8, 0, 0, 0);

  const timelineEnd = new Date(timelineStart);
  timelineEnd.setHours(timelineStart.getHours() + 24);

  let html = `
    <div class="timeline-scroll-wrapper" style="overflow-x: auto; width: 100%;">
      <table class="timeline-table" style="min-width: 1200px; width: 100%; border-collapse: collapse; margin-top: 1rem;">
        <thead>
          <tr>
            <th style="width: 16%; text-align: left; padding: 0.75rem 0.75rem 0.75rem 1.5rem; border-bottom: 2px solid var(--border-color);">ยานพาหนะ</th>
  `;

  for (let i = 0; i < 24; i++) {
    const hour = (8 + i) % 24;
    const label = `${String(hour).padStart(2, '0')}:00`;
    html += `<th style="width: 3.5%; text-align: left; font-size: 0.8rem; padding: 0.75rem 0.25rem; border-bottom: 2px solid var(--border-color); color: var(--text-muted);">${label}</th>`;
  }

  html += `
          </tr>
        </thead>
        <tbody>
  `;

  cars.forEach(car => {
    const carBookings = bookings.filter(b => {
      const isAssigned = b.status === 'approved' || (b.status.startsWith('pending') && b.currentApprovalLevel >= 3);
      return b.travelType === 'fmo_car' && b.carId === car.id && isAssigned;
    });

    const todayBookings = carBookings.filter(b => {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      return bStart <= timelineEnd && bEnd >= timelineStart;
    });

    let bookingBarsHtml = '';

    todayBookings.forEach(b => {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);

      const barStart = bStart < timelineStart ? timelineStart : bStart;
      const barEnd = bEnd > timelineEnd ? timelineEnd : bEnd;

      if (barStart < barEnd) {
        const startOffsetMin = (barStart - timelineStart) / 60000;
        const durationMin = (barEnd - barStart) / 60000;

        const leftPercent = (startOffsetMin / 1440) * 100;
        const widthPercent = (durationMin / 1440) * 100;

        let badgeClass = 'timeline-badge';
        if (b.status === 'approved') badgeClass += ' approved';
        else if (b.status === 'pending') badgeClass += ' pending';

        const sh = formatThaiTimeOnlyNoSuffix(b.startDate);
        const eh = formatThaiTimeOnlyNoSuffix(b.endDate);

        bookingBarsHtml += `
          <div class="${badgeClass}" onclick="openApprovalModal('${b.id}')" title="${b.purpose} (${sh} - ${eh}) ผู้จอง: ${b.requester}" style="position: absolute; left: ${leftPercent}%; width: ${widthPercent}%; top: 50%; transform: translateY(-50%); height: 38px; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; line-height: 1.2; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: pointer; display: flex; flex-direction: column; justify-content: center; box-shadow: var(--shadow-sm); z-index: 2;">
            <strong style="color: var(--text-main); text-overflow: ellipsis; overflow: hidden; display: block;">${b.purpose}</strong>
            <span style="color: var(--text-muted); font-size: 0.65rem;">${sh}-${eh} (${b.requester})</span>
          </div>
        `;
      }
    });

    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 0.75rem 0.75rem 0.75rem 1.5rem; vertical-align: middle; width: 16%;">
          <strong>${car.name}</strong><br>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${car.plate} (${car.type})</span>
        </td>
        <td colspan="24" style="padding: 0; position: relative; height: 60px; vertical-align: middle;">
          <!-- Background gridlines -->
          <div style="display: flex; position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
    `;

    for (let i = 0; i < 24; i++) {
      if (i < 23) {
        html += `<div style="flex: 1; border-right: 1px dashed var(--border-color); height: 100%;"></div>`;
      } else {
        html += `<div style="flex: 1; height: 100%;"></div>`;
      }
    }

    html += `
          </div>
          <!-- Booking bars -->
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
            ${bookingBarsHtml}
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// Global view layout state for booking lists
let bookingViewLayout = localStorage.getItem('bookingViewLayout') || 'card';

function setBookingViewLayout(layout) {
  bookingViewLayout = layout;
  localStorage.setItem('bookingViewLayout', layout);
  
  // Sync toggle button styles
  const cardBtn = document.getElementById('btn-view-card');
  const tableBtn = document.getElementById('btn-view-table');
  if (cardBtn && tableBtn) {
    if (layout === 'card') {
      cardBtn.classList.add('active');
      cardBtn.style.background = 'var(--primary)';
      cardBtn.style.color = 'white';
      
      tableBtn.classList.remove('active');
      tableBtn.style.background = 'transparent';
      tableBtn.style.color = 'var(--text-muted)';
    } else {
      tableBtn.classList.add('active');
      tableBtn.style.background = 'var(--primary)';
      tableBtn.style.color = 'white';
      
      cardBtn.classList.remove('active');
      cardBtn.style.background = 'transparent';
      cardBtn.style.color = 'var(--text-muted)';
    }
  }
  
  renderBookingsLists();
}

function helperCreateTableRow(b, isPendingForMe) {
  let statusClass = 'warning';
  let statusText = `รออนุมัติ (L${b.currentApprovalLevel})`;
  if (b.waitingForRequesterInput) {
    statusClass = 'danger';
    statusText = '⏳ รอระบุค่าพาหนะ';
  } else if (b.status === 'approved') {
    statusClass = 'success';
    statusText = 'อนุมัติเสร็จสิ้น';
  } else if (b.status === 'rejected') {
    statusClass = 'danger';
    statusText = 'ปฏิเสธคำขอ';
  }

  const startDateStr = formatThaiDateTime(b.startDate);
  const endDateStr = formatThaiDateTime(b.endDate);
  
  let infoStr = '';
  if (b.travelType === 'fmo_car') {
    const carObj = cars.find(c => c.id === b.carId);
    const prefix = b.controlUnit === 'รถสวัสดิการ' ? '🚗 [รถสวัสดิการ]' : '🚗 ใช้รถยนต์ อสป.';
    infoStr = `${prefix}: <strong>${carObj ? carObj.name : 'ไม่ระบุ'}</strong> (ทะเบียน ${carObj ? carObj.plate : '-'})`;
    if (b.driverName && b.driverName !== '-') {
      const phone = getDriverPhoneByName(b.driverName);
      const phoneStr = phone ? ` (โทร: ${phone})` : '';
      infoStr += `<br>👤 พขร.: <strong>${b.driverName}</strong>${phoneStr}`;
    }
  } else {
    infoStr = `🚐 ใช้รถรับจ้างสาธารณะ: ระยะทาง ${b.distance} กม. (ประมาณราคา ${b.price} บาท)`;
  }

  const directionStr = `<span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.2rem;">[ทิศทาง: ${b.goCheck ? 'ไป' : ''}${b.goCheck && b.backCheck ? '-' : ''}${b.backCheck ? 'กลับ' : ''}]</span>`;
  const actionBtnText = isPendingForMe ? '✍️ พิจารณา' : '👁️ ดูรายละเอียด';
  const actionBtnClass = isPendingForMe ? 'btn-warning' : 'btn-primary';
  
  const isAdmin = currentUser && (currentUser.role === 'fleet_admin' || currentUser.role === 'director' || currentUser.role === 'executive');
  const printBtn = (b.status === 'approved' && isAdmin)
    ? `<button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="event.stopPropagation(); openReportView('${b.id}')">🖨️ ออกรายงาน</button>`
    : '';

  let stepsDots = '';
  const maxSteps = 4;
  for (let i = 1; i <= maxSteps; i++) {
    let dotClass = 'step-dot';
    if (b.currentApprovalLevel > i) dotClass += ' completed';
    else if (b.currentApprovalLevel === i && b.status === 'pending') dotClass += ' active';
    else if (b.status === 'rejected' && b.currentApprovalLevel === i) dotClass += ' rejected';
    stepsDots += `<span class="${dotClass}" title="สายอนุมัติที่ ${i}"></span>`;
  }

  let fillTaxiBtn = '';
  if (b.waitingForRequesterInput && currentUser && b.requester === currentUser.name) {
    fillTaxiBtn = `<button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="event.stopPropagation(); openFillTaxiModal('${b.id}')">✍️ กรอกค่าพาหนะ</button>`;
  }

  return `
    <tr style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: var(--transition-smooth);" onclick="openApprovalModal('${b.id}')" class="booking-table-row">
      <td style="padding: 0.75rem 1rem; font-weight: bold; color: var(--primary); white-space: nowrap;">${b.id}</td>
      <td style="padding: 0.75rem 1rem;">
        <div style="font-weight: 600;">${b.requester}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${b.office || b.position || ''}</div>
      </td>
      <td style="padding: 0.75rem 1rem; max-width: 250px;">
        <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${b.purpose}</div>
      </td>
      <td style="padding: 0.75rem 1rem; font-size: 0.85rem;">
        <div>${infoStr}</div>
        ${directionStr}
      </td>
      <td style="padding: 0.75rem 1rem; font-size: 0.8rem; white-space: nowrap;">
        <div>⏰ ${startDateStr}</div>
        <div>ถึง ${endDateStr}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${b.trips} เที่ยว</div>
      </td>
      <td style="padding: 0.75rem 1rem; text-align: center; vertical-align: middle;">
        <div style="margin-bottom: 0.35rem;"><span class="badge ${statusClass}">${statusText}</span></div>
        <div class="approval-steps-indicator" style="justify-content: center; gap: 0.25rem;">${stepsDots}</div>
      </td>
      <td style="padding: 0.75rem 1rem; text-align: right;">
        <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center;">
          ${printBtn}
          ${fillTaxiBtn}
          <button class="btn ${actionBtnClass} btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">${actionBtnText}</button>
        </div>
      </td>
    </tr>
  `;
}

// Render Bookings Lists (Tabs)
function renderBookingsLists() {
  // Show export button only for L2 (fleet_admin)
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    if (currentUser && currentUser.role === 'fleet_admin') {
      exportBtn.classList.remove('hidden');
    } else {
      exportBtn.classList.add('hidden');
    }
  }

  // Force card view layout
  bookingViewLayout = 'card';

  const pendingTabBtn = document.querySelector('.tab-btn[data-tab="tab-pending-approvals"]');
  const myBkgTabBtn = document.querySelector('.tab-btn[data-tab="tab-my-bookings"]');

  if (pendingTabBtn) {
    if (currentUser && currentUser.role === 'requester') {
      pendingTabBtn.classList.add('hidden');
      if (pendingTabBtn.classList.contains('active')) {
        pendingTabBtn.classList.remove('active');
        if (myBkgTabBtn) myBkgTabBtn.classList.add('active');
        document.getElementById('tab-pending-approvals').classList.remove('active');
        const myBkgTab = document.getElementById('tab-my-bookings');
        if (myBkgTab) myBkgTab.classList.add('active');
      }
    } else {
      pendingTabBtn.classList.remove('hidden');
      // สลับหน้าจอมาที่ Tab งานรออนุมัติอัตโนมัติ หากเป็นผู้อนุมัติและมีงานค้าง
      const pendingBadgeVal = document.getElementById('tab-pending-count');
      if (pendingBadgeVal && parseInt(pendingBadgeVal.textContent) > 0 && !pendingTabBtn.classList.contains('active')) {
        if (myBkgTabBtn) myBkgTabBtn.classList.remove('active');
        pendingTabBtn.classList.add('active');
        const myBkgTab = document.getElementById('tab-my-bookings');
        if (myBkgTab) myBkgTab.classList.remove('active');
        const pendingTab = document.getElementById('tab-pending-approvals');
        if (pendingTab) pendingTab.classList.add('active');
      }
    }
  }

  const myContainer = document.getElementById('my-bookings-container');
  const pendingContainer = document.getElementById('pending-approvals-container');
  const allContainer = document.getElementById('all-history-container');

  if (myContainer) myContainer.innerHTML = '';
  if (pendingContainer) pendingContainer.innerHTML = '';
  if (allContainer) allContainer.innerHTML = '';

  const helperCreateCard = (b, isPendingForMe) => {
    let statusClass = 'warning';
    let statusText = `รออนุมัติ (L${b.currentApprovalLevel})`;
    if (b.waitingForRequesterInput) {
      statusClass = 'danger';
      statusText = '⏳ รอระบุค่าพาหนะ';
    } else if (b.status === 'approved') {
      statusClass = 'success';
      statusText = 'อนุมัติเสร็จสิ้น';
    } else if (b.status === 'rejected') {
      statusClass = 'danger';
      statusText = 'ปฏิเสธคำขอ';
    }

    const startDateStr = formatThaiDateTime(b.startDate);
    const endDateStr = formatThaiDateTime(b.endDate);
    
    let infoStr = '';
    if (b.travelType === 'fmo_car') {
      const carObj = cars.find(c => c.id === b.carId);
      const prefix = b.controlUnit === 'รถสวัสดิการ' ? '🚗 [รถสวัสดิการ]' : '🚗 ใช้รถยนต์ อสป.';
      infoStr = `${prefix}: <strong>${carObj ? carObj.name : 'ไม่ระบุ'}</strong> (ทะเบียน ${carObj ? carObj.plate : '-'})`;
      if (b.driverName && b.driverName !== '-') {
        const phone = getDriverPhoneByName(b.driverName);
        const phoneStr = phone ? ` (โทร: ${phone})` : '';
        infoStr += `<br>👤 พขร.: <strong>${b.driverName}</strong>${phoneStr}`;
      }
    } else {
      infoStr = `🚐 ใช้รถรับจ้างสาธารณะ: ระยะทาง ${b.distance} กม. (ประมาณราคา ${b.price} บาท)`;
    }

    const directionStr = `[ทิศทาง: ${b.goCheck ? 'ไป' : ''}${b.goCheck && b.backCheck ? '-' : ''}${b.backCheck ? 'กลับ' : ''}]`;
    const actionBtnText = isPendingForMe ? '✍️ พิจารณาตรวจอนุมัติ' : '👁️ ดูรายละเอียด';
    const actionBtnClass = isPendingForMe ? 'btn-warning' : 'btn-primary';
    
    const isAdmin = currentUser && (currentUser.role === 'fleet_admin' || currentUser.role === 'director' || currentUser.role === 'executive');
    const printBtn = (b.status === 'approved' && isAdmin)
      ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openReportView('${b.id}')">🖨️ ออกรายงาน</button>`
      : '';

    let stepsDots = '';
    const maxSteps = 4;
    for (let i = 1; i <= maxSteps; i++) {
      let dotClass = 'step-dot';
      if (b.currentApprovalLevel > i) dotClass += ' completed';
      else if (b.currentApprovalLevel === i && b.status === 'pending') dotClass += ' active';
      else if (b.status === 'rejected' && b.currentApprovalLevel === i) dotClass += ' rejected';
      stepsDots += `<span class="${dotClass}" title="สายอนุมัติที่ ${i}"></span>`;
    }

    let fillTaxiBtn = '';
    if (b.waitingForRequesterInput && currentUser && b.requester === currentUser.name) {
      fillTaxiBtn = `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); openFillTaxiModal('${b.id}')">✍️ กรอกค่าพาหนะ</button>`;
    }

    const card = document.createElement('div');
    card.className = 'booking-card';
    card.onclick = () => openApprovalModal(b.id);
    card.innerHTML = `
      <div class="booking-card-top">
        <span class="booking-id">${b.id}</span>
        <span class="booking-requester">${b.requester} ${(b.office || b.position) ? '(' + (b.office || b.position) + ')' : ''}</span>
        <span class="badge ${statusClass}">${statusText}</span>
      </div>
      <div class="booking-card-body">
        <p class="booking-purpose">ราชการเรื่อง: <strong>${b.purpose}</strong></p>
        <p class="booking-car-info">${infoStr} ${directionStr}</p>
        <p class="booking-time">⏰ ${startDateStr} - ${endDateStr} (${b.trips} เที่ยว)</p>
      </div>
      <div class="booking-card-footer">
        <div class="approval-steps-indicator">${stepsDots}</div>
        <div style="display:flex; gap:0.5rem; justify-content: flex-end; flex-wrap: wrap; width: 100%;">
          ${printBtn}
          ${fillTaxiBtn}
          <button class="btn ${actionBtnClass} btn-sm">${actionBtnText}</button>
        </div>
      </div>
    `;
    return card;
  };

  const myBookingsList = [];
  const pendingBookingsList = [];
  const allBookingsList = [];

  bookings.forEach(b => {
    const isMyRequest = currentUser && b.requester === currentUser.name;
    
    let isPendingForMe = false;
    if (b.status.startsWith('pending') && currentUser && !b.waitingForRequesterInput) {
      const activeLevel = sessionStorage.getItem('activeApprovalLevel') || 'all';
      const canApproveThisLevel = currentUser.canApprove && currentUser.canApprove.includes(b.currentApprovalLevel);
      const isSelectedLevel = (activeLevel === 'all' || parseInt(activeLevel) === b.currentApprovalLevel);

      if (canApproveThisLevel && isSelectedLevel) {
        if (b.currentApprovalLevel === 1) {
          // กรองเฉพาะงานที่ส่งถึง Manager ตามอีเมล
          const mEmail = resolveManagerEmail(b).toLowerCase();
          const cEmail = (currentUser.email || '').toLowerCase();
          if (mEmail === cEmail || ((mEmail === '' || mEmail === 'ranida.c@fishmarket.co.th') && currentUser.username.toLowerCase() === 'prathum.c')) {
            isPendingForMe = true;
          }
        } else {
          isPendingForMe = true;
        }
      }
    }

    if (isMyRequest) {
      myBookingsList.push({ booking: b, isPendingForMe });
    }
    if (isPendingForMe) {
      pendingBookingsList.push({ booking: b, isPendingForMe });
    }
    if (b.status === 'approved' || b.status === 'rejected') {
      const isMyRequest = currentUser && (
        (b.requesterEmail && b.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) || 
        b.requester === currentUser.name
      );
      const canSeeAll = currentUser && (
        currentUser.role === 'fleet_admin' || 
        currentUser.role === 'director' || 
        currentUser.role === 'executive'
      );
      if (canSeeAll || isMyRequest) {
        allBookingsList.push({ booking: b, isPendingForMe });
      }
    }
  });

  const renderToContainer = (container, listData, emptyHTML) => {
    if (!container) return;
    if (listData.length === 0) {
      container.innerHTML = emptyHTML;
      return;
    }

    if (bookingViewLayout === 'table') {
      let html = `
        <div class="table-responsive-container">
          <table class="bookings-table">
            <thead>
              <tr style="background: rgba(99, 102, 241, 0.05); border-bottom: 1px solid var(--border-color);">
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem;">เลขที่คำขอ</th>
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem;">ผู้เสนอขอ / สังกัด</th>
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem;">วัตถุประสงค์</th>
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem;">ประเภทรถ / พขร.</th>
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem;">วัน-เวลาเดินทาง</th>
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem; text-align: center;">สถานะ / ขั้นตอน</th>
                <th style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-main); white-space: nowrap; font-size: 0.8rem; text-align: right;">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
      `;
      listData.forEach(({ booking, isPendingForMe }) => {
        html += helperCreateTableRow(booking, isPendingForMe);
      });
      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } else {
      container.innerHTML = '';
      listData.forEach(({ booking, isPendingForMe }) => {
        container.appendChild(helperCreateCard(booking, isPendingForMe));
      });
    }
  };

  renderToContainer(
    myContainer,
    myBookingsList,
    `
      <div class="empty-state-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; width: 100%; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.65;">📁</div>
        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-main);">ไม่มีรายการขออนุญาตใช้</div>
        <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem;">รายการจองใช้พาหนะที่คุณเสนอขอจะแสดงขึ้นที่นี่</div>
      </div>
    `
  );

  renderToContainer(
    pendingContainer,
    pendingBookingsList,
    `
      <div class="empty-state-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; width: 100%; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.65;">📋</div>
        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-main);">ไม่มีรายการรออนุมัติ</div>
        <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem;">รายการขอใช้รถที่รอการตรวจเห็นชอบและอนุมัติจากคุณจะแสดงขึ้นที่นี่</div>
      </div>
    `
  );

  renderToContainer(
    allContainer,
    allBookingsList,
    `
      <div class="empty-state-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 1rem; width: 100%; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.65;">📚</div>
        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-main);">ไม่มีประวัติการใช้รถ</div>
        <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.25rem;">รายการจองที่ได้รับการอนุมัติเสร็จสิ้นหรือถูกปฏิเสธแล้วจะแสดงขึ้นที่นี่</div>
      </div>
    `
  );

  updateStats();
}

// Render Monthly Grid Calendar
function renderMonthCalendar() {
  const cellsContainer = document.getElementById('calendar-cells-container');
  const label = document.getElementById('calendar-month-year-label');
  if (!cellsContainer || !label) return;

  cellsContainer.innerHTML = '';
  const monthsTh = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const y = calCurrentDate.getFullYear();
  const m = calCurrentDate.getMonth();
  label.textContent = `${monthsTh[m]} ${y + 543}`;

  const firstDay = new Date(y, m, 1).getDay();
  const totalDays = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();

  const cells = [];

  // Trailing days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false, date: new Date(y, m - 1, prevMonthDays - i) });
  }

  // Active days of current month
  for (let i = 1; i <= totalDays; i++) {
    cells.push({ day: i, current: true, date: new Date(y, m, i) });
  }

  // Leading days of next month to fill grid
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false, date: new Date(y, m + 1, i) });
  }

  cells.forEach(cell => {
    const cellDiv = document.createElement('div');
    cellDiv.className = cell.current ? 'calendar-day-cell current-month' : 'calendar-day-cell other-month';
    
    // Highlight today
    if (cell.date.toDateString() === new Date().toDateString()) {
      cellDiv.classList.add('today');
    }

    cellDiv.innerHTML = `<span class="calendar-day-number">${cell.day}</span>`;

    // Render event badges inside date cell
    const dateStr = cell.date.toDateString();
    const cellBkg = bookings.filter(b => {
      if (b.status === 'rejected') return false;
      
      // Calendar filter implementation
      if (calFilterCar !== 'all') {
        if (calFilterCar === 'public') {
          if (b.travelType !== 'public_car') return false;
        } else {
          if (b.travelType !== 'fmo_car' || b.carId !== calFilterCar) return false;
        }
      }

      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      
      const checkDate = new Date(cell.date);
      checkDate.setHours(0,0,0,0);
      
      const cmpStart = new Date(bStart);
      cmpStart.setHours(0,0,0,0);
      
      const cmpEnd = new Date(bEnd);
      cmpEnd.setHours(0,0,0,0);
      
      return checkDate >= cmpStart && checkDate <= cmpEnd;
    });

    if (cellBkg.length > 0) {
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'calendar-events-container';

      cellBkg.forEach(b => {
        const badge = document.createElement('div');
        let badgeClass = 'calendar-event-badge';
        if (b.status === 'approved') badgeClass += ' approved';
        else if (b.status === 'pending') badgeClass += ' pending';

        badge.className = badgeClass;
        
        let icon = '🚗';
        if (b.travelType === 'public_car') icon = '🚐';
        else {
          const c = cars.find(car => car.id === b.carId);
          if (c) icon = c.icon;
        }

        badge.innerHTML = `<span>${icon} ${b.purpose}</span>`;
        const startT = formatThaiTimeOnly(b.startDate);
        const endT = formatThaiTimeOnly(b.endDate);
        const startD = new Date(b.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
        const endD = new Date(b.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
        const timeText = startD === endD 
          ? `${startD} (เวลา ${startT} - ${endT})` 
          : `${startD} (${startT}) ถึง ${endD} (${endT})`;

        badge.title = `ผู้จอง: ${b.requester || '-'}\nเรื่อง: ${b.purpose || '-'}\nสถานที่: ${b.destination || '-'}\nเวลา: ${timeText}`;
        badge.onclick = (e) => {
          e.stopPropagation();
          openApprovalModal(b.id);
        };
        eventsContainer.appendChild(badge);
      });

      cellDiv.appendChild(eventsContainer);
    }

    cellsContainer.appendChild(cellDiv);
  });
}

// Setup Interactive Signature Pads with pixel checks
function setupSignaturePad(canvasId, clearBtnId, placeholderId) {
  const canvas = document.getElementById(canvasId);
  const clearBtn = document.getElementById(clearBtnId);
  const placeholder = document.getElementById(placeholderId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  let drawing = false;

  // Fit resolution to client dimensions
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };
  resize();
  window.addEventListener('resize', resize);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function startDraw(e) {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    if (placeholder) placeholder.style.display = 'none';
    e.preventDefault();
  }

  function draw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    e.preventDefault();
  }

  function stopDraw() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stopDraw);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (placeholder) placeholder.style.display = 'flex';
  });

  return {
    isEmpty: () => {
      const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      return !buffer.some(color => color !== 0);
    },
    getDataUrl: () => canvas.toDataURL(),
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (placeholder) placeholder.style.display = 'flex';
    },
    resize: resize
  };
}

// Open Approval Details Modal
function openApprovalModal(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const modal = document.getElementById('modal-approval');
  if (!modal) return;

  modal.classList.add('active');

  // We will resize and load signature in setTimeout to ensure proper layout and avoid signature clear

  // Fill details table
  document.getElementById('detail-title').textContent = `ใบขออนุญาตใช้รถยนต์ เลขที่ ${booking.id}`;
  document.getElementById('detail-requester').textContent = booking.requester;
  document.getElementById('detail-office').textContent = `${booking.position} / แผนก ${booking.department} ฝ่าย ${booking.division} สังกัด ${booking.office}`;
  let travelTypeLabel = '🚐 รถรับจ้างสาธารณะ';
  if (booking.travelType === 'fmo_car') {
    travelTypeLabel = booking.controlUnit === 'รถสวัสดิการ' ? '🚘 รถยนต์ สวัสดิการ' : '🚘 รถยนต์ อสป.';
  }
  document.getElementById('detail-travel-type').textContent = travelTypeLabel;
  
  if (booking.travelType === 'fmo_car') {
    const c = cars.find(car => car.id === booking.carId);
    document.getElementById('detail-car').innerHTML = `เลือกรถยนต์: <strong>${c ? c.name : 'ไม่พบข้อมูล'}</strong> (ทะเบียน: ${c ? c.plate : '-'}) [ทิศทาง: ${booking.goCheck ? 'ไป' : ''}${booking.goCheck && booking.backCheck ? '-' : ''}${booking.backCheck ? 'กลับ' : ''}]`;
  } else {
    document.getElementById('detail-car').innerHTML = `รถสาธารณะ: ระยะทาง <strong>${booking.distance} กม.</strong> (ราคาประมาณ <strong>${booking.price} บาท</strong>) [ทิศทาง: ${booking.goCheck ? 'ไป' : ''}${booking.goCheck && booking.backCheck ? '-' : ''}${booking.backCheck ? 'กลับ' : ''}]`;
  }

  // เติมข้อมูลพนักงานขับรถและเบอร์โทรศัพท์ (ถ้ามี)
  const driverRow = document.getElementById('detail-driver-row');
  const driverEl = document.getElementById('detail-driver');
  if (driverRow && driverEl) {
    if (booking.travelType === 'fmo_car' && booking.driverName && booking.driverName !== '-') {
      const phone = getDriverPhoneByName(booking.driverName);
      const phoneStr = phone ? ` (เบอร์โทร: ${phone})` : ' (ไม่มีข้อมูลเบอร์โทร)';
      driverEl.innerHTML = `<strong>${booking.driverName}</strong>${phoneStr}`;
      driverRow.style.display = 'table-row';
    } else {
      driverEl.textContent = '-';
      driverRow.style.display = 'none';
    }
  }

  // เติมข้อมูลสำเนาใบขับขี่ (สำหรับรถสวัสดิการ)
  const licenseRow = document.getElementById('detail-driver-license-row');
  const licenseEl = document.getElementById('detail-driver-license');
  if (licenseRow && licenseEl) {
    if (booking.controlUnit === 'รถสวัสดิการ' && booking.driverLicenseFile) {
      if (booking.driverLicenseFile.startsWith('data:application/pdf')) {
        licenseEl.innerHTML = `<button type="button" class="btn btn-secondary btn-sm btn-view-license-file" data-booking-id="${booking.id}" style="display:inline-flex; align-items:center; gap:0.25rem; padding:0.25rem 0.5rem; font-size:0.8rem; border-radius:4px; font-weight:600; background:var(--primary); color:white; border:none; text-decoration:none; cursor:pointer;">📄 เปิดดูไฟล์ PDF ใบขับขี่</button>`;
      } else {
        licenseEl.innerHTML = `
          <div class="btn-view-license-file" data-booking-id="${booking.id}" title="คลิกเพื่อดูรูปใหญ่" style="cursor: pointer; display: inline-block;">
            <img src="${booking.driverLicenseFile}" style="max-width: 120px; max-height: 80px; border-radius: 4px; border: 1px solid var(--border-color); object-fit: contain;">
          </div>
        `;
      }
      licenseRow.style.display = 'table-row';
    } else {
      licenseEl.textContent = '-';
      licenseRow.style.display = 'none';
    }
  }

  // เติมข้อมูลที่อยู่ผู้ขอใช้รถ (สำหรับรถสวัสดิการ)
  const addressRow = document.getElementById('detail-welfare-address-row');
  const addressEl = document.getElementById('detail-welfare-address');
  if (addressRow && addressEl) {
    if (booking.controlUnit === 'รถสวัสดิการ') {
      const addressParts = [];
      if (booking.addressNo) addressParts.push(`บ้านเลขที่ ${booking.addressNo}`);
      if (booking.addressMoo) addressParts.push(`หมู่ ${booking.addressMoo}`);
      if (booking.addressRoad) addressParts.push(`ถนน ${booking.addressRoad}`);
      if (booking.addressSubdistrict) addressParts.push(`ต./แขวง ${booking.addressSubdistrict}`);
      if (booking.addressDistrict) addressParts.push(`อ./เขต ${booking.addressDistrict}`);
      if (booking.addressProvince) addressParts.push(`จ. ${booking.addressProvince}`);
      addressEl.textContent = addressParts.join(' ') || '-';
      addressRow.style.display = 'table-row';
    } else {
      addressEl.textContent = '-';
      addressRow.style.display = 'none';
    }
  }

  document.getElementById('detail-route').textContent = booking.destination || booking.purpose || '-';
  
  const start = formatThaiDateTimeLong(booking.startDate);
  const end = formatThaiDateTimeLong(booking.endDate);
  document.getElementById('detail-time').textContent = `ตั้งแต่วันที่ ${start} ถึงวันที่ ${end} (${booking.trips} เที่ยว)`;
  document.getElementById('detail-passengers').textContent = booking.passengers;
  document.getElementById('detail-purpose').textContent = booking.purpose || '-';

  // Render Visual Pipeline
  renderApprovalPipeline(booking);

  // Toggle Action Box conditional display
  const actionPanel = document.getElementById('approval-action-panel');
  const fleetAssignBox = document.getElementById('fleet-admin-assign-box');
  
  // Clear modal inputs
  document.getElementById('approval-comment').value = '';
  // Resize canvas and then load/draw user signature after modal is displayed
  setTimeout(() => {
    if (approverSig) {
      approverSig.resize();
      approverSig.clear();
      if (currentUser && currentUser.sign && currentUser.sign.startsWith('data:image')) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('canvas-approver-signature');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const x = (canvas.width - img.width * ratio) / 2;
            const y = (canvas.height - img.height * ratio) / 2;
            ctx.drawImage(img, x, y, img.width * ratio, img.height * ratio);
            
            const placeholder = document.getElementById('approver-sig-placeholder');
            if (placeholder) placeholder.style.display = 'none';
          }
        };
        img.src = currentUser.sign;
      }
    }
  }, 100);
  fleetAssignBox.style.display = 'none';
  const fleetEditPanel = document.getElementById('fleet-admin-edit-panel');
  if (fleetEditPanel) fleetEditPanel.style.display = 'none';

  let isMyTurn = false;
  if (booking.status === 'pending' && currentUser && !booking.waitingForRequesterInput) {
    const lvl = booking.currentApprovalLevel;
    const canApproveThisLevel = currentUser.canApprove && currentUser.canApprove.includes(lvl);
    
    if (canApproveThisLevel) {
      if (lvl === 1) {
        // กรองเฉพาะงานที่ส่งถึง Manager ตามอีเมล
        const mEmail = resolveManagerEmail(booking).toLowerCase();
        const cEmail = (currentUser.email || '').toLowerCase();
        if (mEmail === cEmail || ((mEmail === '' || mEmail === 'ranida.c@fishmarket.co.th') && currentUser.username.toLowerCase() === 'prathum.c')) {
          isMyTurn = true;
        }
      }
      else if (lvl === 2) {
        isMyTurn = true;
        fleetAssignBox.style.display = 'block';
        
        const carSelectGroup = document.getElementById('fleet-admin-car-select-group');
        const driverGroup = document.getElementById('fleet-admin-driver-group');
        
        if (carSelectGroup) carSelectGroup.style.display = 'block';
        
        const carSelect = document.getElementById('assign-car');
        carSelect.innerHTML = `
          <option value="">-- กรุณาเลือกรถยนต์ --</option>
          <option value="taxi">🚕 รถแท็กซี่ (TAXI)</option>
        `;
        cars.forEach(car => {
          const hasConflict = hasBookingConflict(car.id, booking.startDate, booking.endDate, booking.id);
          const now = new Date();
          const isBusyNow = bookings.some(b => {
            const isAssigned = b.status === 'approved' || (b.status === 'pending' && b.currentApprovalLevel >= 3);
            if (b.id === booking.id || !isAssigned || b.travelType !== 'fmo_car' || b.carId !== car.id) return false;
            return new Date(b.startDate) <= now && new Date(b.endDate) >= now;
          });

          let statusText = '';
          if (hasConflict) {
            statusText = ' (ไม่ว่างช่วงที่ขอ)';
          } else {
            statusText = isBusyNow ? ' (ไม่ว่างขณะนี้/ว่างช่วงที่ขอ)' : ' (ว่าง)';
          }

          const disabled = hasConflict ? ' disabled style="color:var(--text-muted);"' : '';
          carSelect.innerHTML += `<option value="${car.id}"${disabled}>${car.name} (${car.plate})${statusText}</option>`;
        });
        
        const driverInput = document.getElementById('assign-driver');
        
        if (booking.travelType === 'public_car') {
          carSelect.value = 'taxi';
          if (driverGroup) driverGroup.style.display = 'block';
          if (driverInput) {
            driverInput.value = '-';
            driverInput.disabled = true;
          }
        } else {
          if (driverGroup) driverGroup.style.display = 'block';
          if (driverInput) {
            driverInput.value = booking.driverName || (booking.controlUnit === 'รถสวัสดิการ' ? booking.requester : 'นายดีเลิศ สมใจ');
            driverInput.disabled = false;
          }
          carSelect.value = booking.carId || '';
        }
      }
      else if (lvl === 3) {
        isMyTurn = true;
      }
      else if (lvl === 4) {
        isMyTurn = true;
      }
    }
  }

  const showEditPanel = currentUser && currentUser.canApprove && currentUser.canApprove.includes(2) && 
                        (booking.status === 'approved' || (booking.status === 'pending' && booking.currentApprovalLevel > 2));

  if (isMyTurn) {
    actionPanel.classList.remove('hidden');
    activeBookingIdForApproval = booking.id;
  } else {
    actionPanel.classList.add('hidden');
    if (showEditPanel) {
      activeBookingIdForApproval = booking.id;
    } else {
      activeBookingIdForApproval = null;
    }
  }

  if (showEditPanel && fleetEditPanel) {
    fleetEditPanel.style.display = 'block';
    const editCarSelect = document.getElementById('edit-assign-car');
    if (editCarSelect) {
      editCarSelect.innerHTML = `
        <option value="">-- กรุณาเลือกรถยนต์ --</option>
        <option value="taxi">🚕 รถแท็กซี่ (TAXI)</option>
      `;
      cars.forEach(car => {
        const hasConflict = hasBookingConflict(car.id, booking.startDate, booking.endDate, booking.id);
        const now = new Date();
        const isBusyNow = bookings.some(b => {
          const isAssigned = b.status === 'approved' || (b.status === 'pending' && b.currentApprovalLevel >= 3);
          if (b.id === booking.id || !isAssigned || b.travelType !== 'fmo_car' || b.carId !== car.id) return false;
          return new Date(b.startDate) <= now && new Date(b.endDate) >= now;
        });

        let statusText = '';
        if (hasConflict) {
          statusText = ' (ไม่ว่างช่วงที่ขอ)';
        } else {
          statusText = isBusyNow ? ' (ไม่ว่างขณะนี้/ว่างช่วงที่ขอ)' : ' (ว่าง)';
        }

        const disabled = hasConflict ? ' disabled style="color:var(--text-muted);"' : '';
        editCarSelect.innerHTML += `<option value="${car.id}"${disabled}>${car.name} (${car.plate})${statusText}</option>`;
      });

      const editDriverInput = document.getElementById('edit-assign-driver');
      if (booking.travelType === 'public_car') {
        editCarSelect.value = 'taxi';
        if (editDriverInput) {
          editDriverInput.value = '-';
          editDriverInput.disabled = true;
        }
      } else {
        editCarSelect.value = booking.carId || '';
        if (editDriverInput) {
          editDriverInput.value = booking.driverName || (booking.controlUnit === 'รถสวัสดิการ' ? booking.requester : 'นายดีเลิศ สมใจ');
          editDriverInput.disabled = false;
        }
      }
    }
  }
}

// Render Visual pipeline steps
function renderApprovalPipeline(booking) {
  const container = document.getElementById('approval-pipeline-container');
  if (!container) return;
  container.innerHTML = '';

  const isRequesterUser = currentUser && (currentUser.role === 'requester' || booking.requester === currentUser.name);

  const pipelineTitle = document.getElementById('approval-pipeline-title');
  if (pipelineTitle) {
    pipelineTitle.textContent = 'ลำดับการอนุมัติ (4 ขั้นตอนตามฟอร์ม อสป.)';
  }

  const stepsDef = [
    { level: 1, title: 'หัวหน้าสำนักงาน/หัวหน้าแผนก (L1)', role: 'supervisor' },
    { level: 2, title: 'ผู้จัดรถ / งานยานพาหนะ (L2)', role: 'fleet_admin' },
    { level: 3, title: 'หัวหน้าสำนักงานบริหารการพัสดุ (หส.พด.) (L3)', role: 'director' },
    { level: 4, title: 'ผู้อำนวยการฝ่ายบัญชีการเงิน (ผฝ.บง.) (L4)', role: 'executive' }
  ];

  stepsDef.forEach(step => {
    const sig = booking.signatures.find(s => s.level === step.level);
    let stepClass = 'pipeline-step';
    let icon = '⚪';
    let statusText = 'รอดำเนินการ';
    let detailsHtml = '';

    if (sig && sig.status === 'approved') {
      stepClass += ' approved';
      icon = '🟢';
      statusText = 'อนุมัติแล้ว';
      const timeStr = formatThaiDateTime(sig.timestamp);
      const sigImg = getSignatureImg(step.level, sig.signature, sig.approverName);
      detailsHtml = `
        <div class="pipeline-details" style="margin-top:0.4rem; padding-left:1.5rem; font-size:0.8rem; line-height:1.4;">
          <span>ลงนามโดย: <strong>${sig.approverName}</strong></span><br>
          <span>เมื่อ: ${timeStr}</span><br>
          ${sig.comment ? `<span>ความเห็น: "${sig.comment}"</span><br>` : ''}
          ${sig.driverName ? `<span style="color:var(--primary); font-weight:bold;">จัดพนักงานขับรถ: ${sig.driverName}${getDriverPhoneByName(sig.driverName) ? ` (โทร. ${getDriverPhoneByName(sig.driverName)})` : ''}</span><br>` : ''}
          <div style="margin-top:0.25rem;">
            <img src="${sigImg}" alt="Sign" style="height:35px; border-bottom:1px dashed #777;">
          </div>
        </div>
      `;
    } else if (sig && sig.status === 'rejected') {
      stepClass += ' rejected';
      icon = '🔴';
      statusText = 'ปฏิเสธการใช้รถ';
      const timeStr = formatThaiDateTime(sig.timestamp);
      const sigImg = getSignatureImg(step.level, sig.signature, sig.approverName);
      detailsHtml = `
        <div class="pipeline-details" style="margin-top:0.4rem; padding-left:1.5rem; font-size:0.8rem; line-height:1.4;">
          <span>ลงนามโดย: <strong>${sig.approverName}</strong></span><br>
          <span>เมื่อ: ${timeStr}</span><br>
          <span style="color:var(--danger);">เหตุผล: "${sig.comment || 'ไม่มีการระบุเหตุผล'}"</span><br>
          <div style="margin-top:0.25rem;">
            <img src="${sigImg}" alt="Sign" style="height:35px; border-bottom:1px dashed #777;">
          </div>
        </div>
      `;
    }

    const stepDiv = document.createElement('div');
    stepDiv.className = stepClass;
    stepDiv.innerHTML = `
      <div class="pipeline-header" style="display:flex; align-items:center; gap:0.5rem;">
        <span>${icon}</span>
        <span><strong>${step.title}</strong> - ${statusText}</span>
      </div>
      ${detailsHtml}
    `;
    container.appendChild(stepDiv);
  });
}

// Handle Approve / Reject Actions
function handleApprovalAction(isApproved) {
  if (!activeBookingIdForApproval) return;
  
  if (approverSig.isEmpty()) {
    showToast("กรุณาเซ็นชื่อลงในกระดานลงนามดิจิทัลก่อนกดยืนยันการทำรายการ", "warning");
    return;
  }

  const booking = bookings.find(b => b.id === activeBookingIdForApproval);
  if (!booking) return;

  const comment = document.getElementById('approval-comment').value;
  const level = booking.currentApprovalLevel;

  // Fleet admin (L2) validation for car selection and driver name assignment
  let assignedDriver = '';
  let assignedCarId = '';
  if (currentUser.role === 'fleet_admin' && level === 2 && isApproved) {
    assignedCarId = document.getElementById('assign-car').value;
    if (!assignedCarId) {
      showToast("ในขั้นตอนผู้จัดรถ (L2) กรุณาเลือกรถยนต์ของ อสป. หรือแท็กซี่ (TAXI)", "warning");
      return;
    }
    
    if (assignedCarId === 'taxi') {
      if (!booking.distance || !booking.price || booking.distance == 0 || booking.price == 0) {
        booking.travelType = 'public_car';
        booking.carId = '';
        booking.driverName = '-';
        booking.waitingForRequesterInput = true;
        
        saveBookings();
        document.getElementById('modal-approval').classList.remove('active');
        
        // Re-render UI views
        updateStats();
        renderDashboard();
        renderBookingsLists();
        renderMonthCalendar();

        // Trigger email notification (L2 -> L0 TAXI Loop)
        const reqEmail = resolveRequesterEmail(booking);
        const subject = `[ระบบจองรถ อสป.] กรุณาระบุรายละเอียดค่าพาหนะรถรับจ้างสำหรับคำขอ เลขที่ ${booking.id}`;
        const body = `
          <p>เรียน คุณ ${booking.requester},</p>
          <p>ใบขออนุญาตใช้ยานพาหนะเลขที่ <strong>${booking.id}</strong> ของท่าน ได้รับความเห็นในการจัดสรรพาหนะเดินทางแบบ <strong>รถรับจ้างสาธารณะ (TAXI)</strong> เนื่องจากรถยนต์ส่วนกลางไม่ว่างปฏิบัติงานในช่วงเวลาดังกล่าว</p>
          <p>รบกวนท่านเข้าสู่ระบบเพื่อดำเนินการกรอกข้อมูล <strong>ระยะทางประมาณการ (กิโลเมตร)</strong> และ <strong>วงเงินงบประมาณเบิกจ่ายโดยประมาณ (บาท)</strong> เพื่อส่งใบงานกลับไปดำเนินการเสนออนุมัติตามลำดับขั้นต่อไป</p>
          <p>ท่านสามารถคลิกที่ปุ่มสีแดง <strong>[กรอกค่าพาหนะ]</strong> ในตารางรายการที่ฉันขอ เพื่อระบุข้อมูลได้ทันที:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://car-booking.fishmarket.co.th/" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">กรอกรายละเอียดค่าพาหนะ</a>
          </div>
        `;
        sendEmailNotification(reqEmail, subject, body);
        
        showToast(`ได้ส่งใบคำขอรหัส ${booking.id} กลับไปยังผู้ขอรถ (${booking.requester}) เพื่อกรอกข้อมูลระยะทางและค่าใช้จ่ายรถรับจ้างเรียบร้อยแล้ว`, "success");
        return;
      } else {
        booking.travelType = 'public_car';
        booking.carId = '';
        booking.driverName = '-';
        assignedDriver = '-';
      }
    } else {
      // Conflict check
      if (hasBookingConflict(assignedCarId, booking.startDate, booking.endDate, booking.id)) {
        showToast("ขออภัย! รถยนต์คันนี้ได้รับการจองในช่วงเวลานี้แล้ว กรุณาเลือกรถยนต์คันอื่น", "error");
        return;
      }
      
      assignedDriver = document.getElementById('assign-driver').value;
      if (!assignedDriver.trim() || assignedDriver === '-') {
        showToast("ในขั้นตอนผู้จัดรถ (L2) กรุณาระบุชื่อพนักงานขับรถปฏิบัติหน้าที่", "warning");
        return;
      }
      booking.travelType = 'fmo_car';
      booking.carId = assignedCarId;
      booking.driverName = assignedDriver;
    }
  }

  const sigBlock = booking.signatures.find(s => s.level === level);
  if (sigBlock) {
    sigBlock.approverName = currentUser.name;
    sigBlock.status = isApproved ? 'approved' : 'rejected';
    sigBlock.comment = comment;
    sigBlock.timestamp = new Date().toISOString();
    sigBlock.signature = approverSig.getDataUrl();
    
    if (assignedCarId && assignedCarId !== 'taxi') {
      booking.carId = assignedCarId;
    }
    
    if (assignedDriver) {
      sigBlock.driverName = assignedDriver;
      booking.driverName = assignedDriver;
    }
  }

  // Update status routing workflow
  if (!isApproved) {
    booking.status = 'rejected';
  } else {
    booking.currentApprovalLevel = level + 1;
    const maxLevel = 4;
    if (booking.currentApprovalLevel > maxLevel) {
      booking.status = 'approved';
    }
  }

  saveBookings();
  document.getElementById('modal-approval').classList.remove('active');
  
  // Re-render UI views
  updateStats();
  renderDashboard();
  renderBookingsLists();
  renderMonthCalendar();

  // Trigger emails depending on outcomes
  let carObj = cars.find(c => c.id === booking.carId);
  if (!carObj && booking.driverName && booking.driverName !== '-') {
    const searchName = booking.driverName.replace(/\s+/g, '');
    carObj = cars.find(c => c.driverName && c.driverName.replace(/\s+/g, '') === searchName);
  }
  const carPlate = carObj ? carObj.plate : '-';
  const phone = carObj && carObj.phone ? carObj.phone : getDriverPhoneByName(booking.driverName);
  const driverNameWithPhone = (booking.driverName && booking.driverName !== '-') ? `${booking.driverName}${phone ? ` (โทร. ${phone})` : ''}` : '-';

  if (!isApproved) {
    // Rejection notification
    const reqEmail = resolveRequesterEmail(booking);
    const subject = `[ระบบจองรถ อสป.] คำขอจองใช้รถเลขที่ ${booking.id} ได้รับการปฏิเสธอนุมัติ`;
    const body = `
      <p>เรียน คุณ ${booking.requester},</p>
      <p>ใบขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะเลขที่ <strong>${booking.id}</strong> ของท่าน <strong>ไม่ได้รับการอนุมัติ</strong></p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
        <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${booking.id}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">ผู้ปฏิเสธอนุมัติ:</td><td style="padding: 6px 0;">${currentUser.name} (${currentUser.roleName})</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">เหตุผลความคิดเห็น:</td><td style="padding: 6px 0; color: #dc2626;">"${comment || 'ไม่มีการระบุเหตุผล'}"</td></tr>
      </table>
      <p>ท่านสามารถคลิกเข้าสู่ระบบเพื่อตรวจสอบข้อมูลได้ที่:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="https://car-booking.fishmarket.co.th/" style="background-color: #64748b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">เข้าสู่ระบบดูรายละเอียด</a>
      </div>
    `;
    sendEmailNotification(reqEmail, subject, body);
  } else {
    // Approved at this level, check next action
    if (booking.status === 'approved') {
      // Notify requester that the booking is fully approved
      const reqEmail = resolveRequesterEmail(booking);
      const subject = `[ระบบจองรถ อสป.] คำขอใช้รถเลขที่ ${booking.id} ได้รับอนุมัติเสร็จสิ้นเรียบร้อยแล้ว`;
      const body = `
        <p>เรียน คุณ ${booking.requester},</p>
        <p>ใบขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะเลขที่ <strong>${booking.id}</strong> ของท่านได้รับการลงนามและอนุมัติเสร็จสมบูรณ์ในทุกระดับขั้นการเสนอเรียบร้อยแล้ว</p>
        <p>ขณะนี้ท่านสามารถออกรายงานใบขออนุญาตในรูปแบบ PDF/พิมพ์กระดาษ ได้โดยตรงผ่านระบบ:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
          <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${booking.id}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เรื่อง/วัตถุประสงค์:</td><td style="padding: 6px 0;">${booking.purpose}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${booking.destination || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:</td><td style="padding: 6px 0;">${booking.travelType === 'fmo_car' ? `รถตู้ อสป. ทะเบียน ${carPlate}` : 'รถรับจ้างสาธารณะ (TAXI)'}</td></tr>
          ${booking.travelType === 'fmo_car' ? `<tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">พนักงานขับรถ:</td><td style="padding: 6px 0;">${driverNameWithPhone}</td></tr>` : `<tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">วงเงินอนุมัติเบิกจ่าย:</td><td style="padding: 6px 0;">ไม่เกิน ${booking.price} บาท</td></tr>`}
        </table>
      `;
      sendEmailNotification(reqEmail, subject, body);
    } else {
      const nextLevel = booking.currentApprovalLevel;
      if (nextLevel === 2) {
        // Notify L2 (chalong.c, sakda.a)
        const toEmail = 'chalong.c@fishmarket.co.th,sakda.a@fishmarket.co.th';
        const subject = `[ระบบจองรถ อสป.] ใบจองเลขที่ ${booking.id} ได้รับการเห็นชอบจาก L1 แล้ว รอจัดรถยนต์`;
        const body = `
          <p>เรียน ผู้จัดรถ / งานยานพาหนะ (L2),</p>
          <p>มีใบขออนุญาตใช้รถยนต์เลขที่ <strong>${booking.id}</strong> ผ่านความเห็นชอบพิจารณาจากระดับหัวหน้างาน (L1) แล้ว ขณะนี้รอการดำเนินการจากท่านในการจัดสรรยานพาหนะและคนขับรถ</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
          </div>
        `;
        sendEmailNotification(toEmail, subject, body);
      } else if (nextLevel === 3) {
        // Notify L3 (saisunee.p, panadon.p)
        const toEmail = 'saisunee.p@fishmarket.co.th,panadon.p@fishmarket.co.th';
        const subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ เลขที่ ${booking.id} รอการตรวจสอบจาก หส.พด.`;
        const body = `
          <p>เรียน หัวหน้าแผนกพัสดุ / หส.พด. (L3),</p>
          <p>มีใบขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะเลขที่ <strong>${booking.id}</strong> จัดสรรเสสิ้นและเสนอมายังท่านเพื่อตรวจสอบลงนามอนุมัติใช้ยานพาหนะ</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${booking.id}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${booking.requester}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${booking.destination || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:</td><td style="padding: 6px 0;">${booking.travelType === 'fmo_car' ? `รถตู้ อสป. ทะเบียน ${carPlate}` : 'รถรับจ้างสาธารณะ (TAXI)'}</td></tr>
            ${booking.travelType === 'fmo_car' ? `<tr><td style="padding: 6px 0; font-weight: bold;">พนักงานขับรถ:</td><td style="padding: 6px 0;">${driverNameWithPhone}</td></tr>` : `<tr><td style="padding: 6px 0; font-weight: bold;">ค่าพาหนะโดยประมาณ:</td><td style="padding: 6px 0;">${booking.price} บาท (ระยะทาง ${booking.distance} กม.)</td></tr>`}
          </table>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
          </div>
        `;
        sendEmailNotification(toEmail, subject, body);
      } else if (nextLevel === 4) {
        // Notify L4 (piyawan.k, saisunee.p, sarena.m)
        const toEmail = 'piyawan.k@fishmarket.co.th,saisunee.p@fishmarket.co.th,sarena.m@fishmarket.co.th';
        const subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ เลขที่ ${booking.id} รอการอนุมัติเบิกจ่ายจาก ผฝ.บง.`;
        const body = `
          <p>เรียน ผู้อำนวยการฝ่ายการเงิน / ผฝ.บง. (L4),</p>
          <p>ใบจองใช้ยานพาหนะและขอเบิกค่าใช้จ่ายเลขที่ <strong>${booking.id}</strong> ได้รับการตรวจสอบและลงนามจาก หส.พด. (L3) แล้ว รอการอนุมัติวงเงินเบิกจ่ายจากท่าน</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${booking.id}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${booking.requester}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${booking.destination || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:</td><td style="padding: 6px 0;">${booking.travelType === 'fmo_car' ? `รถตู้ อสป. ทะเบียน ${carPlate}` : 'รถรับจ้างสาธารณะ (TAXI)'}</td></tr>
            ${booking.travelType === 'fmo_car' ? `<tr><td style="padding: 6px 0; font-weight: bold;">พนักงานขับรถ:</td><td style="padding: 6px 0;">${driverNameWithPhone}</td></tr>` : `<tr><td style="padding: 6px 0; font-weight: bold;">วงเงินประมาณเบิกจ่าย:</td><td style="padding: 6px 0;">${booking.price} บาท</td></tr>`}
          </table>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
          </div>
        `;
        sendEmailNotification(toEmail, subject, body);
      }
    }
  }

  showToast(
    isApproved ? `ทำการอนุมัติรหัส ${booking.id} เรียบร้อยแล้ว` : `ปฏิเสธการจองใช้รถยนต์รหัส ${booking.id} เรียบร้อยแล้ว`,
    isApproved ? "success" : "info"
  );
}

// Format Date object to official Thai text format
function formatThaiDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

// Generate HTML Content inside FMO Report Sheet template
function openReportView(bookingId) {
  const isAdmin = currentUser && (currentUser.role === 'fleet_admin' || currentUser.role === 'director' || currentUser.role === 'executive');
  if (!isAdmin) {
    showToast("ขออภัย! สิทธิ์การเข้าถึงรายงานเบิกจ่ายเฉพาะผู้ดูแลระบบและผู้อนุมัติฝ่ายยานพาหนะเท่านั้น", "error");
    return;
  }
  
  const b = bookings.find(x => x.id === bookingId);
  if (!b) return;

  if (b.status !== 'approved') {
    showToast("ขออภัย! สามารถออกรายงานได้เฉพาะรายการจองที่อนุมัติเบิกจ่ายเสร็จสมบูรณ์แล้วเท่านั้น", "warning");
    return;
  }

  showView('report');

  const reportContainer = document.getElementById('report-sheet-content');
  if (!reportContainer) return;

  const l0Sig = b.signatures.find(s => s.level === 0) || {};
  const l1Sig = b.signatures.find(s => s.level === 1) || {};
  const l2Sig = b.signatures.find(s => s.level === 2) || {};
  const l3Sig = b.signatures.find(s => s.level === 3) || {};
  const l4Sig = b.signatures.find(s => s.level === 4) || {};

  const l0SigImg = (l0Sig.status === 'approved') ? getSignatureImg(0, l0Sig.signature, b.requester) : '';
  const l1SigImg = (l1Sig.status === 'approved') ? getSignatureImg(1, l1Sig.signature, l1Sig.approverName) : '';
  const l2SigImg = (l2Sig.status === 'approved') ? getSignatureImg(2, l2Sig.signature, l2Sig.approverName) : '';
  const l3SigImg = (l3Sig.status === 'approved') ? getSignatureImg(3, l3Sig.signature, l3Sig.approverName) : '';
  const l4SigImg = (l4Sig.status === 'approved') ? getSignatureImg(4, l4Sig.signature, l4Sig.approverName) : '';

  const reqDate = formatThaiDate(l0Sig.timestamp || b.startDate);
  const l1Date = l1Sig.timestamp ? formatThaiDate(l1Sig.timestamp) : '';
  const l2Date = l2Sig.timestamp ? formatThaiDate(l2Sig.timestamp) : '';
  const l3Date = l3Sig.timestamp ? formatThaiDate(l3Sig.timestamp) : '';
  const l4Date = l4Sig.timestamp ? formatThaiDate(l4Sig.timestamp) : '';

  const parseThaiDateParts = (isoString) => {
    if (!isoString) return { day: '...', month: '..........', year: '....', time: '.....' };
    const date = new Date(isoString);
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

  const car = cars.find(c => c.id === b.carId);
  const carName = car ? car.name : 'ไม่ระบุ';
  const carPlate = car ? car.plate : '-';

  if (b.controlUnit === 'รถสวัสดิการ') {
    reportContainer.innerHTML = `
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
              <!-- Dial Arc -->
              <path d="M 15 50 A 40 40 0 0 1 95 50" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="2 1"/>
              <!-- Needle pointing up/half -->
              <line x1="55" y1="50" x2="55" y2="18" stroke="#000" stroke-width="2" />
              <polygon points="55,14 52,20 58,20" fill="#000" />
              <circle cx="55" cy="50" r="4.5" fill="#000" />
              <!-- Labels -->
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
              <!-- Labels -->
              <text x="65" y="10" font-size="7" font-family="Sarabun" text-anchor="middle" font-weight="bold">ระบุจุดบกพร่องรอบคัน</text>
              
              <!-- Top View of Van -->
              <g stroke="#333" fill="none" stroke-width="1.1" transform="translate(42, 15)">
                <rect x="10" y="5" width="26" height="70" rx="5" />
                <path d="M 12 18 L 34 18 L 32 22 L 14 22 Z" fill="#eee" />
                <rect x="12" y="70" width="22" height="4" rx="0.5" fill="#eee" />
                <line x1="10" y1="14" x2="36" y2="14" />
                <text x="23" y="2" font-size="6" font-family="Sarabun" text-anchor="middle">บน</text>
              </g>
              
              <!-- Front View -->
              <g stroke="#333" fill="none" stroke-width="1.1" transform="translate(10, 100)">
                <path d="M 4 8 L 28 8 A 2 2 0 0 1 30 10 L 30 26 A 1.5 1.5 0 0 1 28 28 L 4 28 A 1.5 1.5 0 0 1 2 26 L 2 10 A 2 2 0 0 1 4 8 Z" />
                <path d="M 3 10 L 29 10 L 27 18 L 5 18 Z" fill="#eee" />
                <rect x="4" y="22" width="4" height="2" rx="0.5" fill="#fff" />
                <rect x="24" y="22" width="4" height="2" rx="0.5" fill="#fff" />
                <text x="16" y="2" font-size="6" font-family="Sarabun" text-anchor="middle">หน้า</text>
              </g>

              <!-- Back View -->
              <g stroke="#333" fill="none" stroke-width="1.1" transform="translate(85, 100)">
                <path d="M 4 8 L 28 8 A 2 2 0 0 1 30 10 L 30 26 A 1.5 1.5 0 0 1 28 28 L 4 28 A 1.5 1.5 0 0 1 2 26 L 2 10 A 2 2 0 0 1 4 8 Z" />
                <rect x="4" y="10" width="24" height="9" rx="0.5" fill="#eee" />
                <rect x="3" y="22" width="2" height="4" fill="#ff4d4d" />
                <rect x="27" y="22" width="2" height="4" fill="#ff4d4d" />
                <text x="16" y="2" font-size="6" font-family="Sarabun" text-anchor="middle">หลัง</text>
              </g>

              <!-- Side View -->
              <g stroke="#333" fill="none" stroke-width="1.1" transform="translate(12, 145)">
                <path d="M 8 12 L 20 4 L 95 4 A 3 3 0 0 1 98 7 L 98 22 A 1.5 1.5 0 0 1 96 24 L 4 24 A 1.5 1.5 0 0 1 2 22 L 2 16 Z" />
                <path d="M 10 13 L 20 5 L 35 5 L 35 13 Z" fill="#eee" />
                <rect x="38" y="5" width="16" height="8" fill="#eee" />
                <rect x="57" y="5" width="16" height="8" fill="#eee" />
                <rect x="76" y="5" width="16" height="8" fill="#eee" />
                <circle cx="20" cy="24" r="5.5" fill="#333" />
                <circle cx="20" cy="24" r="2" fill="#fff" />
                <circle cx="80" cy="24" r="5.5" fill="#333" />
                <circle cx="80" cy="24" r="2" fill="#fff" />
                <text x="50" y="34" font-size="6" font-family="Sarabun" text-anchor="middle">ข้าง</text>
              </g>
            </svg>
          </div>
        </div>

        <!-- Right Column: After Use -->
        <div style="padding: 4px;">
          <div style="font-weight: bold; text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 4px; font-size: 11.5px; background-color: #f8fafc;">
            เมื่อยืมส่งคืนรถ
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
    return;
  }

  reportContainer.innerHTML = `
    <!-- HEADER SECTION -->
    <div class="fmo-header-block">
      <div class="fmo-header-left">
        <div class="fmo-line" style="font-size:13px;">[อ้างอิงเอกสารอนุมัติ/อนุญาต] ที่ <span class="dotted-fill" style="text-align:left; font-weight:normal; font-size:13px;">${b.ref || '-'}</span></div>
      </div>
      <div class="fmo-header-right">
        <div class="fmo-logo-wrapper">
          <img src="logoFMO.png" class="fmo-logo" alt="FMO Logo">
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
        แผนก <span class="dotted-val" style="min-width: 100px;">${b.department}</span>
        สำนัก <span class="dotted-val" style="min-width: 100px;">${b.office}</span>
        ฝ่าย <span class="dotted-val" style="min-width: 120px;">${b.division}</span>
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
        โดยมีผู้โดยสารไปกับรถคือ <span class="dotted-fill" style="text-align:left;">${b.passengers}</span>
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

// Set up UI Event Listeners
function setupEventListeners() {
  // Dynamic Trips update based on checkboxes
  const updateTripsCount = (e) => {
    const goCheckEl = document.getElementById('check-car-go');
    const backCheckEl = document.getElementById('check-car-back');
    if (!goCheckEl.checked && !backCheckEl.checked) {
      if (e) {
        e.target.checked = true;
        showToast("กรุณาเลือกรูปแบบการเดินทางอย่างน้อย 1 เส้นทาง (ไป หรือ กลับ)", "warning");
      }
    }
    let trips = 0;
    if (goCheckEl.checked) trips += 1;
    if (backCheckEl.checked) trips += 1;
    document.getElementById('input-trips').value = trips;
  };

  document.getElementById('check-car-go').addEventListener('change', updateTripsCount);
  document.getElementById('check-car-back').addEventListener('change', updateTripsCount);

  // Navigation sidebar clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = link.getAttribute('data-view');
      showView(viewName);
    });
  });

  // Modal open/close actions
  document.getElementById('btn-top-login').addEventListener('click', () => {
    document.getElementById('login-screen').classList.remove('hidden');
  });

  document.getElementById('btn-close-login').addEventListener('click', () => {
    document.getElementById('login-screen').classList.add('hidden');
  });

  // Quick Login Buttons Event Delegation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-login-btn');
    if (btn) {
      e.preventDefault();
      const username = btn.getAttribute('data-user');
      const matched = usersList.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
      if (matched) {
        loginUser(matched);
      } else {
        showToast("ไม่พบข้อมูลผู้ใช้นี้ในระบบฐานข้อมูลองค์การสะพานปลา", "error");
      }
    }
  });

  // View PDF/Image License File Event Delegation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-license-file');
    if (btn) {
      e.preventDefault();
      const bId = btn.getAttribute('data-booking-id');
      const b = bookings.find(x => x.id === bId);
      if (b && b.driverLicenseFile) {
        openBase64File(b.driverLicenseFile, `ใบขับขี่_${b.requester}`);
      }
    }
  });


  document.getElementById('btn-open-booking').addEventListener('click', () => {
    document.getElementById('modal-booking').classList.add('active');
    
    // Set default request form datetime options
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16);
    
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Default +2 hours
    const futureISOTime = (new Date(future - tzOffset)).toISOString().slice(0, 16);
    
    if (fpStart) {
      fpStart.setDate(localISOTime);
    } else {
      document.getElementById('input-start-date').value = localISOTime;
    }
    if (fpEnd) {
      fpEnd.setDate(futureISOTime);
    } else {
      document.getElementById('input-end-date').value = futureISOTime;
    }
    
    // Reset trip checkboxes and value
    document.getElementById('check-car-go').checked = true;
    document.getElementById('check-car-back').checked = true;
    document.getElementById('input-trips').value = 2;

    // Reset driver's license upload state, UI and welfare address fields
    uploadedDriverLicenseBase64 = null;
    const licenseSection = document.getElementById('driver-license-section');
    if (licenseSection) {
      licenseSection.style.display = 'none';
      document.getElementById('input-driver-license').value = '';
      document.getElementById('input-driver-license').removeAttribute('required');
      document.getElementById('driver-license-filename').textContent = 'ยังไม่ได้เลือกไฟล์';
      document.getElementById('driver-license-preview-container').style.display = 'none';
      document.getElementById('driver-license-preview').src = '';
    }
    const signatureGrid = document.getElementById('signature-license-grid');
    if (signatureGrid) {
      signatureGrid.classList.remove('split-mode');
    }
    const addressContainer = document.getElementById('welfare-address-container');
    if (addressContainer) {
      addressContainer.style.display = 'none';
      document.getElementById('input-welfare-address-no').value = '';
      document.getElementById('input-welfare-address-moo').value = '';
      document.getElementById('input-welfare-address-road').value = '';
      document.getElementById('input-welfare-address-subdistrict').value = '';
      document.getElementById('input-welfare-address-district').value = '';
      document.getElementById('input-welfare-address-province').value = '';
      
      document.getElementById('input-welfare-address-no').removeAttribute('required');
      document.getElementById('input-welfare-address-subdistrict').removeAttribute('required');
      document.getElementById('input-welfare-address-district').removeAttribute('required');
      document.getElementById('input-welfare-address-province').removeAttribute('required');
    }
    const vehicleRequestTip = document.getElementById('vehicle-request-tip');
    if (vehicleRequestTip) {
      vehicleRequestTip.innerHTML = '💡 ขอใช้รถยนต์ของ อสป. (การจัดจัดสรรรถยนต์และพนักงานขับรถจะดำเนินการมอบหมายโดยผู้จัดรถ (L2) ในขั้นตอนพิจารณาอนุมัติ)';
    }
    const radioFmo = document.querySelector('input[name="control-unit"][value="อสป."]');
    if (radioFmo) radioFmo.checked = true;

    // Resize canvas and then load/draw user signature after modal is visible
    setTimeout(() => {
      if (requesterSig) {
        requesterSig.resize();
        requesterSig.clear();
        if (currentUser && currentUser.sign && currentUser.sign.startsWith('data:image')) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.getElementById('canvas-requester-signature');
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const hRatio = canvas.width / img.width;
              const vRatio = canvas.height / img.height;
              const ratio = Math.min(hRatio, vRatio);
              const x = (canvas.width - img.width * ratio) / 2;
              const y = (canvas.height - img.height * ratio) / 2;
              ctx.drawImage(img, x, y, img.width * ratio, img.height * ratio);
              
              const placeholder = document.getElementById('requester-sig-placeholder');
              if (placeholder) placeholder.style.display = 'none';
            }
          };
          img.src = currentUser.sign;
        }
      }
    }, 100);
  });

  document.getElementById('btn-close-booking').addEventListener('click', () => {
    document.getElementById('modal-booking').classList.remove('active');
  });

  document.getElementById('btn-cancel-booking').addEventListener('click', () => {
    document.getElementById('modal-booking').classList.remove('active');
  });

  document.getElementById('btn-close-approval').addEventListener('click', () => {
    document.getElementById('modal-approval').classList.remove('active');
  });



  // Booking Creation Submission
  document.getElementById('form-create-booking').addEventListener('submit', (e) => {
    e.preventDefault();

    if (requesterSig.isEmpty()) {
      showToast("กรุณาลงลายมือชื่อผู้ขอใช้รถในกระดานลงนามดิจิทัลด้านล่างก่อนส่งใบคำขอ", "warning");
      return;
    }

    const travelType = 'fmo_car';
    const carId = ""; // No car assigned yet!
    const startDate = document.getElementById('input-start-date').value;
    const endDate = document.getElementById('input-end-date').value;
    
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      alert("วันที่สิ้นสุดการจองต้องไม่น้อยกว่าวันที่เริ่มจอง");
      showToast("วันที่สิ้นสุดการจองต้องไม่น้อยกว่าวันที่เริ่มจอง", "warning");
      return;
    }

    const purpose = document.getElementById('input-purpose').value;
    const destination = document.getElementById('input-destination').value;
    const ref = document.getElementById('input-ref').value;
    const passengers = document.getElementById('input-passengers').value;
    const trips = parseInt(document.getElementById('input-trips').value) || 1;

    const distance = 0;
    const price = 0;

    const goCheck = document.getElementById('check-car-go').checked;
    const backCheck = document.getElementById('check-car-back').checked;

    // 1. สร้างรหัสใบจองแบบใหม่ (BGK-ปีเดือน-เลขรัน)
    const newBookingId = generateNewBookingId();

    // 2. ดึงอีเมลหัวหน้างานจากข้อมูลผู้ใช้ที่ล็อกอิน (บังคับต้องมีหัวหน้า)
    const managerEmail = currentUser.manager_email;

    // 3. 🚨 ดักตรวจสอบ: ถ้าไม่มีอีเมลหัวหน้า ให้บล็อกการจองและเด้งแจ้งเตือน
    if (!managerEmail || managerEmail.trim() === '') {
      showToast("ไม่อนุญาตให้ทำรายการ: ท่านยังไม่มีข้อมูลอีเมลหัวหน้างานในระบบ กรุณาติดต่อผู้ดูแลระบบ", "error");
      return; // หยุดการทำงานทันที ใบจองจะไม่ถูกสร้าง
    }

    const controlUnit = document.querySelector('input[name="control-unit"]:checked').value;
    let addressNo = '';
    let addressMoo = '';
    let addressRoad = '';
    let addressSubdistrict = '';
    let addressDistrict = '';
    let addressProvince = '';

    if (controlUnit === 'รถสวัสดิการ') {
      addressNo = document.getElementById('input-welfare-address-no').value.trim();
      addressMoo = document.getElementById('input-welfare-address-moo').value.trim();
      addressRoad = document.getElementById('input-welfare-address-road').value.trim();
      addressSubdistrict = document.getElementById('input-welfare-address-subdistrict').value.trim();
      addressDistrict = document.getElementById('input-welfare-address-district').value.trim();
      addressProvince = document.getElementById('input-welfare-address-province').value.trim();

      if (!addressNo || !addressSubdistrict || !addressDistrict || !addressProvince) {
        showToast("กรุณากรอกข้อมูลที่อยู่ผู้ขอใช้รถยนต์สวัสดิการให้ครบถ้วน (บ้านเลขที่, ตำบล, อำเภอ, จังหวัด)", "warning");
        return;
      }

      if (!uploadedDriverLicenseBase64) {
        showToast("กรุณาอัปโหลดสำเนาใบขับขี่เพื่อขอสิทธิ์จองรถสวัสดิการ", "warning");
        return;
      }
      
      // Enforce 1 request per fiscal year per user (Oct 1st - Sep 30th)
      if (checkWelfareBookingLimit(startDate)) {
        const d = new Date(startDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const fiscalYear = m >= 9 ? y + 1 : y;
        showToast(`ขออภัย! ใน 1 ปีงบประมาณ ท่านสามารถใช้สิทธิ์ขอรถสวัสดิการได้เพียง 1 ครั้งเท่านั้น (ท่านมีคำขอสิทธิ์ในระบบสำหรับปีงบประมาณ พ.ศ. ${fiscalYear + 543} แล้ว)`, "error");
        return;
      }
    }

    // 4. สร้างชุดข้อมูลใบจองใหม่
    const newBooking = {
      id: newBookingId,
      requester: document.getElementById('input-requester').value,
      requesterEmail: currentUser.email || '',
      managerEmail: managerEmail,
      position: document.getElementById('input-position').value,
      department: document.getElementById('input-department').value,
      office: document.getElementById('input-office').value,
      division: document.getElementById('input-division').value,
      controlUnit: controlUnit,
      driverLicenseFile: controlUnit === 'รถสวัสดิการ' ? uploadedDriverLicenseBase64 : null,
      addressNo: controlUnit === 'รถสวัสดิการ' ? addressNo : '',
      addressMoo: controlUnit === 'รถสวัสดิการ' ? addressMoo : '',
      addressRoad: controlUnit === 'รถสวัสดิการ' ? addressRoad : '',
      addressSubdistrict: controlUnit === 'รถสวัสดิการ' ? addressSubdistrict : '',
      addressDistrict: controlUnit === 'รถสวัสดิการ' ? addressDistrict : '',
      addressProvince: controlUnit === 'รถสวัสดิการ' ? addressProvince : '',
      purpose,
      destination,
      ref,
      passengers,
      startDate,
      endDate,
      trips,
      travelType,
      carId,
      distance,
      price,
      goCheck,
      backCheck,
      status: 'pending', // 🚨 สถานะรอหัวหน้าอนุมัติ
      currentApprovalLevel: 1,
      driverName: '',
      signatures: [
        { level: 0, approverName: currentUser.name, status: 'approved', timestamp: new Date().toISOString(), signature: requesterSig.getDataUrl() },
        { level: 1, role: 'supervisor', approverName: '', status: 'pending', comment: '', timestamp: '', signature: '' },
        { level: 2, role: 'fleet_admin', approverName: '', status: 'pending', comment: '', timestamp: '', signature: '', driverName: '' },
        { level: 3, role: 'director', approverName: '', status: 'pending', comment: '', timestamp: '', signature: '' },
        { level: 4, role: 'executive', approverName: '', status: 'pending', comment: '', timestamp: '', signature: '' }
      ]
    };

    // 5. นำใบจองเข้าตารางและสั่งบันทึก
    bookings.push(newBooking);
    saveBookings();
    
    // Reset create modal
    document.getElementById('modal-booking').classList.remove('active');
    document.getElementById('form-create-booking').reset();
    if (fpStart) fpStart.clear();
    if (fpEnd) fpEnd.clear();
    requesterSig.clear();

    // Reset upload state
    uploadedDriverLicenseBase64 = null;
    const filenameEl = document.getElementById('driver-license-filename');
    if (filenameEl) filenameEl.textContent = 'ยังไม่ได้เลือกไฟล์';
    const previewContainer = document.getElementById('driver-license-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';
    const previewEl = document.getElementById('driver-license-preview');
    if (previewEl) previewEl.src = '';
    // Re-render
    renderDashboard();
    renderBookingsLists();
    renderMonthCalendar();

    // Trigger email to manager (L1)
    const subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ เลขที่ ${newBooking.id} รอการตรวจสอบเห็นชอบ`;
    const body = `
      <p>เรียน หัวหน้าแผนกผู้ควบคุม,</p>
      <p>มีรายการเสนอขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะใหม่เสนอเข้ามาในระบบ และรอการพิจารณาตรวจเห็นชอบจากท่านในระดับ <strong>หัวหน้าแผนก (L1)</strong></p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
        <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${newBooking.id}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${newBooking.requester} (${newBooking.position})</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">เรื่อง/วัตถุประสงค์:</td><td style="padding: 6px 0;">${newBooking.purpose}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${newBooking.destination || '-'}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">ช่วงเวลาเดินทาง:</td><td style="padding: 6px 0;">${formatThaiDateTime(newBooking.startDate)} ถึง ${formatThaiDateTime(newBooking.endDate)}</td></tr>
      </table>
      <p>ท่านสามารถคลิกเข้าสู่ระบบเพื่อพิจารณาลงความเห็นชอบหรือปฏิเสธคำขอได้ที่ลิงก์ด้านล่างนี้:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
      </div>
    `;
    sendEmailNotification(newBooking.managerEmail, subject, body);

    showToast(`บันทึกการส่งเสนอคำขอจองใช้พาหนะรหัสใบคำเสนอ ${newBookingId} เรียบร้อยแล้ว`, "success");
  });

  // Login Form Submission
  document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;

    const matched = usersList.find(u => u.username.toLowerCase() === user.trim().toLowerCase());
    if (matched) {
      // Validate password (accept employee_id or demo quick keys)
      if (pass === matched.employee_id || pass === '1' || pass === '2' || pass === '07170004' || pass === '07170005' || pass === '07170010' || pass === 'admin') {
        loginUser(matched);
      } else {
        showToast("รหัสผ่านไม่ถูกต้อง (รหัสพนักงาน สำหรับการยืนยันตัวตนจำลอง)", "error");
      }
    } else {
      showToast("ไม่พบข้อมูลผู้ใช้นี้ในระบบฐานข้อมูลองค์การสะพานปลา", "error");
    }
  });

  // Logout button
  function logoutUser() {
  // 1. ล้างข้อมูลผู้ใช้งานออกจากระบบทั้งหมด
  currentUser = null;
  localStorage.removeItem('current_user');
  sessionStorage.removeItem('activeApprovalLevel'); // ล้างค่า Dropdown ที่อาจจะเลือกค้างไว้

  // 2. ซ่อนกล่องโปรไฟล์และกล่อง Dropdown ทันที
  const headerProfile = document.getElementById('header-user-profile');
  if (headerProfile) {
    headerProfile.classList.add('hidden');
  }
  
  const approvalContainer = document.getElementById('approval-level-container');
  if (approvalContainer) {
    approvalContainer.classList.add('hidden');
  }

  // 3. รีโหลดหน้าเว็บ 1 ครั้ง เพื่อเคลียร์ข้อมูลตารางงานและกลับสู่หน้าจอเริ่มต้น (บุคคลทั่วไป)
  window.location.reload(); 
}

  // Review Approvals action panel buttons
  document.getElementById('btn-approve-request').addEventListener('click', () => handleApprovalAction(true));
  document.getElementById('btn-reject-request').addEventListener('click', () => handleApprovalAction(false));

  // Report Sheet controls
  document.getElementById('btn-report-back').addEventListener('click', () => {
    showView('bookings');
  });

  document.getElementById('btn-report-print').addEventListener('click', () => {
    window.print();
  });

  // Calendar monthly controls
  document.getElementById('btn-cal-prev').addEventListener('click', () => {
    calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
    renderMonthCalendar();
  });

  document.getElementById('btn-cal-next').addEventListener('click', () => {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
    renderMonthCalendar();
  });

  document.getElementById('filter-cal-car').addEventListener('change', (e) => {
    calFilterCar = e.target.value;
    renderMonthCalendar();
  });

  document.getElementById('assign-car').addEventListener('change', (e) => {
    const driverInput = document.getElementById('assign-driver');
    if (driverInput) {
      if (e.target.value === 'taxi') {
        driverInput.value = '-';
        driverInput.disabled = true;
      } else {
        driverInput.disabled = false;
        const car = cars.find(c => c.id === e.target.value);
        driverInput.value = car ? (car.driverName || '') : '';
      }
    }
  });

  document.getElementById('edit-assign-car').addEventListener('change', (e) => {
    const editDriverInput = document.getElementById('edit-assign-driver');
    if (editDriverInput) {
      if (e.target.value === 'taxi') {
        editDriverInput.value = '-';
        editDriverInput.disabled = true;
      } else {
        editDriverInput.disabled = false;
        const car = cars.find(c => c.id === e.target.value);
        editDriverInput.value = car ? (car.driverName || '') : '';
      }
    }
  });

  document.getElementById('btn-save-car-changes').addEventListener('click', () => {
    if (!activeBookingIdForApproval) return;
    const booking = bookings.find(b => b.id === activeBookingIdForApproval);
    if (!booking) return;

    const assignedCarId = document.getElementById('edit-assign-car').value;
    if (!assignedCarId) {
      showToast("กรุณาเลือกรถยนต์ของ อสป. หรือแท็กซี่ (TAXI)", "warning");
      return;
    }

    let assignedDriver = '';
    if (assignedCarId === 'taxi') {
      booking.travelType = 'public_car';
      booking.carId = '';
      booking.driverName = '-';
      booking.status = 'pending';
      booking.currentApprovalLevel = 2;
      booking.waitingForRequesterInput = true;
      
      // Reset L2, L3, L4 signatures
      booking.signatures.forEach(sig => {
        if (sig.level >= 2) {
          sig.status = 'pending';
          sig.approverName = '';
          sig.comment = '';
          sig.timestamp = '';
          sig.signature = '';
        }
      });
      
      saveBookings();
      document.getElementById('modal-approval').classList.remove('active');
      
      // Re-render UI views
      updateStats();
      renderDashboard();
      renderBookingsLists();
      renderMonthCalendar();

      // Trigger email notification (L2 -> L0 TAXI Loop)
      const reqEmail = resolveRequesterEmail(booking);
      const subject = `[ระบบจองรถ อสป.] กรุณาระบุรายละเอียดค่าพาหนะรถรับจ้างสำหรับคำขอ เลขที่ ${booking.id}`;
      const body = `
        <p>เรียน คุณ ${booking.requester},</p>
        <p>ใบขออนุญาตใช้ยานพาหนะเลขที่ <strong>${booking.id}</strong> ของท่าน ได้รับความเห็นในการจัดสรรพาหนะเดินทางแบบ <strong>รถรับจ้างสาธารณะ (TAXI)</strong> เนื่องจากรถยนต์ส่วนกลางไม่ว่างปฏิบัติงานในช่วงเวลาดังกล่าว</p>
        <p>รบกวนท่านเข้าสู่ระบบเพื่อดำเนินการกรอกข้อมูล <strong>ระยะทางประมาณการ (กิโลเมตร)</strong> และ <strong>วงเงินงบประมาณเบิกจ่ายโดยประมาณ (บาท)</strong> เพื่อส่งใบงานกลับไปดำเนินการเสนออนุมัติตามลำดับขั้นต่อไป</p>
        <p>ท่านสามารถคลิกที่ปุ่มสีแดง <strong>[กรอกค่าพาหนะ]</strong> ในตารางรายการที่ฉันขอ เพื่อระบุข้อมูลได้ทันที:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="https://car-booking.fishmarket.co.th/" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">กรอกรายละเอียดค่าพาหนะ</a>
        </div>
      `;
      sendEmailNotification(reqEmail, subject, body);
      
      showToast(`ได้ส่งใบคำขอรหัส ${booking.id} กลับไปยังผู้ขอรถ (${booking.requester}) เพื่อกรอกข้อมูลระยะทางและค่าใช้จ่ายรถรับจ้างเรียบร้อยแล้ว`, "success");
      return;
    } else {
      // Conflict check (exclude the current booking id so it can re-select its current car if needed)
      if (hasBookingConflict(assignedCarId, booking.startDate, booking.endDate, booking.id)) {
        showToast("ขออภัย! รถยนต์คันนี้ได้รับการจองในช่วงเวลานี้แล้ว กรุณาเลือกรถยนต์คันอื่น", "error");
        return;
      }

      assignedDriver = document.getElementById('edit-assign-driver').value;
      if (!assignedDriver.trim() || assignedDriver === '-') {
        showToast("กรุณาระบุชื่อพนักงานขับรถปฏิบัติหน้าที่", "warning");
        return;
      }
      booking.travelType = 'fmo_car';
      booking.carId = assignedCarId;
      booking.driverName = assignedDriver;
    }

    saveBookings();
    document.getElementById('modal-approval').classList.remove('active');

    // Trigger toast notification
    showToast("บันทึกการปรับเปลี่ยนยานพาหนะเรียบร้อยแล้ว", "success");

    // Re-render UI
    updateStats();
    renderDashboard();
    renderBookingsLists();
    renderMonthCalendar();

    // Trigger email notification to requester
    const reqEmail = resolveRequesterEmail(booking);
    const subject = `[ระบบจองรถ อสป.] แจ้งเปลี่ยนประเภทพาหนะ / รถยนต์สำหรับคำขอ เลขที่ ${booking.id}`;
    let carDetails = '';
    if (booking.travelType === 'fmo_car') {
      let carObj = cars.find(c => c.id === booking.carId);
      if (!carObj && booking.driverName && booking.driverName !== '-') {
        const searchName = booking.driverName.replace(/\s+/g, '');
        carObj = cars.find(c => c.driverName && c.driverName.replace(/\s+/g, '') === searchName);
      }
      const phone = carObj && carObj.phone ? carObj.phone : getDriverPhoneByName(booking.driverName);
      const driverNameWithPhone = (booking.driverName && booking.driverName !== '-') ? `${booking.driverName}${phone ? ` (โทร. ${phone})` : ''}` : '-';
      carDetails = `<strong>รถตู้ อสป. ทะเบียน ${carObj ? carObj.plate : '-'} (คนขับ: ${driverNameWithPhone})</strong>`;
    } else {
      carDetails = `<strong>รถรับจ้างสาธารณะ (TAXI)</strong>`;
    }

    const body = `
      <p>เรียน คุณ ${booking.requester},</p>
      <p>งานยานพาหนะ (L2) ได้ดำเนินการปรับเปลี่ยนการจัดสรรยานพาหนะสำหรับใบเสนอจองเลขที่ <strong>${booking.id}</strong> ของท่าน</p>
      <p>โดยได้รับการเปลี่ยนเป็น: ${carDetails}</p>
      <p>ท่านสามารถตรวจสอบการอัปเดตสถานะและพิมพ์ใบรายงานได้ผ่านหน้าเว็บระบบจองรถยนต์ อสป. ครับ</p>
    `;
    sendEmailNotification(reqEmail, subject, body);
  });

  // Bookings list tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentNode.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      const parent = btn.parentNode.parentNode;
      parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });

  // Show / hide driver license container and address based on control-unit radio selection
  document.querySelectorAll('input[name="control-unit"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const licenseSection = document.getElementById('driver-license-section');
      const licenseInput = document.getElementById('input-driver-license');
      const signatureGrid = document.getElementById('signature-license-grid');
      const addressContainer = document.getElementById('welfare-address-container');
      
      const addressNo = document.getElementById('input-welfare-address-no');
      const addressSubdistrict = document.getElementById('input-welfare-address-subdistrict');
      const addressDistrict = document.getElementById('input-welfare-address-district');
      const addressProvince = document.getElementById('input-welfare-address-province');
      
      const vehicleRequestTip = document.getElementById('vehicle-request-tip');
      if (e.target.value === 'รถสวัสดิการ') {
        if (vehicleRequestTip) {
          vehicleRequestTip.innerHTML = '💡 ขอใช้รถยนต์สวัสดิการ (การจัดจัดสรรรถยนต์และพนักงานขับรถจะดำเนินการมอบหมายโดยผู้จัดรถ (L2) ในขั้นตอนพิจารณาอนุมัติ)';
        }
        // Check Welfare Car 1-per-fiscal-year limit immediately on selection
        const startDate = document.getElementById('input-start-date').value;
        if (checkWelfareBookingLimit(startDate)) {
          const d = new Date(startDate);
          const y = d.getFullYear();
          const m = d.getMonth();
          const fiscalYear = m >= 9 ? y + 1 : y;
          showToast(`ขออภัย! ในปีงบประมาณ พ.ศ. ${fiscalYear + 543} ท่านได้ใช้สิทธิ์ขอรถสวัสดิการไปแล้ว (จำกัด 1 ครั้งต่อปีงบประมาณ)`, "error");
          
          // Switch back to "อสป."
          const radioFmo = document.querySelector('input[name="control-unit"][value="อสป."]');
          if (radioFmo) {
            radioFmo.checked = true;
            radioFmo.dispatchEvent(new Event('change'));
          }
          return;
        }

        if (licenseSection) licenseSection.style.display = 'block';
        if (signatureGrid) signatureGrid.classList.add('split-mode');
        if (addressContainer) addressContainer.style.display = 'block';
        if (licenseInput) licenseInput.setAttribute('required', 'required');
        
        // Make address fields required when Welfare Car is selected
        if (addressNo) addressNo.setAttribute('required', 'required');
        if (addressSubdistrict) addressSubdistrict.setAttribute('required', 'required');
        if (addressDistrict) addressDistrict.setAttribute('required', 'required');
        if (addressProvince) addressProvince.setAttribute('required', 'required');
      } else {
        if (vehicleRequestTip) {
          vehicleRequestTip.innerHTML = '💡 ขอใช้รถยนต์ของ อสป. (การจัดจัดสรรรถยนต์และพนักงานขับรถจะดำเนินการมอบหมายโดยผู้จัดรถ (L2) ในขั้นตอนพิจารณาอนุมัติ)';
        }
        if (licenseSection) licenseSection.style.display = 'none';
        if (signatureGrid) signatureGrid.classList.remove('split-mode');
        if (addressContainer) addressContainer.style.display = 'none';
        if (licenseInput) licenseInput.removeAttribute('required');
        
        // Remove required from address fields when not Welfare Car
        if (addressNo) addressNo.removeAttribute('required');
        if (addressSubdistrict) addressSubdistrict.removeAttribute('required');
        if (addressDistrict) addressDistrict.removeAttribute('required');
        if (addressProvince) addressProvince.removeAttribute('required');
      }
    });
  });

  // Handle start date change validation for Welfare Car limit
  document.getElementById('input-start-date').addEventListener('change', (e) => {
    const welfareRadio = document.querySelector('input[name="control-unit"][value="รถสวัสดิการ"]');
    if (welfareRadio && welfareRadio.checked) {
      const startDate = e.target.value;
      if (checkWelfareBookingLimit(startDate)) {
        const d = new Date(startDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const fiscalYear = m >= 9 ? y + 1 : y;
        showToast(`ขออภัย! ในปีงบประมาณ พ.ศ. ${fiscalYear + 543} ท่านได้ใช้สิทธิ์ขอรถสวัสดิการไปแล้ว (จำกัด 1 ครั้งต่อปีงบประมาณ)`, "error");
        
        // Switch back to "อสป."
        const radioFmo = document.querySelector('input[name="control-unit"][value="อสป."]');
        if (radioFmo) {
          radioFmo.checked = true;
          radioFmo.dispatchEvent(new Event('change'));
        }
      }
    }
  });

  // Validate end date immediately upon change
  document.getElementById('input-end-date').addEventListener('change', (e) => {
    const startDate = document.getElementById('input-start-date').value;
    const endDate = e.target.value;
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      alert("วันที่สิ้นสุดการจองต้องไม่น้อยกว่าวันที่เริ่มจอง");
      showToast("วันที่สิ้นสุดการจองต้องไม่น้อยกว่าวันที่เริ่มจอง", "warning");
      e.target.value = ""; // clear invalid end date
    }
  });

  // Handle driver's license file upload, verification, and canvas compression
  const licenseInput = document.getElementById('input-driver-license');
  if (licenseInput) {
    licenseInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const filenameEl = document.getElementById('driver-license-filename');
      const previewContainer = document.getElementById('driver-license-preview-container');
      const previewEl = document.getElementById('driver-license-preview');
      
      if (!file) {
        if (filenameEl) filenameEl.textContent = 'ยังไม่ได้เลือกไฟล์';
        if (previewContainer) previewContainer.style.display = 'none';
        uploadedDriverLicenseBase64 = null;
        return;
      }
      
      if (filenameEl) filenameEl.textContent = file.name;
      
      if (file.type.startsWith('image/')) {
        compressImage(file, (dataUrl) => {
          uploadedDriverLicenseBase64 = dataUrl;
          if (previewEl) previewEl.src = dataUrl;
          if (previewContainer) previewContainer.style.display = 'block';
        });
      } else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (event) => {
          uploadedDriverLicenseBase64 = event.target.result;
          if (previewContainer) previewContainer.style.display = 'none'; // No image preview for PDF
        };
        reader.readAsDataURL(file);
      } else {
        showToast("กรุณาเลือกไฟล์รูปภาพหรือ PDF เท่านั้น", "warning");
        e.target.value = '';
        if (filenameEl) filenameEl.textContent = 'ยังไม่ได้เลือกไฟล์';
        if (previewContainer) previewContainer.style.display = 'none';
        uploadedDriverLicenseBase64 = null;
      }
    });
  }

  setupFillTaxiHandler();

  // Delegated click event handler for returning car early
  const carListContainer = document.getElementById('car-list-container');
  if (carListContainer) {
    carListContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-return-early');
      if (btn) {
        const bookingId = btn.getAttribute('data-booking-id');
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) {
          // Premium toast-styled confirmation box
          let confirmBox = document.createElement('div');
          confirmBox.className = 'custom-confirm-dialog';
          confirmBox.innerHTML = `
            <div class="custom-confirm-box" style="background: var(--bg-card); border: 1px solid var(--border-color); box-shadow: var(--shadow-lg); padding: 1.5rem; border-radius: 12px; max-width: 400px; text-align: center;">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔄</div>
              <h3 style="margin-bottom: 0.5rem; color: var(--warning); font-family: Sarabun, sans-serif;">คืนรถยนต์ก่อนเวลา?</h3>
              <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem; font-family: Sarabun, sans-serif;">ยืนยันที่จะทำคืนยานพาหนะคันนี้เพื่อเปลี่ยนสถานะเป็น "ว่าง" พร้อมใช้งานทันทีใช่หรือไม่?</p>
              <div style="display: flex; gap: 0.75rem; justify-content: center;">
                <button class="btn btn-secondary btn-sm" id="btn-cancel-return-early" style="padding: 0.4rem 1rem;">ยกเลิก</button>
                <button class="btn btn-warning btn-sm" id="btn-confirm-return-early" style="padding: 0.4rem 1rem;">ยืนยันคืนรถ</button>
              </div>
            </div>
          `;
          document.body.appendChild(confirmBox);
          
          document.getElementById('btn-cancel-return-early').onclick = () => {
            document.body.removeChild(confirmBox);
          };
          
          document.getElementById('btn-confirm-return-early').onclick = () => {
            document.body.removeChild(confirmBox);
            
            // Set end date to current time to free the car
            booking.endDate = new Date().toISOString();
            saveBookings();
            
            // Set toast indicator to show after reload
            localStorage.setItem('return_early_toast_success', `ทำรายการคืนรถยนต์ก่อนเวลา เลขที่ใบคำขอ ${bookingId} เรียบร้อยแล้ว`);
            window.location.reload();
          };
        }
      }
    });
  }
}

function openFillTaxiModal(bookingId) {
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const modal = document.getElementById('modal-fill-taxi');
  if (!modal) return;

  document.getElementById('fill-taxi-booking-id').value = bookingId;
  document.getElementById('fill-distance').value = booking.distance || '';
  document.getElementById('fill-price').value = booking.price || '';

  modal.classList.add('active');
}

function setupFillTaxiHandler() {
  const form = document.getElementById('form-fill-taxi');
  const cancelBtn = document.getElementById('btn-cancel-fill-taxi');
  const closeBtn = document.getElementById('btn-close-fill-taxi');
  const modal = document.getElementById('modal-fill-taxi');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bookingId = document.getElementById('fill-taxi-booking-id').value;
      const distance = parseFloat(document.getElementById('fill-distance').value);
      const price = parseFloat(document.getElementById('fill-price').value);

      if (isNaN(distance) || distance <= 0 || isNaN(price) || price <= 0) {
        showToast("กรุณากรอกระยะทางและจำนวนเงินให้ถูกต้อง", "warning");
        return;
      }

      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        booking.distance = distance;
        booking.price = price;
        booking.waitingForRequesterInput = false;
        booking.currentApprovalLevel = 1; // Send back to L1

        // Reset approval signatures from L1 onwards
        booking.signatures.forEach(sig => {
          if (sig.level >= 1) {
            sig.approverName = '';
            sig.status = 'pending';
            sig.comment = '';
            sig.timestamp = '';
            sig.signature = '';
            if (sig.level === 2) {
              sig.driverName = '';
            }
          }
        });

        saveBookings();
        modal.classList.remove('active');
        
        // Re-render UI
        updateStats();
        renderDashboard();
        renderBookingsLists();
        renderMonthCalendar();

        // Trigger email notification to L1 (manager)
        const toEmail = resolveManagerEmail(booking);
        const subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ (จัดสรร TAXI) เลขที่ ${booking.id} รอการตรวจสอบเห็นชอบ`;
        const body = `
          <p>เรียน หัวหน้าแผนกผู้ควบคุม,</p>
          <p>มีรายการเสนอขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะใหม่ (จัดสรรเป็นรถรับจ้าง TAXI) รหัสใบขอใช้เลขที่ <strong>${booking.id}</strong> ได้รับการระบุระยะทางและประมาณการค่าใช้จ่ายเดินทางเรียบร้อยแล้ว และเสนอขึ้นมายังท่านเพื่อพิจารณาตรวจเห็นชอบในระดับ <strong>หัวหน้าแผนก (L1)</strong> อีกครั้ง</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${booking.id}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${booking.requester} (${booking.position || ''})</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">เรื่อง/วัตถุประสงค์:</td><td style="padding: 6px 0;">${booking.purpose}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${booking.destination || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">ระยะทางโดยประมาณ:</td><td style="padding: 6px 0;">${distance} กิโลเมตร</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">วงเงินประมาณค่าพาหนะ:</td><td style="padding: 6px 0;">${price} บาท</td></tr>
          </table>
          <p>ท่านสามารถคลิกเข้าสู่ระบบเพื่อพิจารณาลงความเห็นชอบหรือปฏิเสธคำขอได้ที่ลิงก์ด้านล่างนี้:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
          </div>
        `;
        sendEmailNotification(toEmail, subject, body);

        showToast(`บันทึกข้อมูลระยะทาง ${distance} กม. และค่าใช้จ่ายประมาณ ${price} บาท เรียบร้อยแล้ว ระบบได้ส่งเอกสารกลับไปเริ่มกระบวนการอนุมัติที่หัวหน้าแผนก (L1) อีกครั้ง`, "success");
      }
    });
  }

  const hideModal = () => {
    if (modal) modal.classList.remove('active');
  };

  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
  if (closeBtn) closeBtn.addEventListener('click', hideModal);
}

// File Upload Signature Handler
function handleSignatureUpload(fileInputId, sigPad, canvasId, placeholderId) {
  const fileInput = document.getElementById(fileInputId);
  const canvas = document.getElementById(canvasId);
  const placeholder = document.getElementById(placeholderId);
  if (!fileInput || !canvas || !sigPad) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        // Ensure canvas width & height match client size
        sigPad.resize();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Remove light-colored backgrounds (paper, scanner brightness, etc.)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imgData.data;
        
        // Light pixels (RGB >= 200) get mapped to transparent (alpha = 0)
        const threshold = 205; 
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          // Average brightness check
          const brightness = (r + g + b) / 3;
          if (brightness >= threshold) {
            data[i+3] = 0; // Set transparency alpha to 0
          }
        }
        tempCtx.putImageData(imgData, 0, 0);

        // Draw the transparent processed canvas scaled to fit the signature box
        const hRatio = canvas.width / tempCanvas.width;
        const vRatio = canvas.height / tempCanvas.height;
        const ratio = Math.min(hRatio, vRatio);
        const x = (canvas.width - tempCanvas.width * ratio) / 2;
        const y = (canvas.height - tempCanvas.height * ratio) / 2;
        
        ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, x, y, tempCanvas.width * ratio, tempCanvas.height * ratio);
        
        if (placeholder) placeholder.style.display = 'none';
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    fileInput.value = ''; // Clear selection
  });
}
// ฟังก์ชันนี้ใช้สำหรับระบุว่าใครสามารถอนุมัติ L ไหนได้บ้าง (ให้เรียกใช้ในฟังก์ชัน Login)
function assignUserPermissions(userObj) {
  const username = (userObj.username || '').toLowerCase();
  const positionText = userObj.position || '';
  userObj.canApprove = []; // สร้าง Array เก็บสิทธิ์

  // 1. ซารีนา: เป็น L1 กับ รักษาการ L4
  if (username === 'sarena.m') {
    userObj.canApprove = [1, 4];
  } 
  // 2. ฉลอง, ศักดา: เป็น L2
  else if (username === 'chalong.c' || username === 'sakda.a') {
    userObj.canApprove = [2];
  } 
  // 3. พนาดร: เป็น L3 (ส่วนสายสุนีย์อยู่ด้านล่างเพราะมี L4 ด้วย)
  else if (username === 'panadon.p') {
    userObj.canApprove = [3];
  } 
  // 4. สายสุนีย์: เป็น L1, L3 และ L4
  else if (username === 'saisunee.p') {
    userObj.canApprove = [1, 3, 4];
  } 
  // 5. ปิยวรรณ: เป็น L4
  else if (username === 'piyawan.k') {
    userObj.canApprove = [4];
  }
  else if (username === 'jaruwan.s' || username === 'supachai.j' || username === 'patiyoot.k') {
    userObj.canApprove = [1];
  } 
  // 6. หัวหน้างาน L1 คนอื่นๆ ทั่วไป (เช่น ตรวจสอบจากตำแหน่ง หรือ role ใน Database)
  else if (
    userObj.role === 'supervisor' ||
    positionText.includes('หัวหน้าสำนักงาน') ||
    positionText.includes('หัวหน้าแผนก') ||
    positionText.includes('ร.หส.') ||
    positionText.includes('ร.หผ.')
  ) {
    userObj.canApprove = [1];
  }
}
// ฟังก์ชันนี้เรียกใช้หลังจาก Login เสร็จ เพื่อเช็คว่าต้องโชว์ Dropdown ไหม
function initApprovalSwitcher() {
  const container = document.getElementById('approval-level-container');
  const switcher = document.getElementById('approval-level-switcher');
  const bookingBtn = document.getElementById('btn-open-booking');

  if (!container) return; // ป้องกัน Error ถ้าหา element ไม่เจอ

  // 1. ถ้ายังไม่ได้ Login ให้ซ่อนเด็ดขาด
  if (!currentUser) {
    container.classList.add('hidden');
    container.style.display = 'none'; // บังคับซ่อน
    if (bookingBtn) bookingBtn.classList.add('hidden');
    return;
  }

  // รีเซ็ตค่าเป็นทั้งหมด
  sessionStorage.setItem('activeApprovalLevel', 'all');

  // 2. ถ้าคนนั้นมีสิทธิ์อนุมัติมากกว่า 1 บทบาท (เช่น สายสุนีย์, ซารีนา)
  if (currentUser.canApprove && currentUser.canApprove.length > 1) {
    container.classList.remove('hidden');
    container.style.display = 'block'; // 🚨 ปลดล็อก! บังคับให้โชว์ออกมา
    
    switcher.innerHTML = '<option value="all">แสดงงานอนุมัติทั้งหมด</option>';
    currentUser.canApprove.forEach(level => {
      let opt = document.createElement('option');
      opt.value = level;
      opt.innerHTML = `ทำงานในฐานะ L${level}`;
      switcher.appendChild(opt);
    });

    switcher.onchange = (e) => {
      sessionStorage.setItem('activeApprovalLevel', e.target.value);
      updateStats();         
      renderBookingsLists(); 
    };
  } 
  // 3. ถ้ามีบทบาทเดียว หรือไม่มีสิทธิ์อนุมัติ (เช่น ฉลอง, ศักดา หรือพนักงานทั่วไป)
  else {
    container.classList.add('hidden');
    container.style.display = 'none'; // บังคับซ่อน
  }

  // 4. จัดการปุ่ม + เขียนใบขออนุญาต
  // แต่ยกเว้น พนาดร (panadon.p) ที่เป็น L0 และ L3 ทำให้ต้องเห็นปุ่มเขียนใบเสนอจอง
  const isOnlyHighLevelApprover = currentUser.canApprove && 
                                  currentUser.canApprove.length > 0 && 
                                  currentUser.canApprove.every(lvl => lvl >= 3) && 
                                  (currentUser.username || '').toLowerCase() !== 'panadon.p';
  if (isOnlyHighLevelApprover) {
    if (bookingBtn) bookingBtn.classList.add('hidden');
  } else {
    if (bookingBtn) bookingBtn.classList.remove('hidden');
  }
}
// Auto-generate missing email logs for pending bookings that require current user's approval
function autoGenerateMissingEmailLogs() {
  if (!currentUser) return;
  
  let logsUpdated = false;
  const deletedLogs = JSON.parse(localStorage.getItem('deleted_email_logs') || '[]');
  
  bookings.forEach(b => {
    if ((b.status === 'pending' || b.status === 'pending_l1') && !b.waitingForRequesterInput) {
      const lvl = b.currentApprovalLevel;
      let isForCurrentUser = false;
      let targetEmail = '';
      
      if (currentUser.canApprove && currentUser.canApprove.includes(lvl)) {
        if (lvl === 1) {
          const mEmail = resolveManagerEmail(b).toLowerCase();
          const cEmail = (currentUser.email || '').toLowerCase();
          if (mEmail === cEmail || mEmail === '') {
            isForCurrentUser = true;
            targetEmail = currentUser.email || 'ranida.c@fishmarket.co.th';
          }
        } else {
          isForCurrentUser = true;
          targetEmail = currentUser.email || '';
        }
      }
      
      if (isForCurrentUser && targetEmail) {
        const hasLog = emailLogs.some(log => {
          const toMatch = (log.to || '').toLowerCase().includes(targetEmail.toLowerCase());
          const idMatch = (log.subject || '').includes(b.id) || (log.body || '').includes(b.id);
          return toMatch && idMatch;
        });
        
        const isDeleted = deletedLogs.some(del => del.bookingId === b.id && del.level === lvl && del.userEmail.toLowerCase() === targetEmail.toLowerCase());
        
        if (!hasLog && !isDeleted) {
          let subject = '';
          let body = '';
          
          if (lvl === 1) {
            subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ เลขที่ ${b.id} รอการตรวจสอบเห็นชอบ`;
            body = `
              <p>เรียน หัวหน้าแผนกผู้ควบคุม,</p>
              <p>มีรายการเสนอขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะใหม่เสนอเข้ามาในระบบ และรอการพิจารณาตรวจเห็นชอบจากท่านในระดับ <strong>หัวหน้าแผนก (L1)</strong></p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
                <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${b.id}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${b.requester} (${b.position || ''})</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">เรื่อง/วัตถุประสงค์:</td><td style="padding: 6px 0;">${b.purpose}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${b.destination || '-'}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">ช่วงเวลาเดินทาง:</td><td style="padding: 6px 0;">${formatThaiDateTime(b.startDate)} ถึง ${formatThaiDateTime(b.endDate)}</td></tr>
              </table>
              <p>ท่านสามารถคลิกเข้าสู่ระบบเพื่อพิจารณาลงความเห็นชอบหรือปฏิเสธคำขอได้ที่ลิงก์ด้านล่างนี้:</p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
              </div>
            `;
          } else if (lvl === 2) {
            subject = `[ระบบจองรถ อสป.] ใบจองเลขที่ ${b.id} ได้รับการเห็นชอบจาก L1 แล้ว รอจัดรถยนต์`;
            body = `
              <p>เรียน ผู้จัดรถ / งานยานพาหนะ (L2),</p>
              <p>มีใบขออนุญาตใช้รถยนต์เลขที่ <strong>${b.id}</strong> ผ่านความเห็นชอบพิจารณาจากระดับหัวหน้างาน (L1) แล้ว ขณะนี้รอการดำเนินการจากท่านในการจัดสรรยานพาหนะและคนขับรถ</p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
              </div>
            `;
          } else if (lvl === 3) {
            subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ เลขที่ ${b.id} รอการตรวจสอบจาก หส.พด.`;
            body = `
              <p>เรียน หัวหน้าแผนกพัสดุ / หส.พด. (L3),</p>
              <p>มีใบขออนุญาตใช้ยานพาหนะและเบิกจ่ายค่าพาหนะเลขที่ <strong>${b.id}</strong> จัดสรรเสร็จสิ้นและเสนอมายังท่านเพื่อตรวจสอบลงนามอนุมัติใช้ยานพาหนะ</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
                <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${b.id}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${b.requester}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${b.destination || '-'}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:</td><td style="padding: 6px 0;">${b.travelType === 'fmo_car' ? 'รถตู้ อสป.' : 'รถรับจ้างสาธารณะ (TAXI)'}</td></tr>
              </table>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
              </div>
            `;
          } else if (lvl === 4) {
            subject = `[ระบบจองรถ อสป.] รายการขออนุมัติใหม่ เลขที่ ${b.id} รอการอนุมัติเบิกจ่ายจาก ผฝ.บง.`;
            body = `
              <p>เรียน ผู้อำนวยการฝ่ายการเงิน / ผฝ.บง. (L4),</p>
              <p>ใบจองใช้ยานพาหนะและขอเบิกค่าใช้จ่ายเลขที่ <strong>${b.id}</strong> ได้รับการตรวจสอบและลงนามจาก หส.พด. (L3) แล้ว รอการอนุมัติวงเงินเบิกจ่ายจากท่าน</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-size: 14px;">
                <tr><td style="padding: 6px 0; font-weight: bold; width: 140px;">เลขที่คำขอ:</td><td style="padding: 6px 0;">${b.id}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">ผู้เสนอขอจอง:</td><td style="padding: 6px 0;">${b.requester}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">สถานที่ปลายทาง:</td><td style="padding: 6px 0;">${b.destination || '-'}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold;">ประเภทการเดินทาง:</td><td style="padding: 6px 0;">${b.travelType === 'fmo_car' ? 'รถตู้ อสป.' : 'รถรับจ้างสาธารณะ (TAXI)'}</td></tr>
              </table>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://car-booking.fishmarket.co.th/" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: 'Sarabun', sans-serif;">✍️ พิจารณาตรวจอนุมัติ</a>
              </div>
            `;
          }
          
          if (subject && body) {
            const formattedHtml = `
              <div style="font-family: 'Sarabun', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <div style="border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; text-align: center;">
                  <h2 style="color: #0f172a; margin: 0 0 5px 0; font-size: 20px;">ระบบจองใช้ยานพาหนะและเบิกจ่ายค่าพาหนะ</h2>
                  <span style="color: #64748b; font-size: 13px;">องค์การสะพานปลา (FMO)</span>
                </div>
                <div style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                  ${body}
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.4;">
                  อีเมลฉบับนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับอีเมลนี้<br>
                  องค์การสะพานปลา &copy; 2026
                </div>
              </div>
            `;
            
            emailLogs.unshift({
              timestamp: new Date().toISOString(),
              to: targetEmail,
              subject: subject,
              body: formattedHtml
            });
            logsUpdated = true;
          }
        }
      }
    }
  });
  
  if (logsUpdated) {
    if (emailLogs.length > 30) {
      emailLogs = emailLogs.slice(0, 30);
    }
    localStorage.setItem('email_logs_data', JSON.stringify(emailLogs));
  }
}
// ดึงข้อมูลแจ้งเตือนที่ยังค้างดำเนินการอยู่สำหรับผู้ใช้งานปัจจุบัน
function getActiveEmailLogs() {
  if (!currentUser) return [];
  const uEmail = currentUser.email.toLowerCase();
  
  return emailLogs.filter(log => {
    // ต้องเป็นข้อความส่งถึงผู้ใช้งานปัจจุบัน
    if ((log.to || '').toLowerCase() !== uEmail) return false;
    
    // ดึงรหัสใบจองออกจากหัวข้อหรือเนื้อความเพื่อเช็คสถานะปัจจุบัน
    const bookingIdMatch = (log.subject || '').match(/(?:BGK|BKG)(?:-FMO)?-\d+(?:-\d+)?/) || (log.body || '').match(/(?:BGK|BKG)(?:-FMO)?-\d+(?:-\d+)?/);
    const bookingId = bookingIdMatch ? bookingIdMatch[0] : null;
    
    if (bookingId) {
      const b = bookings.find(x => x.id === bookingId);
      if (b) {
        // หากใบจองอนุมัติเสร็จสิ้นหรือปฏิเสธแล้ว การแจ้งเตือนกระดิ่งจะหายไป
        if (b.status === 'approved' || b.status === 'rejected') {
          return false;
        }
        
        // หากอยู่ในขั้นตอนผู้จองกรอกข้อมูลค่าพาหนะเพิ่ม
        if (b.waitingForRequesterInput) {
          const isRequester = (b.requesterEmail && b.requesterEmail.toLowerCase() === uEmail) || b.requester === currentUser.name;
          return isRequester; // แสดงสำหรับผู้ขอจองเท่านั้น
        }
        
        // หากอยู่ในขั้นตอนรออนุมัติ แสดงเฉพาะเมื่อถึงคิวของบทบาทตัวเองในการอนุมัติ
        if (currentUser.canApprove && currentUser.canApprove.includes(b.currentApprovalLevel)) {
          if (b.currentApprovalLevel === 1) {
            const mEmail = resolveManagerEmail(b).toLowerCase();
            return (mEmail === uEmail || mEmail === '');
          }
          return true;
        }
        
        return false; // ผ่านคิวตัวเองไปแล้ว หรือยังไม่ถึงคิว
      } else {
        return false; // หากมีรหัสใบจองแต่ไม่พบใบจองในระบบแล้ว ให้ซ่อนการแจ้งเตือนนี้
      }
    }
    return true; // หากไม่มีรหัสใบจองคีย์ไว้ ให้แสดงตามปกติ
  });
}

// Simulated Email Inbox UI Updates
function updateEmailInboxUI() {
  autoGenerateMissingEmailLogs();
  const badge = document.getElementById('email-inbox-badge');
  const list = document.getElementById('email-logs-list');
  if (!list) return;

  // กรองเฉพาะข้อความแจ้งเตือนที่ยังค้างดำเนินการอยู่สำหรับผู้ใช้งานปัจจุบัน
  const filteredLogs = getActiveEmailLogs();
  const count = filteredLogs.length;
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  if (count === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
        ยังไม่มีข้อความแจ้งเตือนสำหรับคุณในเซสชันนี้
      </div>
    `;
    return;
  }

  list.innerHTML = filteredLogs.map((log, index) => {
    const timeStr = formatThaiDateTime(log.timestamp);
    
    // Extract booking ID using regex
    const bookingIdMatch = (log.subject || '').match(/(?:BGK|BKG)(?:-FMO)?-\d+(?:-\d+)?/) || (log.body || '').match(/(?:BGK|BKG)(?:-FMO)?-\d+(?:-\d+)?/);
    const bookingId = bookingIdMatch ? bookingIdMatch[0] : null;
    
    let modifiedBody = log.body || '';
    if (bookingId) {
      // Replace the blue button "เข้าสู่ระบบเพื่อดำเนินการ" with the orange "✍️ พิจารณาตรวจอนุมัติ" button (for backward compatibility)
      modifiedBody = modifiedBody.replace(
        /<a\s+href="https:\/\/car-booking\.fishmarket\.co\.th\/"\s+style="background-color:\s*#0284c7;[^>]*>เข้าสู่ระบบเพื่อดำเนินการ<\/a>/g,
        `<button class="btn btn-warning" onclick="event.preventDefault(); openApprovalModal('${bookingId}'); document.getElementById('modal-email-inbox').classList.remove('active');" style="background-color: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; display: inline-block; font-family: Sarabun, sans-serif;">✍️ พิจารณาตรวจอนุมัติ</button>`
      );
      // Replace the orange link button "✍️ พิจารณาตรวจอนุมัติ" with a local button that opens the modal
      modifiedBody = modifiedBody.replace(
        /<a\s+href="https:\/\/car-booking\.fishmarket\.co\.th\/"\s+style="background-color:\s*#f59e0b;[^>]*>✍️\s*พิจารณาตรวจอนุมัติ<\/a>/g,
        `<button class="btn btn-warning" onclick="event.preventDefault(); openApprovalModal('${bookingId}'); document.getElementById('modal-email-inbox').classList.remove('active');" style="background-color: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; display: inline-block; font-family: Sarabun, sans-serif;">✍️ พิจารณาตรวจอนุมัติ</button>`
      );
      // Replace the red button "กรอกรายละเอียดค่าพาหนะ" with a button that opens the taxi fill modal
      modifiedBody = modifiedBody.replace(
        /<a\s+href="https:\/\/car-booking\.fishmarket\.co\.th\/"\s+style="background-color:\s*#dc2626;[^>]*>กรอกรายละเอียดค่าพาหนะ<\/a>/g,
        `<button class="btn btn-danger" onclick="event.preventDefault(); openFillTaxiModal('${bookingId}'); document.getElementById('modal-email-inbox').classList.remove('active');" style="background-color: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; display: inline-block; font-family: Sarabun, sans-serif;">✍️ กรอกรายละเอียดค่าพาหนะ</button>`
      );
    }

    // Find the actual index of the log in the original emailLogs array
    const realIndex = emailLogs.findIndex(x => x.timestamp === log.timestamp && x.to === log.to && x.subject === log.subject);

    return `
      <div class="email-log-item" style="border: 1px solid var(--border-color); border-radius: 8px; background: rgba(255,255,255,0.02); padding: 1rem; position: relative; margin-bottom: 0.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
          <button class="btn btn-secondary btn-sm" onclick="deleteEmailLog(${realIndex})" style="padding: 0.1rem 0.4rem; font-size:0.7rem; border-color:rgba(220,38,38,0.2); color:var(--danger);">ลบ</button>
        </div>
        <div style="margin-bottom: 0.5rem; font-size: 0.85rem;">
          <div style="margin-bottom: 0.35rem;"><span class="badge" style="background: var(--success-light); color: var(--success); font-size: 0.7rem; font-weight: bold; border: 1px solid var(--success); padding: 0.15rem 0.35rem; border-radius: 4px;">🟢 ส่งอีเมลจริงไปยัง WorkD Email สำเร็จ</span></div>
          <strong>ถึง:</strong> <span style="color: var(--primary); font-family: monospace;">${log.to}</span><br>
          <strong>หัวข้อ:</strong> <span style="font-weight: bold; color: var(--text-main);">${log.subject}</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="toggleEmailBody(${index})" id="btn-toggle-email-${index}" style="width: 100%; text-align: center; margin-top: 0.25rem;">📄 แสดงเนื้อหาอีเมล</button>
        <div id="email-body-content-${index}" style="display: none; margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem; overflow-x: auto; background: white; border-radius: 6px; padding: 1rem; color: #333;">
          ${modifiedBody}
        </div>
      </div>
    `;
  }).join('');
}
window.deleteEmailLog = function(index) {
  if (index >= 0 && index < emailLogs.length) {
    const log = emailLogs[index];
    
    // Extract booking ID and target email
    const bookingIdMatch = (log.subject || '').match(/(?:BGK|BKG)(?:-FMO)?-\d+(?:-\d+)?/) || (log.body || '').match(/(?:BGK|BKG)(?:-FMO)?-\d+(?:-\d+)?/);
    const bookingId = bookingIdMatch ? bookingIdMatch[0] : null;
    
    if (bookingId) {
      const b = bookings.find(x => x.id === bookingId);
      const lvl = b ? b.currentApprovalLevel : 1;
      
      const deletedLogs = JSON.parse(localStorage.getItem('deleted_email_logs') || '[]');
      deletedLogs.push({
        bookingId: bookingId,
        level: lvl,
        userEmail: (log.to || '').toLowerCase()
      });
      localStorage.setItem('deleted_email_logs', JSON.stringify(deletedLogs));
    }

    emailLogs.splice(index, 1);
    localStorage.setItem('email_logs_data', JSON.stringify(emailLogs));
    updateEmailInboxUI();
  }
};

window.toggleEmailBody = function(index) {
  const el = document.getElementById(`email-body-content-${index}`);
  const btn = document.getElementById(`btn-toggle-email-${index}`);
  if (el) {
    if (el.style.display === 'none') {
      el.style.display = 'block';
      btn.textContent = '🙈 ซ่อนเนื้อหาอีเมล';
    } else {
      el.style.display = 'none';
      btn.textContent = '📄 แสดงเนื้อหาอีเมล';
    }
  }
};

// Document Load entrypoint
document.addEventListener('DOMContentLoaded', async () => {
  await initDatabase();

  // Initialize Canvas Signature pads
  requesterSig = setupSignaturePad('canvas-requester-signature', 'btn-clear-requester-sig', 'requester-sig-placeholder');
  approverSig = setupSignaturePad('canvas-approver-signature', 'btn-clear-approver-sig', 'approver-sig-placeholder');

  // Bind image upload handlers
  handleSignatureUpload('upload-requester-sig', requesterSig, 'canvas-requester-signature', 'requester-sig-placeholder');
  handleSignatureUpload('upload-approver-sig', approverSig, 'canvas-approver-signature', 'approver-sig-placeholder');

  setupEventListeners();

  // Initialize Flatpickr for booking dates
  try {
    if (typeof flatpickr !== 'undefined') {
      const thLocale = (flatpickr.l10ns && flatpickr.l10ns.th) ? flatpickr.l10ns.th : 'th';
      const fpConfig = {
        enableTime: true,
        time_24hr: true,
        disableMobile: true, // Force Flatpickr UI on all devices (mobile and desktop)
        dateFormat: "Y-m-d\\TH:i", // compatible with datetime-local value expectations
        altInput: true,
        altFormat: "d/m/Y H:i", // 24h display format
        locale: thLocale
      };

      const startInput = document.getElementById('input-start-date');
      const endInput = document.getElementById('input-end-date');
      if (startInput) fpStart = flatpickr(startInput, fpConfig);
      if (endInput) fpEnd = flatpickr(endInput, fpConfig);

      // Force inline styling on the visible inputs generated by Flatpickr to bypass CSS cache!
      [fpStart, fpEnd].forEach(fp => {
        if (fp && fp.altInput) {
          fp.altInput.style.setProperty('background-color', '#ffffff', 'important');
          fp.altInput.style.setProperty('background-image', "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236366f1' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'/%3E%3C/svg%3E\")", 'important');
          fp.altInput.style.setProperty('background-repeat', 'no-repeat', 'important');
          fp.altInput.style.setProperty('background-position', 'right 0.75rem center', 'important');
          fp.altInput.style.setProperty('background-size', '1.25rem', 'important');
          fp.altInput.style.setProperty('padding-right', '2.5rem', 'important');
          fp.altInput.style.setProperty('color', '#111827', 'important');
          fp.altInput.style.setProperty('cursor', 'pointer', 'important');
          fp.altInput.style.setProperty('border', '1px solid #c7d2fe', 'important');
          fp.altInput.style.setProperty('box-shadow', '0 2px 4px rgba(0, 0, 0, 0.04)', 'important');
          fp.altInput.style.setProperty('font-weight', '600', 'important');

          // Hover/Focus events via JS
          fp.altInput.addEventListener('mouseenter', () => {
            fp.altInput.style.setProperty('background-color', '#fbfbfe', 'important');
            fp.altInput.style.setProperty('border-color', '#4f46e5', 'important');
          });
          fp.altInput.addEventListener('mouseleave', () => {
            fp.altInput.style.setProperty('background-color', '#ffffff', 'important');
            fp.altInput.style.setProperty('border-color', '#c7d2fe', 'important');
          });
        }
      });

      console.log("Flatpickr initialized successfully!");
    } else {
      console.warn("Flatpickr library is undefined. Falling back to native or manual input.");
    }
  } catch (err) {
    console.error("Flatpickr initialization failed:", err);
    // Display error message to user
    showToast("ระบบปฏิทินขัดข้อง: " + err.message, "error");
  }

  checkLoginStatus();

  // Show return early success toast if set
 // ตัวอย่างโค้ดตอนที่ระบบดึงข้อมูลผู้ใช้เก่ากลับมาตอนโหลดเว็บ
const storedUser = localStorage.getItem('current_user');
if (storedUser) {
  currentUser = JSON.parse(storedUser);
  
  // 🚨 ต้องแน่ใจว่ามีการเรียก 3 คำสั่งนี้เสมอ เพื่อให้ระบบแจกสิทธิ์และโชว์ปุ่มถูกต้อง 🚨
  assignUserPermissions(currentUser); 
  initApprovalSwitcher(); 
  updateStats();
  // ...
}

  // Simulated Email Inbox event listeners
  const trigger = document.getElementById('email-inbox-trigger');
  const modalInbox = document.getElementById('modal-email-inbox');
  const closeInbox = document.getElementById('btn-close-email-inbox');

  if (trigger && modalInbox) {
    trigger.addEventListener('click', () => {
      modalInbox.classList.add('active');
      updateEmailInboxUI();
    });
  }

  if (closeInbox && modalInbox) {
    closeInbox.addEventListener('click', () => {
      modalInbox.classList.remove('active');
    });
  }

  // Driver Report controls
  const btnDriverReportBack = document.getElementById('btn-driver-report-back');
  if (btnDriverReportBack) {
    btnDriverReportBack.addEventListener('click', () => {
      showView('dashboard');
    });
  }

  const btnDriverReportPrint = document.getElementById('btn-driver-report-print');
  if (btnDriverReportPrint) {
    btnDriverReportPrint.addEventListener('click', () => {
      window.print();
    });
  }

  const periodSelect = document.getElementById('driver-report-period');
  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const dateContainer = document.getElementById('driver-report-date-container');
      const dateLabel = document.getElementById('driver-report-date-label');
      const monthContainer = document.getElementById('driver-report-month-container');
      
      if (val === 'daily') {
        dateContainer.classList.remove('hidden');
        dateLabel.textContent = 'เลือกวัน';
        monthContainer.classList.add('hidden');
      } else if (val === 'weekly') {
        dateContainer.classList.remove('hidden');
        dateLabel.textContent = 'เลือกวันใดวันหนึ่งในสัปดาห์';
        monthContainer.classList.add('hidden');
      } else if (val === 'monthly') {
        dateContainer.classList.add('hidden');
        monthContainer.classList.remove('hidden');
      }
    });
  }

  const btnGenDriverReport = document.getElementById('btn-generate-driver-report');
  if (btnGenDriverReport) {
    btnGenDriverReport.addEventListener('click', generateDriverReport);
  }

  // Load initial simulated inbox state
  updateEmailInboxUI();
});

// Populate driver list in the dropdown
function populateDriversDropdown() {
  const select = document.getElementById('driver-report-select');
  if (!select) return;

  const driverSet = new Set();
  const normalizeName = (name) => name ? name.replace(/\s+/g, ' ').trim() : '';
  
  // Add from default cars list
  cars.forEach(c => {
    if (c.driverName && c.driverName !== '-') {
      driverSet.add(normalizeName(c.driverName));
    }
  });

  // Add from bookings list (only non-empty, non-dash names)
  bookings.forEach(b => {
    if (b.driverName && b.driverName !== '-') {
      driverSet.add(normalizeName(b.driverName));
    }
  });

  const drivers = Array.from(driverSet);
  select.innerHTML = '';
  
  if (drivers.length === 0) {
    select.innerHTML = '<option value="">-- ไม่พบรายชื่อพนักงานขับรถ --</option>';
    return;
  }

  drivers.forEach(d => {
    select.innerHTML += `<option value="${d}">${d}</option>`;
  });
}

// Generate the driver usage report sheet
function generateDriverReport() {
  const driverName = document.getElementById('driver-report-select').value;
  const period = document.getElementById('driver-report-period').value;
  const dateVal = document.getElementById('driver-report-date').value;
  const monthVal = parseInt(document.getElementById('driver-report-month').value);
  const yearVal = parseInt(document.getElementById('driver-report-year').value);
  const container = document.getElementById('driver-report-sheet-content');

  const reporterUser = usersList.find(u => u.username.toLowerCase() === 'chalong.c') || {};
  const reporterName = reporterUser.name || 'นายฉลอง  เจียมผักแว่น';
  const reporterSig = (reporterUser.sign && reporterUser.sign.startsWith('data:image')) ? reporterUser.sign : generateMockSignature(reporterName);

  const endorserUser = usersList.find(u => u.username.toLowerCase() === 'saisunee.p') || {};
  const endorserName = endorserUser.name || 'น.ส.สายสุนีย์  พูลวณิชย์สกุล';
  const endorserSig = (endorserUser.sign && endorserUser.sign.startsWith('data:image')) ? endorserUser.sign : generateMockSignature(endorserName);

  if (!container) return;

  if (!driverName) {
    showToast("กรุณาเลือกพนักงานขับรถ", "warning");
    return;
  }

  let rangeStart, rangeEnd, periodLabel;

  if (period === 'daily') {
    if (!dateVal) {
      showToast("กรุณาระบุวันที่ต้องการออกรายงาน", "warning");
      return;
    }
    const parts = dateVal.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    rangeStart = new Date(year, month, day, 0, 0, 0, 0);
    rangeEnd = new Date(year, month, day, 23, 59, 59, 999);
    periodLabel = `รายวัน ณ วันที่ ${rangeStart.toLocaleDateString('th-TH', { dateStyle: 'long' })}`;
  } else if (period === 'weekly') {
    if (!dateVal) {
      showToast("กรุณาระบุวันเพื่อตรวจสอบสัปดาห์", "warning");
      return;
    }
    const parts = dateVal.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    
    const monday = new Date(year, month, diff, 0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    rangeStart = monday;
    rangeEnd = sunday;
    
    const monStr = monday.toLocaleDateString('th-TH', { dateStyle: 'long' });
    const sunStr = sunday.toLocaleDateString('th-TH', { dateStyle: 'long' });
    periodLabel = `รายสัปดาห์ ตั้งแต่วันที่ ${monStr} ถึงวันที่ ${sunStr}`;
  } else if (period === 'monthly') {
    const firstDay = new Date(yearVal, monthVal, 1, 0, 0, 0, 0);
    const lastDay = new Date(yearVal, monthVal + 1, 0, 23, 59, 59, 999);
    rangeStart = firstDay;
    rangeEnd = lastDay;
    
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    periodLabel = `ประจำเดือน ${monthNames[monthVal]} พ.ศ. ${yearVal + 543}`;
  }

  const normalizeName = (name) => name ? name.replace(/\s+/g, ' ').trim() : '';

  // Filter approved bookings for FMO car and this driver that fall in the range
  const matchedBookings = bookings.filter(b => {
    if (b.status !== 'approved') return false;
    if (b.travelType !== 'fmo_car') return false;
    if (!b.driverName || normalizeName(b.driverName) !== normalizeName(driverName)) return false;
    
    const bStart = new Date(b.startDate);
    const bEnd = new Date(b.endDate);
    
    return (bStart <= rangeEnd && bEnd >= rangeStart);
  });

  // Calculate statistics
  const totalBookings = matchedBookings.length;
  let totalTrips = 0;
  const activeDaysSet = new Set();
  
  matchedBookings.forEach(b => {
    totalTrips += b.trips || 1;
    
    const bStart = new Date(b.startDate);
    const bEnd = new Date(b.endDate);
    
    const loopDate = new Date(rangeStart);
    while (loopDate <= rangeEnd) {
      const startOfDay = new Date(loopDate);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(loopDate);
      endOfDay.setHours(23,59,59,999);
      
      if (bStart <= endOfDay && bEnd >= startOfDay) {
        activeDaysSet.add(loopDate.toDateString());
      }
      
      loopDate.setDate(loopDate.getDate() + 1);
    }
  });

  const totalDays = activeDaysSet.size;

  // Retrieve assigned car plate for the driver
  const carAssigned = cars.find(c => c.driverName && normalizeName(c.driverName) === normalizeName(driverName));
  const carPlateStr = carAssigned ? `${carAssigned.name} (${carAssigned.plate})` : 'ไม่ระบุตัวรถยนต์ประจำ';

  const reportDateStr = formatThaiDateTimeLong(new Date());

  // Generate Table Rows
  let tableRowsHtml = '';
  if (totalBookings === 0) {
    tableRowsHtml = `<tr><td colspan="9" style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">ไม่พบรายการปฏิบัติราชการใช้รถของ พขร. ผู้นี้ในกรอบช่วงเวลาที่เลือก</td></tr>`;
  } else {
    // Sort bookings chronologically
    matchedBookings.sort((x, y) => new Date(x.startDate) - new Date(y.startDate));
    
    matchedBookings.forEach((b, idx) => {
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      
      const dateStr = bStart.toLocaleDateString('th-TH', { dateStyle: 'short' });
      const timeStr = `${formatThaiTimeOnlyNoSuffix(bStart)} - ${formatThaiTimeOnlyNoSuffix(bEnd)}`;
      
      const bCar = cars.find(c => c.id === b.carId);
      const plate = bCar ? bCar.plate : '-';

      tableRowsHtml += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center; white-space: nowrap;">${dateStr}</td>
          <td style="text-align: center; white-space: nowrap;">${timeStr}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold;">${b.id}</td>
          <td>${b.requester}</td>
          <td>${b.purpose}</td>
          <td>${b.destination || '-'}</td>
          <td style="text-align: center; white-space: nowrap;">${plate}</td>
          <td style="text-align: center; color: green; font-weight: 500;">อนุมัติแล้ว</td>
        </tr>
      `;
    });
  }

  container.innerHTML = `
    <!-- REPORT HEADER -->
    <div class="fmo-header-block" style="margin-bottom: 20px;">
      <div class="fmo-header-left">
        <div class="fmo-line" style="font-size:12px; color: #64748b;">วันที่สืบค้น: ${new Date().toLocaleDateString('th-TH', { dateStyle: 'short' })}</div>
      </div>
      <div class="fmo-header-right">
        <div class="fmo-logo-wrapper" style="margin-bottom: 5px;">
          <img src="logoFMO.png" class="fmo-logo" alt="FMO Logo" style="height: 50px; object-fit: contain;">
        </div>
        <div class="fmo-title-main" style="font-size:18px; font-weight: bold;">องค์การสะพานปลา (FMO)</div>
      </div>
    </div>

    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 20px; text-align: center;">
      <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #0f172a;">
        รายงานการสรุปการใช้งานรถยนต์ของพนักงานขับรถ: ${driverName} (รายบุคคล)
      </h3>
      <div style="font-size: 13px; color: #475569; margin-top: 4px;">
        ${periodLabel}
      </div>
    </div>

    <!-- DRIVER METADATA BLOCK -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
      <tr>
        <td style="padding: 10px; font-weight: bold; width: 150px;">ชื่อพนักงานขับรถ:</td>
        <td style="padding: 10px;">${driverName}</td>
        <td style="padding: 10px; font-weight: bold; width: 150px;">ยานพาหนะประจำตัว:</td>
        <td style="padding: 10px;">${carPlateStr}</td>
      </tr>
      <tr>
        <td style="padding: 10px; font-weight: bold;">ออกรายงาน ณ วันเวลา:</td>
        <td style="padding: 10px;">${reportDateStr} น.</td>
        <td style="padding: 10px; font-weight: bold;">ผู้ตรวจสอบ/พิมพ์รายงาน:</td>
        <td style="padding: 10px;">${currentUser ? currentUser.name : 'งานยานพาหนะ'} (L2)</td>
      </tr>
    </table>

    <!-- STATS CARDS -->
    <div class="driver-report-stat-grid">
      <div class="driver-report-stat-card">
        <div class="value">${totalBookings}</div>
        <div class="label">งานวิ่งบริการสะสม (ครั้ง)</div>
      </div>
      <div class="driver-report-stat-card">
        <div class="value">${totalTrips}</div>
        <div class="label">จำนวนเที่ยววิ่งรวม (เที่ยว)</div>
      </div>
      <div class="driver-report-stat-card">
        <div class="value">${totalDays}</div>
        <div class="label">จำนวนวันปฏิบัติงานจริง (วัน)</div>
      </div>
    </div>

    <!-- TABLE HEADER TITLE -->
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; color: #0f172a;">
      📋 ตารางสรุปบันทึกรายการปฏิบัติงานการใช้รถยนต์
    </div>

    <!-- DETAILED TABLE -->
    <table class="driver-report-table">
      <thead>
        <tr>
          <th style="width: 40px;">ลำดับ</th>
          <th style="width: 80px;">วันที่เดินทาง</th>
          <th style="width: 110px;">ช่วงเวลาปฏิบัติงาน</th>
          <th style="width: 100px;">เลขที่ใบจอง</th>
          <th style="width: 120px;">ผู้เสนอขอใช้รถ</th>
          <th>เรื่อง / วัตถุประสงค์</th>
          <th>สถานที่ปลายทาง</th>
          <th style="width: 100px;">ทะเบียนรถ</th>
          <th style="width: 80px;">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- SIGNATURE SECTION -->
    <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 13px;">
      <div style="text-align: center; padding-top: 15px;">
        <div style="position: relative; display: inline-block; margin-bottom: 10px; font-size: 13px;">
          ลงชื่อ <span style="position: relative; display: inline-block; width: 140px; text-align: center;">............................................${reporterSig ? `<img src="${reporterSig}" style="max-height: 40px; max-width: 100%; object-fit: contain; position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);">` : ''}</span> ผู้รายงาน
        </div>
        <p style="font-weight: 500;">( ${reporterName} )</p>
        <p style="color: #64748b; font-size: 11px;">ผู้จัดรถ / งานยานพาหนะ (L2)</p>
      </div>
      <div style="text-align: center; padding-top: 15px;">
        <div style="position: relative; display: inline-block; margin-bottom: 10px; font-size: 13px;">
          ลงชื่อ <span style="position: relative; display: inline-block; width: 140px; text-align: center;">............................................${endorserSig ? `<img src="${endorserSig}" style="max-height: 40px; max-width: 100%; object-fit: contain; position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);">` : ''}</span> ผู้รับรองรายงาน
        </div>
        <p style="font-weight: 500;">( ${endorserName} )</p>
        <p style="color: #64748b; font-size: 11px;">หัวหน้าสำนักงานบริหารการพัสดุ (หส.พด.)</p>
      </div>
    </div>
  `;
}

// Expose globals for inline attributes or testing
window.openApprovalModal = openApprovalModal;
window.openReportView = openReportView;
window.renderMonthCalendar = renderMonthCalendar;
window.openFillTaxiModal = openFillTaxiModal;
window.generateDriverReport = generateDriverReport;
window.populateDriversDropdown = populateDriversDropdown;
window.setBookingViewLayout = setBookingViewLayout;

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('current_user')) {
    const approvalContainer = document.getElementById('approval-level-container');
    if (approvalContainer) {
      approvalContainer.classList.add('hidden');
    }
  }
});
// ==========================================
// ฟังก์ชันสร้างรหัสใบจองแบบใหม่ (BGK-ปีเดือน-เลขรัน)
// ==========================================
function generateNewBookingId() {
  const now = new Date();
  const yearBE = now.getFullYear() + 543;
  const yearStr = String(yearBE).slice(-2); 
  const monthStr = String(now.getMonth() + 1).padStart(2, '0'); 
  const prefix = `BGK-${yearStr}${monthStr}-`; 
  
  const bookingsThisMonth = bookings.filter(b => b.id && b.id.startsWith(prefix));
  let nextRunningNumber = 1;
  
  if (bookingsThisMonth.length > 0) {
    const maxNumber = Math.max(...bookingsThisMonth.map(b => {
      const numStr = b.id.substring(prefix.length); 
      return parseInt(numStr, 10) || 0;
    }));
    nextRunningNumber = maxNumber + 1;
  }
  
  const runningStr = String(nextRunningNumber).padStart(3, '0');
  return `${prefix}${runningStr}`;
}
// ==========================================
// ฟังก์ชันกลาง: ดึงรายการที่รอฉันอนุมัติเท่านั้น
// ==========================================
function getMyPendingTasksList() {
  if (!currentUser) return [];
  const activeLevel = sessionStorage.getItem('activeApprovalLevel') || 'all';
  
  return bookings.filter(b => {
    // 🚨 เช็คว่าสถานะขึ้นต้นด้วย pending (รองรับ pending_l1, pending_l2)
    if (b.status.startsWith('pending') && !b.waitingForRequesterInput) {
      const canApproveThisLevel = currentUser.canApprove && currentUser.canApprove.includes(b.currentApprovalLevel);
      const isSelectedLevel = (activeLevel === 'all' || parseInt(activeLevel) === b.currentApprovalLevel);
      
      if (canApproveThisLevel && isSelectedLevel) {
        if (b.currentApprovalLevel === 1) {
          const mEmail = resolveManagerEmail(b).toLowerCase();
          const cEmail = (currentUser.email || '').toLowerCase();
          return (mEmail === cEmail || mEmail === '');
        }
        return true;
      }
    }
    return false;
  });
}

// ==========================================
// ส่งออกข้อมูลการจองทั้งหมดเป็นไฟล์ Excel (CSV)
// ==========================================
// ==========================================
// ส่งออกข้อมูลการจองตามช่วงเวลาที่กำหนดเป็นไฟล์ Excel (CSV)
// ==========================================
window.openExportModal = function() {
  const modal = document.getElementById('modal-export-csv');
  if (modal) {
    document.getElementById('export-start-date').value = '';
    document.getElementById('export-end-date').value = '';
    modal.classList.add('active');
  }
};

window.triggerExportBookings = function() {
  if (bookings.length === 0) {
    showToast("ไม่มีข้อมูลการจองสำหรับส่งออก", "warning");
    return;
  }

  const startVal = document.getElementById('export-start-date').value;
  const endVal = document.getElementById('export-end-date').value;
  
  let filtered = bookings;
  
  if (startVal) {
    const startLimit = new Date(startVal + 'T00:00:00').getTime();
    filtered = filtered.filter(b => {
      const bDate = new Date(b.startDate).getTime();
      return bDate >= startLimit;
    });
  }
  
  if (endVal) {
    const endLimit = new Date(endVal + 'T23:59:59').getTime();
    filtered = filtered.filter(b => {
      const bDate = new Date(b.startDate).getTime();
      return bDate <= endLimit;
    });
  }
  
  if (filtered.length === 0) {
    showToast("ไม่พบข้อมูลการจองในช่วงเวลาที่เลือก", "warning");
    return;
  }
  
  window.performExportToCSV(filtered, startVal, endVal);
  
  const modal = document.getElementById('modal-export-csv');
  if (modal) modal.classList.remove('active');
};

window.performExportToCSV = function(list, startVal, endVal) {
  const headers = [
    "เลขที่คำขอ", "ผู้ขอจอง", "ตำแหน่ง", "หน่วยงาน/โครงการ", "วัตถุประสงค์", "สถานที่ปลายทาง", 
    "ประเภทการเดินทาง", "วันเริ่มเดินทาง", "วันสิ้นสุดเดินทาง", "จำนวนเที่ยวรถ", "รถที่จัดสรร", 
    "พนักงานขับรถ", "ระยะทางประมาณ (กม.)", "ค่าใช้จ่ายประมาณ (บาท)", "สถานะใบคำขอ"
  ];
  
  const rows = list.map(b => {
    let travelTypeStr = b.travelType === 'fmo_car' ? (b.controlUnit === 'รถสวัสดิการ' ? 'รถสวัสดิการ' : 'รถยนต์ อสป.') : 'รถรับจ้างสาธารณะ (TAXI)';
    let carName = '';
    if (b.travelType === 'fmo_car') {
      const carObj = cars.find(c => c.id === b.carId);
      carName = carObj ? `${carObj.name} (${carObj.plate})` : '';
    }
    
    let statusText = `รออนุมัติ (L${b.currentApprovalLevel})`;
    if (b.waitingForRequesterInput) {
      statusText = 'รอระบุค่าพาหนะ';
    } else if (b.status === 'approved') {
      statusText = 'อนุมัติเสร็จสิ้น';
    } else if (b.status === 'rejected') {
      statusText = 'ปฏิเสธคำขอ';
    }
    
    return [
      b.id,
      b.requester,
      b.position || '',
      b.controlUnit || '',
      b.purpose || '',
      b.destination || '',
      travelTypeStr,
      formatThaiDateTime(b.startDate),
      formatThaiDateTime(b.endDate),
      b.trips || '',
      carName,
      b.driverName || '',
      b.distance || '',
      b.price || '',
      statusText
    ];
  });
  
  let csvContent = "\uFEFF"; // UTF-8 BOM for Thai character encoding in Excel
  csvContent += [headers.join(','), ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  let filename = "รายงานการจองรถ";
  if (startVal && endVal) {
    filename += `_ระหว่าง_${startVal}_ถึง_${endVal}`;
  } else if (startVal) {
    filename += `_ตั้งแต่_${startVal}`;
  } else if (endVal) {
    filename += `_จนถึง_${endVal}`;
  } else {
    filename += `_ทั้งหมด`;
  }
  filename += `_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.csv`;
  
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("ส่งออกข้อมูลเป็นไฟล์ Excel (CSV) สำเร็จแล้ว!", "success");
};

// Helper to check system activation state and show/hide the maintenance overlay
function checkSystemActivation() {
  const overlay = document.getElementById('system-maintenance-overlay');
  if (!overlay) return;

  if (isSystemActive) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
  }
}

// Function to activate system globally (bypasses saveBookings length guard)
async function activateSystemGlobally() {
  isSystemActive = true;
  localStorage.setItem('system_active', 'true');
  
  const payload = [...bookings];
  payload.push({
    id: 'system_config',
    requester: 'system',
    startDate: '',
    endDate: '',
    status: '',
    active: true
  });

  showToast("กำลังเปิดใช้งานระบบในฐานข้อมูล...", "info");

  try {
    const response = await fetch('/api/save-bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      showToast("เปิดใช้งานระบบสำเร็จแล้ว! ยินดีต้อนรับ", "success");
      const overlay = document.getElementById('system-maintenance-overlay');
      if (overlay) overlay.classList.add('hidden');
    } else {
      showToast("เกิดข้อผิดพลาดในการบันทึกสถานะเปิดระบบ", "error");
    }
  } catch (error) {
    console.error("Error activating system:", error);
    showToast("ไม่สามารถเชื่อมต่อฐานข้อมูลได้สำเร็จ", "error");
  }
}

// Function to deactivate system globally
async function deactivateSystemGlobally() {
  isSystemActive = false;
  localStorage.setItem('system_active', 'false');
  
  const payload = [...bookings];
  payload.push({
    id: 'system_config',
    requester: 'system',
    startDate: '',
    endDate: '',
    status: '',
    active: false
  });

  showToast("กำลังปิดใช้งานระบบในฐานข้อมูล...", "info");

  try {
    const response = await fetch('/api/save-bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      showToast("ปิดใช้งานระบบชั่วคราวสำเร็จแล้ว!", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showToast("เกิดข้อผิดพลาดในการบันทึกสถานะปิดระบบ", "error");
    }
  } catch (error) {
    console.error("Error deactivating system:", error);
    showToast("ไม่สามารถเชื่อมต่อฐานข้อมูลได้สำเร็จ", "error");
  }
}

// Wire up activation event listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnActivate = document.getElementById('btn-activate-system');
  const loginBox = document.getElementById('activation-login-box');
  const btnCancel = document.getElementById('btn-cancel-activation');
  const btnSubmit = document.getElementById('btn-submit-activation');

  if (btnActivate && loginBox) {
    btnActivate.addEventListener('click', (e) => {
      e.preventDefault();
      btnActivate.classList.add('hidden');
      loginBox.classList.remove('hidden');
      const userField = document.getElementById('activation-username');
      if (userField) userField.focus();
    });
  }

  if (btnCancel && btnActivate && loginBox) {
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      loginBox.classList.add('hidden');
      btnActivate.classList.remove('hidden');
      const userField = document.getElementById('activation-username');
      const passField = document.getElementById('activation-password');
      if (userField) userField.value = '';
      if (passField) passField.value = '';
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      const user = document.getElementById('activation-username').value.trim();
      const pass = document.getElementById('activation-password').value;

      if (!user || !pass) {
        showToast("กรุณากรอกข้อมูลชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน", "warning");
        return;
      }

      if (user.toLowerCase() !== 'ranida.c') {
        showToast("ขออภัย! บัญชีนี้ไม่มีสิทธิ์ในการเปิดระบบ", "error");
        return;
      }

      if (pass !== 'paounda289') {
        showToast("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", "error");
        return;
      }

      // Successful verification
      activateSystemGlobally();
    });
  }

  // Hook up deactivation button for ranida.c
  const btnDeactivate = document.getElementById('btn-deactivate-system');
  if (btnDeactivate) {
    btnDeactivate.addEventListener('click', (e) => {
      e.preventDefault();
      const confirmLock = confirm("⚠️ คุณต้องการปิดใช้งานระบบชั่วคราวใช่หรือไม่?\n\nเมื่อปิดใช้งานแล้ว ระบบจะกลับเข้าสู่โหมดปรับปรุงและแสดงข้อความแจ้งเตือนต่อผู้ใช้งานทั่วไปทันที");
      if (confirmLock) {
        deactivateSystemGlobally();
      }
    });
  }
});