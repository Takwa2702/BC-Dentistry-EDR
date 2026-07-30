const crypto = require('crypto');
const fs = require('fs');

const sha256File = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const input = fs.createReadStream(filePath);
  input.on('error', reject);
  input.on('data', (chunk) => hash.update(chunk));
  input.on('end', () => resolve(hash.digest('hex')));
});

const verifyFileIntegrity = async (filePath, expectedSha256) => {
  if (!expectedSha256 || !/^[a-f0-9]{64}$/i.test(expectedSha256)) return { status: 'unknown', actualSha256: null };
  if (!fs.existsSync(filePath)) return { status: 'missing file', actualSha256: null };
  const actualSha256 = await sha256File(filePath);
  return { status: actualSha256 === expectedSha256.toLowerCase() ? 'verified' : 'mismatch', actualSha256 };
};

module.exports = { sha256File, verifyFileIntegrity };
