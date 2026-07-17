import lineConfig from '../../line_config.json';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const payload = await request.json();
    
    // Determine token and group ID
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN || lineConfig.channelAccessToken;
    const groupId = env.LINE_GROUP_ID || lineConfig.groupId;
    
    if (!accessToken || !groupId || accessToken.includes('YOUR_LINE_') || groupId.includes('YOUR_LINE_')) {
      return new Response(JSON.stringify({ status: 'warning', message: 'LINE config not configured' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const isCancel = payload.type === 'cancel';
    const headerTitle = isCancel ? "⚠️ แจ้งยกเลิกใบสั่งงาน พขร." : "📋 ใบสั่งงานพนักงานขับรถ";
    const headerColor = isCancel ? "#dc2626" : "#1e3a8a";
    const headerBg = isCancel ? "#fef2f2" : "#f8fafc";
    const altText = isCancel 
      ? `⚠️ แจ้งยกเลิกคิวงาน พขร. - ปลายทาง: ${payload.destination || ''}` 
      : `📢 ใบสั่งงาน พขร. คิวใหม่ (อนุมัติเสร็จสิ้น) - ปลายทาง: ${payload.destination || ''}`;

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
            text: "👤 ผู้ขอใช้รถ:",
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

    const postData = {
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
    };

    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(postData)
    });

    if (lineResponse.ok) {
      const resBody = await lineResponse.text();
      return new Response(JSON.stringify({ status: 'success', message: 'Notification sent successfully', response: resBody }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      const errorText = await lineResponse.text();
      return new Response(JSON.stringify({ status: 'error', message: `LINE API error (${lineResponse.status}): ${errorText}` }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', message: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
