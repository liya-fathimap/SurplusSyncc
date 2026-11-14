const { port } = require('./config/env');
const app = require('./app');

app.listen(port, () => {
  const baseUrl = `http://localhost:${port}`;
  console.log(`SurplusSync API: ${baseUrl}`);
  console.log(`Health check: ${baseUrl}/api/health`);
});
