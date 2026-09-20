const { put } = require('@vercel/blob');

module.exports.config = { api: { bodyParser: false } };

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', c => {
      total += c.length;
      if (total > max) {
        reject(new Error('حجم المرفق كبير'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function verify(req) {
  const h = req.headers.authorization || '';
  const idToken = h.startsWith('Bearer ') ? h.slice(7) : '';

  if (!idToken) throw new Error('Unauthorized');

  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new Error('Firebase key missing');

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );

  const j = await r.json();
  const uid = j?.users?.[0]?.localId;

  if (
    !r.ok ||
    uid !== 'AwY1Oo0iDqO5O2N3YSZYNlDdjk12'
  ) {
    throw new Error('Forbidden');
  }

  return uid;
}

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verify(req);

    let name = 'document';

    try {
      name = decodeURIComponent(
        String(req.headers['x-file-name'] || 'document')
      );
    } catch {}

    let ext = '';

    if (name.includes('.')) {
      ext = name
        .split('.')
        .pop()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    const pathname =
      `teacher-works/${new Date().getFullYear()}/` +
      `document-${Date.now()}${ext ? '.' + ext : ''}`;

    const body = await readBody(req, 20 * 1024 * 1024);

    if (!body.length) {
      throw new Error('المرفق فارغ');
    }

    const blob = await put(pathname, body, {
      access: 'private',
      addRandomSuffix: true,
      contentType:
        req.headers['content-type'] ||
        'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return res.status(200).json({
      ok: true,
      pathname: blob.pathname
    });

  } catch (e) {
    console.error(e);

    return res
      .status(e.message === 'Forbidden' ? 403 : 400)
      .json({
        error: e.message || 'Upload failed'
      });
  }
};
