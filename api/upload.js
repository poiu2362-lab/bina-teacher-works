const { put } = require('@vercel/blob');

module.exports.config = {
  api: {
    bodyParser: false
  }
};

const FIREBASE_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  'AIzaSyDzoFcHp-fYuflYbXh08lfkOlEkUwNqkuo';

const SABAH_UID = 'AwY1Oo0iDqO5O2N3YSZYNlDdjk12';

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let done = false;

    req.on('data', chunk => {
      if (done) return;

      total += chunk.length;

      if (total > max) {
        done = true;
        reject(new Error('حجم المرفق أكبر من الحد المسموح'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!done) {
        resolve(Buffer.concat(chunks));
      }
    });

    req.on('error', reject);
  });
}

async function verify(req) {
  const header = req.headers.authorization || '';

  const idToken = header.startsWith('Bearer ')
    ? header.slice(7)
    : '';

  if (!idToken) {
    throw new Error('Unauthorized');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idToken
      })
    }
  );

  const data = await response.json();

  const uid = data?.users?.[0]?.localId;

  if (!response.ok || uid !== SABAH_UID) {
    throw new Error('Forbidden');
  }

  return uid;
}

module.exports = async function (req, res) {
  res.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  );

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    await verify(req);

    let originalName = 'document';

    try {
      originalName = decodeURIComponent(
        String(req.headers['x-file-name'] || 'document')
      );
    } catch (_) {}

    let extension = '';

    if (originalName.includes('.')) {
      extension = originalName
        .split('.')
        .pop()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    const pathname =
      `teacher-works/${new Date().getFullYear()}/` +
      `document-${Date.now()}` +
      (extension ? `.${extension}` : '');

    const body = await readBody(
      req,
      20 * 1024 * 1024
    );

    if (!body.length) {
      throw new Error('المرفق فارغ');
    }

    const options = {
      access: 'private',
      addRandomSuffix: true,
      contentType:
        req.headers['content-type'] ||
        'application/octet-stream'
    };

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      options.token =
        process.env.BLOB_READ_WRITE_TOKEN;
    }

    const blob = await put(
      pathname,
      body,
      options
    );

    return res.status(200).json({
      ok: true,
      pathname: blob.pathname,
      url: blob.url || '',
      fileName: originalName
    });

  } catch (error) {
    console.error('upload:', error);

    return res.status(
      error.message === 'Forbidden' ? 403 : 400
    ).json({
      error:
        error.message ||
        'تعذر رفع المرفق'
    });
  }
};
