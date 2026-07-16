const fs = require('fs');
const path = require('path');

const bookingsFile = path.join(__dirname, 'bookings.json');

// Get IDs to delete from command line arguments
const idsToDelete = process.argv.slice(2);

if (idsToDelete.length === 0) {
  console.log('กรุณาระบุรหัสใบจองที่ต้องการลบ เช่น: node delete_bookings.js BGK-6907-019 BGK-6907-020');
  process.exit(1);
}

console.log('รหัสที่ต้องการลบ:', idsToDelete);

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

  const initialCount = bookings.length;
  // Filter out the bookings with matching IDs
  const filteredBookings = bookings.filter(b => !idsToDelete.includes(b.id));
  const finalCount = filteredBookings.length;
  const deletedCount = initialCount - finalCount;

  if (deletedCount === 0) {
    console.log('ไม่พบรหัสใบจองดังกล่าวในระบบ หรือไม่มีการลบข้อมูลใดๆ');
    process.exit(0);
  }

  fs.writeFile(bookingsFile, JSON.stringify(filteredBookings), 'utf8', err => {
    if (err) {
      console.error('ไม่สามารถเขียนทับไฟล์ bookings.json:', err);
      process.exit(1);
    }
    console.log(`ลบข้อมูลสำเร็จ! ลบไปทั้งหมด ${deletedCount} รายการ`);
  });
});
