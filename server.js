const https = require('https');
const http = require('http');

const SHOPIFY_STORE = 'kaxi-co.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const PORT = process.env.PORT || 3000;

const TRACKED_SKUS = [
  'KAXIORIGI-4265','KAXIBLACK-3281','KAXIDARK-3807','KAXIDUSTY-3282','KAXIBUTTE-3277','KAXICHAMP-3276',
  'KAXIMIDI-4266','KAXIBLACK-3286','KAXIDARK-3808','KAXIDUSTY-3292','KAXIBUTTE-3294','KAXICHAMP-3288',
  'KAXIMINI-4267','KAXIBLACK-3296','KAXIDARK-3809','KAXIDUSTY-3302','KAXIBUTTE-3306','KAXICHAMP-3298',
  'KAXILIGHT-2658','KAXIDARK -2659','KAXIBLACK-2374','KAXIBONE-2378','KAXIDARK -2375','KAXICHAMP-2377',
  'KAXILIGHT-2629','KAXIDARK -2630','KAXIBLACK-2293','KAXIBONE-2297','KAXIDARK -2294','KAXICHAMP-2296',
  'KAXILIGHT-2601','KAXIBLACK-3352','KAXIBONE-2367','KAXIDARK -2364','KAXICHAMP-2366',
  'KAXISHINY-2505','KAXISHINY-2506','KAXIMATTE-2476','KAXIMATTE-2480','KAXISHINY-2495','KAXISHINY-2487',
  'KAXISHINY-2527','KAXISHINY-2528','KAXIMATTE-2510','KAXIMATTE-2513','KAXISHINY-2858','KAXISHINY-3320',
  'KAXIBLACK-2447','KAXIIVORY-2444','KAXICHEET-2454','KAXI-2453','KAXICOOL -2449',
  'KAXI2875','KAXIALL B-4269','KAXINEUTR-4268',
  'KAXIBLACK-1925','KAXICHAMP-1919','KAXIIVORY-4299',
  'KAXIBLUE -3314','KAXINEUTR-2396','KAXICHEET-2398','KAXIBROWN-3888','KAXIBROWN-3878',
  'KAXIBLACK-2289','KAXICAMO-2292',
  'KAXI3336','KAXI2758','KAXI3441','KAXI3440',
  'KAXIHOT P-3239','KAXILIGHT-3240','KAXIYELLO-3241','KAXIORANG-3242','KAXIRED-3243','KAXIBLUE-3244','KAXIWHITE-3245','KAXIBROWN-3246',
  'KAXIYELLO-3231','KAXIORANG-3232','KAXIRED-3233','KAXIBLUE-3234',
  'KAXIROYAL-3099','KAXIBONE-3100','KAXILIGHT-3101','KAXIYELLO-3102','KAXIRED-3103',
  'KAXIROYAL-3104','KAXIBONE-3105','KAXILIGHT-3106','KAXIYELLO-3107','KAXIRED-3108',
  'KAXIMATTE-2538','KAXIMATTE-2539','KAXIMATTE-2540','KAXIMATTE-2541','KAXIMATTE-2543',
  'KAXIMATTE-2545','KAXIMATTE-2547','KAXIMATTE-2549','KAXIMATTE-2550','KAXIMATTE-2551',
  'KAXISHINY-2552','KAXISHINY-2553','KAXISHINY-2554','KAXISHINY-2555','KAXISHINY-2556',
  'KAXISHINY-2557','KAXISHINY-2558','KAXISHINY-2559','KAXISHINY-2560','KAXISHINY-2561',
  'KAXISHINY-2562','KAXISHINY-2563','KAXISHINY-2564','KAXISHINY-2565','KAXISHINY-2566',
  'KAXISHINY-2567','KAXISHINY-2568','KAXISHINY-2569','KAXISHINY-2570','KAXISHINY-2571',
  'KAXISHINY-2572','KAXISHINY-2573','KAXISHINY-2574','KAXISHINY-2575','KAXISHINY-2576',
  'KAXI2797','KAXI2798','KAXI2799'
];

function shopifyGraphQL(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: SHOPIFY_STORE,
      path: '/admin/api/2026-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getInventory() {
  const inventory = {};
  const batchSize = 50;
  for (let i = 0; i < TRACKED_SKUS.length; i += batchSize) {
    const batch = TRACKED_SKUS.slice(i, i + batchSize);
    const skuFilter = batch.map(s => `sku:'${s}'`).join(' OR ');
    const query = `{
      inventoryItems(first: 50, query: "${skuFilter.replace(/"/g, '\\"')}") {
        edges {
          node {
            sku
            inventoryLevels(first: 10) {
              edges {
                node {
                  location { name }
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }`;
    try {
      const result = await shopifyGraphQL(query);
      const items = result?.data?.inventoryItems?.edges || [];
      items.forEach(({ node }) => {
        if (!node.sku) return;
        node.inventoryLevels.edges.forEach(({ node: level }) => {
          if (level.location.name === 'KAXI HQ') {
            const avail = level.quantities.find(q => q.name === 'available');
            if (avail) inventory[node.sku] = avail.quantity;
          }
        });
      });
    } catch(e) {
      console.error('Batch error:', e.message);
    }
  }
  return inventory;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/inventory') {
    try {
      const inventory = await getInventory();
      res.writeHead(200);
      res.end(JSON.stringify(inventory));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  } else {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'Kaxi inventory proxy running' }));
  }
});

server.listen(PORT, () => console.log(`Kaxi proxy running on port ${PORT}`));
