export async function onRequestGet(context) {
  const { env } = context;
  try {
    const db = env.DB || env.CAR_BOOKING_DB || env.FMO_BOOKINGS_DB;
    if (db) {
      // Ensure the bookings table exists
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          requester TEXT,
          startDate TEXT,
          endDate TEXT,
          status TEXT,
          data TEXT
        )
      `).run();
      
      const { results } = await db.prepare("SELECT data FROM bookings").all();
      const bookings = results.map(row => JSON.parse(row.data));
      
      return new Response(JSON.stringify(bookings), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8', 
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    const kv = env.CAR_BOOKING_KV;
    if (kv) {
      const bookingsData = await kv.get('bookings_data');
      const bookings = bookingsData ? JSON.parse(bookingsData) : [];
      
      return new Response(JSON.stringify(bookings), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8', 
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    return new Response(JSON.stringify({ status: 'error', message: 'No D1 Database or KV namespace bound to project' }), {
      status: 500,
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
