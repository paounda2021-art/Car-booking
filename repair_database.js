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

  let repairedData = data;

  // Replace corrupted "อสป." patterns (e.g. "อป.", "อป.")
  repairedData = repairedData.replace(/อ\uFFFD+ป\./g, 'อสป.');
  
  // Replace corrupted "สัมมนา" patterns (e.g. "สนา", "สนา")
  repairedData = repairedData.replace(/ส\uFFFD+นา/g, 'สัมมนา');
  repairedData = repairedData.replace(/ส\uFFFD+มนา/g, 'สัมมนา');
  repairedData = repairedData.replace(/สั\uFFFD+นา/g, 'สัมมนา');

  if (repairedData === data) {
    console.log('ไม่พบตัวอักษรเพี้ยนในฐานข้อมูล หรือข้อมูลได้รับการแก้ไขเรียบร้อยแล้ว');
    process.exit(0);
  }

  fs.writeFile(bookingsFile, repairedData, 'utf8', err => {
    if (err) {
      console.error('ไม่สามารถเขียนทับไฟล์ bookings.json:', err);
      process.exit(1);
    }
    console.log('ซ่อมแซมตัวอักษรเพี้ยนในฐานข้อมูลสำเร็จแล้ว!');
  });
});
