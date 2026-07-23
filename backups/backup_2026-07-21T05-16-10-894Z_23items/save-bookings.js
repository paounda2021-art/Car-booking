export async function onRequestPost(context) {
  const { request, env } = context;
  try {
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

      // Insert or replace bookings atomically without wiping existing records
      const chunkSize = 5;
      for (let i = 0; i < bookings.length; i += chunkSize) {
        const chunk = bookings.slice(i, i + chunkSize);
        const batch = chunk.map(b => 
          db.prepare("INSERT OR REPLACE INTO bookings (id, requester, startDate, endDate, status, data) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(b.id, b.requester, b.startDate, b.endDate, b.status, JSON.stringify(b))
        );
        await db.batch(batch);
      }

      return new Response(JSON.stringify({ status: 'success', message: 'Bookings saved to D1 Database successfully' }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8', 
          'Access-Control-Allow-Origin': '*' 
        }
      });
    }

    const kv = env.CAR_BOOKING_KV;
    if (kv) {
      await kv.put('bookings_data', JSON.stringify(bookings));
      return new Response(JSON.stringify({ status: 'success', message: 'Bookings saved to KV successfully' }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8', 
          'Access-Control-Allow-Origin': '*' 
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
