const cors = require('cors');
const express = require('express');
const https = require('node:https');
const { createHmac, randomUUID, randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data', 'schedules.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const REVOKED_TOKENS_FILE = path.join(__dirname, 'data', 'revoked-tokens.json');
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-only-change-before-deploy');
const TLS_KEY_PATH = process.env.API_TLS_KEY_PATH;
const TLS_CERT_PATH = process.env.API_TLS_CERT_PATH;
const revokedTokenIds = new Set();
let revocationsLoadPromise;

if (!JWT_SECRET) throw new Error('JWT_SECRET wajib diatur pada server produksi.');
if (process.env.NODE_ENV === 'production' && (!TLS_KEY_PATH || !TLS_CERT_PATH)) {
  throw new Error('API_TLS_KEY_PATH dan API_TLS_CERT_PATH wajib diatur pada server produksi.');
}
if (Boolean(TLS_KEY_PATH) !== Boolean(TLS_CERT_PATH)) {
  throw new Error('API_TLS_KEY_PATH dan API_TLS_CERT_PATH harus diatur berpasangan.');
}

const makePasswordHash = (password, salt = randomBytes(16).toString('hex')) => ({
  salt,
  hash: scryptSync(password, salt, 64).toString('hex'),
});

const DEMO_USERS = [
  { id: 'acc_pelajar_1', name: 'Budi Santoso', identifier: 'siswa@sekolah.id', role: 'Pelajar', ...makePasswordHash('password123') },
  { id: 'acc_mahasiswa_1', name: 'Ahmad Fikri', identifier: 'mahasiswa@kampus.ac.id', role: 'Mahasiswa', ...makePasswordHash('password123') },
];

async function readUsers() {
  try {
    return JSON.parse(await readFile(USERS_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeUsers(DEMO_USERS);
    return DEMO_USERS;
  }
}

async function writeUsers(users) {
  await writeFile(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
}

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const content = `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart({
    sub: user.id,
    role: user.role,
    jti: randomUUID(),
    iat: now,
    exp: now + TOKEN_TTL_MS / 1000,
  })}`;
  const signature = createHmac('sha256', JWT_SECRET).update(content).digest('base64url');
  return `${content}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const content = `${parts[0]}.${parts[1]}`;
  const expectedSignature = createHmac('sha256', JWT_SECRET).update(content).digest();
  let actualSignature;
  let header;
  let payload;
  try {
    actualSignature = Buffer.from(parts[2], 'base64url');
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') return null;
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
  if (header.alg !== 'HS256' || header.typ !== 'JWT' || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') return null;
  if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function loadRevocations() {
  if (!revocationsLoadPromise) {
    revocationsLoadPromise = readFile(REVOKED_TOKENS_FILE, 'utf8')
      .then((content) => JSON.parse(content))
      .catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      })
      .then((ids) => {
        if (!Array.isArray(ids)) throw new Error('Format daftar token yang dicabut tidak valid.');
        ids.forEach((id) => revokedTokenIds.add(id));
      });
  }
  await revocationsLoadPromise;
}

async function requireAuth(request, response, next) {
  const authorization = request.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const claims = match ? verifyToken(match[1]) : null;
  if (!claims) {
    return response.status(401).json({ message: 'Token tidak ada atau sudah tidak berlaku.' });
  }
  try {
    await loadRevocations();
    if (revokedTokenIds.has(claims.jti)) {
      return response.status(401).json({ message: 'Token sudah dicabut. Silakan masuk kembali.' });
    }
    request.authUserId = claims.sub;
    request.authTokenId = claims.jti;
    next();
  } catch (error) {
    next(error);
  }
}

function publicUser(user) {
  return { userId: user.id, name: user.name, identifier: user.identifier, role: user.role };
}

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const { identifier, password, role } = request.body || {};
    if (typeof identifier !== 'string' || typeof password !== 'string' || !['Pelajar', 'Mahasiswa'].includes(role)) {
      return response.status(400).json({ message: 'Email, kata sandi, dan peran wajib diisi.' });
    }
    const user = (await readUsers()).find((item) => item.identifier.toLowerCase() === identifier.trim().toLowerCase() && item.role === role);
    if (!user) return response.status(401).json({ message: 'Email atau kata sandi tidak valid.' });
    const candidate = scryptSync(password, user.salt, 64);
    const stored = Buffer.from(user.hash, 'hex');
    if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) {
      return response.status(401).json({ message: 'Email atau kata sandi tidak valid.' });
    }
    response.json({ access_token: issueToken(user), token_type: 'Bearer', expires_in: TOKEN_TTL_MS / 1000, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const { name, identifier, password, role } = request.body || {};
    if (typeof name !== 'string' || !name.trim() || typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || password.length < 6 || !['Pelajar', 'Mahasiswa'].includes(role)) {
      return response.status(400).json({ message: 'Nama, email, peran wajib diisi dan kata sandi minimal 6 karakter.' });
    }
    const users = await readUsers();
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (users.some((user) => user.identifier.toLowerCase() === normalizedIdentifier)) {
      return response.status(409).json({ message: 'Email atau username sudah terdaftar.' });
    }
    const user = {
      id: randomUUID(), name: name.trim(), identifier: identifier.trim(), role,
      ...makePasswordHash(password),
    };
    users.push(user);
    await writeUsers(users);
    response.status(201).json({ access_token: issueToken(user), token_type: 'Bearer', expires_in: TOKEN_TTL_MS / 1000, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', requireAuth, async (request, response, next) => {
  try {
    await loadRevocations();
    revokedTokenIds.add(request.authTokenId);
    await writeFile(REVOKED_TOKENS_FILE, `${JSON.stringify([...revokedTokenIds], null, 2)}\n`, 'utf8');
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', requireAuth, async (request, response, next) => {
  try {
    const user = (await readUsers()).find((item) => item.id === request.authUserId);
    if (!user) return response.status(401).json({ message: 'Sesi pengguna tidak ditemukan.' });
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

async function readSchedules() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeSchedules([]);
    return [];
  }
}

async function writeSchedules(schedules) {
  await writeFile(DATA_FILE, `${JSON.stringify(schedules, null, 2)}\n`, 'utf8');
}

function validSchedule(value) {
  return value &&
    typeof value.subject === 'string' && value.subject.trim() &&
    DAYS.includes(value.day) &&
    /^\d{2}:\d{2}$/.test(value.timeStart) &&
    /^\d{2}:\d{2}$/.test(value.timeEnd) &&
    typeof value.teacher === 'string' &&
    typeof value.room === 'string' &&
    Number.isFinite(Number(value.sks));
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'calendar-schedule-api' });
});

app.get('/api/schedules', requireAuth, async (request, response, next) => {
  try {
    let schedules = await readSchedules();
    const { day } = request.query;
    if (typeof day === 'string') schedules = schedules.filter((item) => item.day === day);
    schedules.sort((first, second) => DAYS.indexOf(first.day) - DAYS.indexOf(second.day) || first.timeStart.localeCompare(second.timeStart));
    response.json(schedules);
  } catch (error) {
    next(error);
  }
});

app.post('/api/schedules', requireAuth, async (request, response, next) => {
  try {
    if (!validSchedule(request.body)) {
      return response.status(400).json({ message: 'Data jadwal tidak lengkap atau formatnya tidak valid.' });
    }
    const schedules = await readSchedules();
    const item = {
      id: randomUUID(),
      subject: request.body.subject.trim(),
      day: request.body.day,
      timeStart: request.body.timeStart,
      timeEnd: request.body.timeEnd,
      teacher: request.body.teacher.trim(),
      room: request.body.room.trim(),
      sks: Number(request.body.sks) || 0,
    };
    schedules.push(item);
    await writeSchedules(schedules);
    response.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.put('/api/schedules/:id', requireAuth, async (request, response, next) => {
  try {
    if (!validSchedule(request.body)) {
      return response.status(400).json({ message: 'Data jadwal tidak lengkap atau formatnya tidak valid.' });
    }
    const schedules = await readSchedules();
    const index = schedules.findIndex((item) => item.id === request.params.id);
    if (index < 0) return response.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    const updated = {
      ...schedules[index],
      subject: request.body.subject.trim(),
      day: request.body.day,
      timeStart: request.body.timeStart,
      timeEnd: request.body.timeEnd,
      teacher: request.body.teacher.trim(),
      room: request.body.room.trim(),
      sks: Number(request.body.sks) || 0,
    };
    schedules[index] = updated;
    await writeSchedules(schedules);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/schedules/:id', requireAuth, async (request, response, next) => {
  try {
    const schedules = await readSchedules();
    const remaining = schedules.filter((item) => item.id !== request.params.id);
    if (remaining.length === schedules.length) return response.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    await writeSchedules(remaining);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'Terjadi kesalahan saat memproses API jadwal.' });
});

async function startServer() {
  if (TLS_KEY_PATH && TLS_CERT_PATH) {
    const key = await readFile(path.resolve(TLS_KEY_PATH));
    const cert = await readFile(path.resolve(TLS_CERT_PATH));
    https.createServer({ key, cert }, app).listen(PORT, HOST, () => {
      console.log(`Secure calendar schedule API ready at https://localhost:${PORT}`);
    });
    return;
  }

  app.listen(PORT, HOST, () => {
    console.log(`Calendar schedule API ready at http://localhost:${PORT} (development only)`);
  });
}

startServer().catch((error) => {
  console.error('API server failed to start:', error);
  process.exitCode = 1;
});
