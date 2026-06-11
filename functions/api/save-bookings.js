export async function onRequestPost(context) {
  const { request, env } = context;
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

    const bookings = await request.json();
    if (!Array.isArray(bookings)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid payload: Expected an array of bookings' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8', 
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }

    await kv.put('bookings_data', JSON.stringify(bookings));

    return new Response(JSON.stringify({ status: 'success', message: 'Bookings saved to KV successfully' }), {
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
