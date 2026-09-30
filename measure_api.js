const http = require('http');

function measure(url) {
  return new Promise((resolve) => {
    const start = performance.now();
    http.get(url, (res) => {
      const ttfb = performance.now() - start;
      let size = 0;
      res.on('data', chunk => size += chunk.length);
      res.on('end', () => {
        const total = performance.now() - start;
        resolve({ url, status: res.statusCode, ttfb: ttfb.toFixed(2), total: total.toFixed(2), size });
      });
    }).on('error', (e) => {
      resolve({ url, error: e.message });
    });
  });
}

async function run() {
  console.log("Measuring API and Page response times...");
  const urls = [
    'http://localhost:3020/',
    'http://localhost:3020/issues',
    'http://localhost:3020/wbs',
    'http://localhost:3020/api/health'
  ];
  
  for (const url of urls) {
    const result = await measure(url);
    console.log(result);
  }
}
run();
