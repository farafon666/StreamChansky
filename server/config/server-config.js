import fs from 'fs';
import path from 'path';

const HTTPS_PORT = 3030;

const SSL_OPTIONS = {
  key: fs.readFileSync('certs/localhost+2-key.pem'),
  cert: fs.readFileSync('certs/localhost+2.pem'),
};

export { HTTPS_PORT, SSL_OPTIONS };
