const fs = require('fs');
const path = require('path');

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin — short retries only */
  }
}

/**
 * Atomic JSON write with retries — Windows often throws EPERM/EBUSY on rename
 * when another poller is reading the same file.
 */
function writeJsonAtomic(filePath, data, retries = 6) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const body = JSON.stringify(data, null, 2) + '\n';

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      fs.writeFileSync(tmp, body, 'utf8');
      try {
        fs.renameSync(tmp, filePath);
      } catch (renameErr) {
        if (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY' || renameErr.code === 'EACCES') {
          fs.writeFileSync(filePath, body, 'utf8');
          try {
            fs.unlinkSync(tmp);
          } catch {
            /* ignore */
          }
        } else {
          throw renameErr;
        }
      }
      return;
    } catch (err) {
      lastErr = err;
      sleepSync(40 * (i + 1));
    }
  }
  throw lastErr;
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return structuredClone(fallback);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

module.exports = { writeJsonAtomic, readJsonSafe };
