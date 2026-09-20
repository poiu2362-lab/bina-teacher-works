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

  if (!idToken) throw new Error('Unauthorized');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const originalName =
      String(body.fileName || 'document');

    const contentType =
      String(
        body.contentType ||
        'application/octet-stream'
      );

    const fileSize =
      Number(body.fileSize || 0);

    if (fileSize <= 0) {
      throw new Error('حجم الملف غير صالح');
    }

    if (fileSize > 20 * 1024 * 1024) {
      throw new Error(
        'الحد الأعلى للمرفق 20 ميجابايت'
      );
    }

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
      `document-${Date.now()}-` +
      `${Math.random().toString(36).slice(2, 9)}` +
      (extension ? `.${extension}` : '');

    const validUntil =
      Date.now() + 15 * 60 * 1000;

    const tokenOptions = {
      pathname,
      operations: ['put'],
      validUntil
    };

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      tokenOptions.token =
        process.env.BLOB_READ_WRITE_TOKEN;
    }

    const signedToken =
      await issueSignedToken(tokenOptions);

    const presignOptions = {
      pathname,
      operation: 'put',
      validUntil,
      access: 'private',
      contentType
    };

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      presignOptions.token =
        process.env.BLOB_READ_WRITE_TOKEN;
    }

    const result = await presignUrl(
      signedToken,
      presignOptions
    );

    return res.status(200).json({
      ok: true,
      pathname,
      uploadUrl: result.presignedUrl,
      fileName: originalName,
      contentType
    });

  } catch (error) {
    console.error('upload-sign:', error);

    return res.status(
      error.message === 'Forbidden' ? 403 : 400
    ).json({
      error:
        error.message ||
        'تعذر تجهيز رفع المرفق'
    });
  }
};
