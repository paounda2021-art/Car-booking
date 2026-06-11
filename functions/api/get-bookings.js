export async function onRequestGet(context) {
  const { env } = context;
  try {
    const kv = env.CAR_BOOKING_KV;
    if (!kv) {
      return new Response(JSON.stringify({ status: 'error', message: 'KV namespace CAR_BOOKING_KV not bound to project' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8', 
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }

    const bookingsData = await kv.get('bookings_data');
    const bookings = bookingsData ? JSON.parse(bookingsData) : [];
    
    return new Response(JSON.stringify(bookings), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8', 
        'Access-Control-Allow-Origin': '*' 
      }
    });
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
