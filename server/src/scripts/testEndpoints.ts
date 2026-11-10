import { app } from '../app';
import { pool } from '../config/db';
import http from 'http';

async function testEndpoints() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://localhost:${port}/api`;

  console.log(`Testing Express Server endpoints on ${baseUrl}...`);

  // 1. Health
  const healthRes = await fetch(`${baseUrl}/health`);
  const healthData = await healthRes.json();
  console.log('GET /api/health:', healthRes.status, healthData);

  // 2. Stock
  const stockRes = await fetch(`${baseUrl}/stock`);
  const stockData = await stockRes.json();
  console.log('GET /api/stock count:', stockData.length);
  console.log('Sample stock item:', stockData[0]);

  // 3. Balances
  const balRes = await fetch(`${baseUrl}/balances`);
  const balData = await balRes.json();
  console.log('GET /api/balances count:', balData.length);
  console.log('Sample customer balance:', balData[0]);

  // 4. Test Frontend HTML serving
  const frontRes = await fetch(`http://localhost:${port}/index.html`);
  console.log('GET /index.html status:', frontRes.status, 'Content-Type:', frontRes.headers.get('content-type'));

  server.close();
  await pool.end();
  console.log('All endpoint checks completed successfully!');
}

testEndpoints().catch((e) => {
  console.error('Endpoint test error:', e);
  process.exit(1);
});
