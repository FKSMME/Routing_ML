const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const INDEX_FILE = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  // Serve index.html for all requests
  fs.readFile(INDEX_FILE, 'utf8', (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading page');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Unified Homepage Server running at http://localhost:${PORT}`);
  console.log(`   - Prediction Frontend: http://localhost:5173`);
  console.log(`   - Training Frontend: http://localhost:5174`);
  console.log(`   - Listening on 0.0.0.0:${PORT} (all interfaces)`);
});
