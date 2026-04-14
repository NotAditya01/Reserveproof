/**
 * Cloudflare Worker — Midnight RPC Proxy
 * 
 * Proxies JSON-RPC requests to the Midnight preprod RPC node.
 * Needed because the RPC node blocks cloud provider (Azure) IPs.
 * Cloudflare Worker IPs are NOT blocked.
 */

const TARGET = 'https://rpc.preprod.midnight.network';

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    try {
      const body = await request.text();

      const response = await fetch(TARGET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const result = await response.text();

      return new Response(result, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
