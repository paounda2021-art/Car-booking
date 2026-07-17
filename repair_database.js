const fs = require('fs');
const path = require('path');

const bookingsFile = path.join(__dirname, 'bookings.json');

if (!fs.existsSync(bookingsFile)) {
  console.error('ไม่พบไฟล์ bookings.json');
  process.exit(1);
}

fs.readFile(bookingsFile, 'utf8', (err, data) => {
  if (err) {
    console.error('ไม่สามารถอ่านไฟล์ bookings.json:', err);
    process.exit(1);
  }

  let bookings = [];
  try {
    bookings = JSON.parse(data);
  } catch (e) {
    console.error('ข้อผิดพลาดในการ parse JSON:', e);
    process.exit(1);
  }

  let isRepaired = false;
  let repairedCount = 0;

  bookings.forEach(booking => {
    Object.keys(booking).forEach(key => {
      if (typeof booking[key] === 'string' && booking[key].includes('\uFFFD')) {
        const originalVal = booking[key];
        let newVal = originalVal;

        // Repair "อสป."
        newVal = newVal.replace(/อ\uFFFD+ป\./g, 'อสป.');
        
        // Repair "สัมมนา"
        newVal = newVal.replace(/ส\uFFFD+นา/g, 'สัมมนา');
        newVal = newVal.replace(/ส\uFFFD+มนา/g, 'สัมมนา');
        newVal = newVal.replace(/สั\uFFFD+นา/g, 'สัมมนา');

        // Check if there are other corrupted characters and try to clean them by removing \uFFFD
        if (newVal.includes('\uFFFD')) {
          console.warn(`⚠️ Warning: [${booking.id}] ฟิลด์ "${key}" มีอักษรเพี้ยนที่ไม่สามารถระบุคำแก้ได้โดยอัตโนมัติ: "${newVal}"`);
        } else {
          booking[key] = newVal;
          isRepaired = true;
          repairedCount++;
          console.log(`✅ Fixed: [${booking.id}] ฟิลด์ "${key}": "${originalVal}" -> "${newVal}"`);
        }
      }
    });
  });

  if (!isRepaired) {
    console.log('🎉 ไม่พบตัวอักษรเพี้ยนหลงเหลืออยู่ในระบบแล้ว!');
    process.exit(0);
  }

  fs.writeFile(bookingsFile, JSON.stringify(bookings), 'utf8', err => {
    if (err) {
      console.error('ไม่สามารถเขียนทับไฟล์ bookings.json:', err);
      process.exit(1);
    }
    console.log(`\n🚀 ซ่อมแซมตัวอักษรสำเร็จไปทั้งหมด ${repairedCount} รายการ!`);
  });
});
