const TARGET = 'https://rpc.preprod.midnight.network';

export default {
  async fetch(request, env, ctx) {
    // Determine the target URL
    const targetUrl = new URL(request.url);
    const originUrl = new URL(TARGET);
    
    targetUrl.protocol = originUrl.protocol;
    targetUrl.hostname = originUrl.hostname;
    targetUrl.port = originUrl.port;
    
    // Create new request headers, crucially updating the Host header
    const headers = new Headers(request.headers);
    headers.set('Host', originUrl.host);

    // Check if this is a WebSocket upgrade request
    if (request.headers.get("Upgrade") === "websocket") {
      // Forward the exact WS request directly to bypass WAF
      return fetch(targetUrl, {
        method: request.method,
        headers: headers,
        // WS upgrade doesn't use a body in the fetch request
      });
    }

    // Standard HTTP request path
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
      });

      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 502 });
    }
  },
};
