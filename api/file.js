const { issueSignedToken, presignUrl } = require('@vercel/blob');

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

  if (!r.ok || uid !== 'AwY1Oo0iDqO5O2N3YSZYNlDdjk12') {
    throw new Error('Forbidden');
  }
}

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verify(req);

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const pathname = String(body.pathname || '');

    if (!pathname.startsWith('teacher-works/')) {
      throw new Error('Invalid pathname');
    }

    const signedToken = await issueSignedToken({
      pathname,
      operations: ['get'],
      validUntil: Date.now() + 15 * 60 * 1000,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    const out = await presignUrl(signedToken, {
      operation: 'get',
      pathname,
      access: 'private',
      validUntil: Date.now() + 10 * 60 * 1000,
      useCache: true
    });

    return res.status(200).json({
      ok: true,
      presignedUrl: out.presignedUrl
    });

  } catch (e) {
    console.error(e);

    return res
      .status(e.message === 'Forbidden' ? 403 : 400)
      .json({
        error: e.message || 'Open failed'
      });
  }
};
