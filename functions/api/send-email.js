export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { to, subject, body } = await request.json();
    
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing to, subject, or body fields' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const provider = (env.EMAIL_PROVIDER || 'resend').toLowerCase();
    const apiKey = env.EMAIL_API_KEY;
    const fromEmail = env.EMAIL_FROM || 'carbooking@fishmarket.co.th';
    const fromName = env.EMAIL_FROM_NAME || 'ระบบจองรถ อสป.';
    
    if (!apiKey) {
      return new Response(JSON.stringify({ status: 'error', message: 'EMAIL_API_KEY environment variable is not configured on Cloudflare' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    let response;
    
    if (provider === 'resend') {
      // Resend API
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: to.split(',').map(email => email.trim()),
          subject: subject,
          html: body
        })
      });
    } else if (provider === 'sendgrid') {
      // SendGrid API
      response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: to.split(',').map(email => ({ email: email.trim() }))
          }],
          from: { email: fromEmail, name: fromName },
          subject: subject,
          content: [{
            type: 'text/html',
            value: body
          }]
        })
      });
    } else if (provider === 'brevo') {
      // Brevo API
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: to.split(',').map(email => ({ email: email.trim() })),
          subject: subject,
          htmlContent: body
        })
      });
    } else {
      return new Response(JSON.stringify({ status: 'error', message: `Unsupported email provider: ${provider}` }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    if (response.ok) {
      return new Response(JSON.stringify({ status: 'success', message: 'Email sent successfully via ' + provider }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({ status: 'error', message: `Email provider error (${response.status}): ${errorText}` }), {
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

// Support pre-flight OPTIONS request for CORS if needed
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
