import lineConfig from '../../line_config.json';

const defaultCars = [
  { "id": "A", "name": "Toyota Commuter", "type": "รถตู้", "plate": "ฮษ 7446", "status": "available", "icon": "🚐", "driverName": "นายชลาดล  ทองคำ", "phone": "08-0992-3735" },
  { "id": "B", "name": "Toyota Commuter", "type": "รถตู้", "plate": "1 นญ 1865 (เช่า)", "status": "available", "icon": "🚐", "driverName": "นายสันติ สุธรรม", "phone": "09-1021-4916" },
  { "id": "C", "name": "Toyota Commuter", "type": "รถตู้", "plate": "1 นญ 2029 (เช่า)", "status": "available", "icon": "🚐", "driverName": "นายคมกฤษ คุ้มชัย", "phone": "09-4849-1122" },
  { "id": "D", "name": "Toyota Commuter", "type": "รถตู้", "plate": "ฮล 2521 (รถสวัสดิการ)", "status": "available", "icon": "🚐", "driverName": "", "phone": "" }
];

function getCarPlateById(carId) {
  const car = defaultCars.find(c => c.id === carId);
  return car ? car.plate : '-';
}

function formatThaiDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const years = date.getFullYear() + 543;
  const shortYear = String(years).slice(-2);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${shortYear} ${hours}.${minutes} น.`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN || lineConfig.channelAccessToken;
    
    if (!payload.events || payload.events.length === 0) {
      return new Response('OK', { status: 200 });
    }
    
    for (const event of payload.events) {
      if (event.type === 'postback') {
        const postbackData = event.postback.data;
        const params = new URLSearchParams(postbackData);
        const action = params.get('action');
        const bookingId = params.get('id');
        
        if (bookingId) {
          // Load database
          let bookings = [];
          const db = env.DB || env.CAR_BOOKING_DB || env.FMO_BOOKINGS_DB;
          const kv = env.CAR_BOOKING_KV;
          
          if (db) {
            const { results } = await db.prepare("SELECT data FROM bookings").all();
            bookings = results.map(row => JSON.parse(row.data));
          } else if (kv) {
            const kvData = await kv.get('bookings_data');
            bookings = kvData ? JSON.parse(kvData) : [];
          }
          
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
              // Save database
              if (db) {
                await db.prepare("INSERT OR REPLACE INTO bookings (id, requester, startDate, endDate, status, data) VALUES (?, ?, ?, ?, ?, ?)")
                  .bind(booking.id, booking.requester, booking.startDate, booking.endDate, booking.status, JSON.stringify(booking))
                  .run();
              } else if (kv) {
                await kv.put('bookings_data', JSON.stringify(bookings));
              }
              
              // Construct Flex Message reply
              const flexMessage = generateFlexMessage(booking, action);
              
              // Send LINE Reply
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [flexMessage]
                })
              });
            }
          }
        }
      }
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(error.message, { status: 500 });
  }
}

function generateFlexMessage(booking, lastAction) {
  const isFinished = lastAction === 'return-early';
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

  const flex = {
    type: "flex",
    altText: altText,
    contents: {
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
    }
  };

  if (!isFinished) {
    flex.contents.footer = {
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

  return flex;
}
