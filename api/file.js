const { issueSignedToken, presignUrl } = require('@vercel/blob');

const FIREBASE_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  'AIzaSyDzoFcHp-fYuflYbXh08lfkOlEkUwNqkuo';

const SABAH_UID = 'AwY1Oo0iDqO5O2N3YSZYNlDdjk12';

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
      body: JSON.stringify({ idToken })
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    data?.users?.[0]?.localId !== SABAH_UID
  ) {
    throw new Error('Forbidden');
  }
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

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const pathname = String(
      body.pathname || ''
    );

    if (
      !pathname ||
      !pathname.startsWith('teacher-works/')
    ) {
      throw new Error('Invalid pathname');
    }

    const tokenOptions = {
      pathname,
      operations: ['get'],
      validUntil:
        Date.now() + 15 * 60 * 1000
    };

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      tokenOptions.token =
        process.env.BLOB_READ_WRITE_TOKEN;
    }

    const signedToken =
      await issueSignedToken(tokenOptions);

    const result = await presignUrl(
      signedToken,
      {
        operation: 'get',
        pathname,
        access: 'private',
        validUntil:
          Date.now() + 10 * 60 * 1000,
        useCache: true
      }
    );

    return res.status(200).json({
      ok: true,
      presignedUrl: result.presignedUrl
    });

  } catch (error) {
    console.error('file:', error);

    return res.status(
      error.message === 'Forbidden'
        ? 403
        : 400
    ).json({
      error:
        error.message ||
        'تعذر فتح الملف'
    });
  }
};
