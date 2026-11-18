import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose';
import { MongoClient, ObjectId } from 'mongodb';

const mongoUri = process.env.TEST_MONGODB_URI;
const options = { skip: !mongoUri && 'Set TEST_MONGODB_URI to run the MongoDB integration tests.', timeout: 30_000 };
const origin = 'http://localhost:8080';
const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));

function authAttemptEvents(logs) {
  return logs.split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((log) => log.context === 'AuthAttempt')
    .map((log) => log.message);
}

async function fixture(t, overrides = {}) {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  socket.close();
  await once(socket, 'close');

  const base = `http://127.0.0.1:${port}/api`;
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2_000 });
  const db = client.db(`easygenerator_test_${randomUUID().replaceAll('-', '')}`);
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    MONGODB_URI: mongoUri,
    MONGODB_DATABASE: db.databaseName,
    PUBLIC_ORIGIN: origin,
    ALLOW_INSECURE_HTTP: 'true',
    JWT_SECRET: randomBytes(32).toString('hex'),
    TRUST_PROXY_ADDRESS: '127.0.0.1',
    RATE_LIMIT_MAX_KEYS: '100',
    SIGN_IN_IP_LIMIT: '60',
    SIGN_IN_EMAIL_LIMIT: '5',
    SIGN_IN_WINDOW_SECONDS: '300',
    SIGN_UP_IP_LIMIT: '20',
    SIGN_UP_EMAIL_LIMIT: '5',
    SIGN_UP_WINDOW_SECONDS: '900',
    NEST_LOG_LEVEL: 'log',
    DEBUG: '',
    ...overrides,
  };
  let child;
  let logs = '';

  async function stop() {
    if (child?.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill('SIGTERM');
      await closed;
    }
  }

  async function start() {
    child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { logs += data; });
    const deadline = Date.now() + 8_000;
    while (child.exitCode === null && Date.now() < deadline) {
      const ready = await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(500) }).catch(() => null);
      if (ready?.ok) return;
      await delay(75);
    }
    assert.fail(`The test API did not become ready.\n${logs}`);
  }

  function request(path, { method = 'POST', body, headers = {} } = {}) {
    return fetch(`${base}/auth/${path}`, {
      method,
      headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  t.after(async () => {
    try {
      await stop();
      await db.dropDatabase();
    } finally {
      await client.close();
    }
  });
  await start();
  return { db, request, start, stop, jwtSecret: env.JWT_SECRET, logs: () => logs };
}

function tokenCookie(response, kind) {
  const name = `eg.${kind}`;
  const header = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
  assert.ok(header, `Expected a ${kind} cookie`);
  return { header, name, value: header.slice(name.length + 1, header.indexOf(';')) };
}

function tokenPair(response) {
  assert.equal(response.status, 204);
  assert.equal(response.headers.getSetCookie().length, 2);
  const access = tokenCookie(response, 'access');
  const refresh = tokenCookie(response, 'refresh');
  for (const { header } of [access, refresh]) {
    assert.match(header, /; Path=\/;/i);
    assert.match(header, /; HttpOnly/i);
    assert.match(header, /; SameSite=Lax/i);
    assert.doesNotMatch(header, /; (?:Secure|Domain=)/i);
  }
  return { access, refresh };
}

function cookieHeaders(...tokens) {
  return { Cookie: tokens.map(({ name, value }) => `${name}=${value}`).join('; ') };
}

test('registration, JWT sign-in, restart, and private auth logs', options, async (t) => {
  const { db, request, start, stop, logs } = await fixture(t);
  const user = { name: '  Ada  ', email: ' A.da+Course@EXAMPLE.COM ', password: ' Exact123! ' };
  const me = (...tokens) => request('me', { method: 'GET', headers: cookieHeaders(...tokens) });
  assert.equal((await me()).status, 401);
  assert.equal((await request('sign-up', { body: user, headers: { Origin: 'http://elsewhere.test' } })).status, 403);
  assert.equal((await request('sign-up', { body: user, headers: { Origin: '' } })).status, 403);
  assert.equal((await request('sign-up', { body: user, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('sign-up', { body: 'x'.repeat(8_193) })).status, 413);

  const malformed = await request('sign-up', { body: '{ "password": "SECRET-MALFORMED", invalid }' });
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(await malformed.text(), /SECRET-MALFORMED/);
  const invalid = await request('sign-up', { body: { name: ' x ', email: 'no', password: 'bad' } });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys((await invalid.json()).fieldErrors).sort(), ['email', 'name', 'password']);

  const registrations = await Promise.all([
    request('sign-up', { body: user }),
    request('sign-up', { body: { ...user, email: 'a.da+course@example.com' } }),
  ]);
  assert.deepEqual(registrations.map((response) => response.status).sort(), [204, 409]);
  assert.equal(await db.collection('users').countDocuments(), 1);
  assert.match((await db.collection('users').findOne()).passwordHash, /^\$argon2id\$/);
  const duplicate = { ...user, password: 'Different123!' };
  const conflict = await request('sign-up', { body: duplicate });
  assert.equal(conflict.status, 409);
  assert.deepEqual((await conflict.json()).fieldErrors, { email: ['This email address is already registered.'] });
  const wrong = await request('sign-in', { body: duplicate });
  const unknown = await request('sign-in', { body: { ...duplicate, email: 'unknown@example.com' } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());

  const login = await request('sign-in?marker=PRIVATE-QUERY', {
    body: user, headers: { 'X-Forwarded-For': '192.0.2.73', 'X-Privacy-Test': 'PRIVATE-HEADER' },
  });
  const first = tokenPair(login);
  const publicResponse = await me(first.access);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
  assert.ok(Number(publicResponse.headers.get('X-Access-Expires-In-Ms')) > 0);
  assert.deepEqual(await publicResponse.json(), {
    id: (await db.collection('users').findOne())._id.toHexString(), name: 'Ada', email: 'a.da+course@example.com',
  });

  const second = tokenPair(await request('sign-in', { body: user, headers: cookieHeaders(first.access, first.refresh) }));
  assert.notEqual(decodeJwt(second.access.value).sid, decodeJwt(first.access.value).sid);
  assert.equal((await me(first.access)).status, 401);
  assert.equal((await request('refresh', { headers: cookieHeaders(first.refresh) })).status, 401);
  await stop();
  await start();
  assert.equal((await me(second.access)).status, 200);
  assert.equal((await request('refresh', { headers: cookieHeaders(second.refresh) })).status, 204);
  await stop();
  const events = authAttemptEvents(logs());
  const acceptedSignup = { event: 'auth_attempt', action: 'sign-up', outcome: 'accepted', statusCode: 204 };
  const acceptedSignin = { ...acceptedSignup, action: 'sign-in' };
  const rejectedSignup = { ...acceptedSignup, outcome: 'rejected' };
  const rejectedSignin = { ...acceptedSignin, outcome: 'rejected', statusCode: 401 };
  const byStatus = (a, b) => a.statusCode - b.statusCode;
  assert.deepEqual(events.toSorted(byStatus), [
    ...[403, 403, 415, 413, 400, 400].map((statusCode) => ({ ...rejectedSignup, statusCode })),
    acceptedSignup, { ...rejectedSignup, statusCode: 409 }, { ...rejectedSignup, statusCode: 409 },
    rejectedSignin, rejectedSignin,
    acceptedSignin, acceptedSignin,
  ].toSorted(byStatus));
  for (const value of [
    user.password, duplicate.password, user.email.trim(), 'a.da+course@example.com', 'unknown@example.com',
    decodeJwt(second.access.value).sid, first.access.value, first.refresh.value, second.access.value, second.refresh.value,
    'SECRET-MALFORMED', 'PRIVATE-QUERY', 'PRIVATE-HEADER', '192.0.2.73',
  ]) {
    assert.equal(logs().includes(value), false);
  }
});

test('JWT expiry, concurrent refresh, and immediate logout revocation', options, async (t) => {
  const { db, request, jwtSecret } = await fixture(t);
  const user = { name: 'Ada Example', email: 'ada@example.com', password: 'Example123!' };
  const me = (token) => request('me', { method: 'GET', headers: cookieHeaders(token) });
  const refresh = (token) => request('refresh', { headers: cookieHeaders(token) });
  const logins = db.collection('auth_logins');
  const key = Buffer.from(jwtSecret);

  assert.equal((await request('sign-up', { body: user })).status, 204);
  const first = tokenPair(await request('sign-in', { body: user }));
  const accessClaims = decodeJwt(first.access.value);
  const refreshClaims = decodeJwt(first.refresh.value);
  const loginId = new ObjectId(refreshClaims.sid);
  assert.equal(accessClaims.exp - accessClaims.iat, 5 * 60);
  assert.equal(refreshClaims.exp - refreshClaims.iat, 8 * 60 * 60);
  assert.equal(accessClaims.sid, refreshClaims.sid);
  assert.equal((await logins.findOne({ _id: loginId })).expiresAt.getTime(), refreshClaims.exp * 1000);

  assert.equal((await me({ ...first.refresh, name: first.access.name })).status, 401);
  assert.equal((await refresh({ ...first.access, name: first.refresh.name })).status, 401);
  const [header, payload, signature] = first.access.value.split('.');
  const tampered = `${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
  assert.equal((await me({ ...first.access, value: tampered })).status, 401);
  const expiredAccess = await new SignJWT({ ...accessClaims, exp: Math.floor(Date.now() / 1000) - 1 })
    .setProtectedHeader(decodeProtectedHeader(first.access.value)).sign(key);
  assert.equal((await me({ ...first.access, value: expiredAccess })).status, 401);
  assert.equal((await request('refresh', {
    headers: { ...cookieHeaders(first.refresh), Origin: 'http://elsewhere.test' },
  })).status, 403);

  const attempts = await Promise.all([refresh(first.refresh), refresh(first.refresh)]);
  assert.deepEqual(attempts.map((response) => response.status).sort(), [204, 401]);
  assert.deepEqual(attempts.find((response) => response.status === 401).headers.getSetCookie(), []);
  const second = tokenPair(attempts.find((response) => response.status === 204));
  assert.notEqual(second.access.value, first.access.value);
  assert.notEqual(second.refresh.value, first.refresh.value);
  assert.equal(decodeJwt(second.refresh.value).exp, refreshClaims.exp);
  assert.equal((await refresh(first.refresh)).status, 401);
  assert.equal((await me(second.access)).status, 200);

  // Sign-out must also work when the browser has already lost its expired access cookie.
  const logout = await request('logout', { headers: cookieHeaders(second.refresh) });
  assert.equal(logout.status, 204);
  assert.equal(logout.headers.getSetCookie().length, 2);
  for (const kind of ['access', 'refresh']) {
    const cleared = tokenCookie(logout, kind);
    assert.equal(cleared.value, '');
    assert.match(cleared.header, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  }
  assert.equal((await me(first.access)).status, 401);
  assert.equal((await me(second.access)).status, 401);
  assert.equal((await refresh(second.refresh)).status, 401);
  assert.equal(await logins.countDocuments({ _id: loginId }), 0);
  assert.equal((await request('logout')).status, 204);

  const expiring = tokenPair(await request('sign-in', { body: user }));
  const claims = decodeJwt(expiring.refresh.value);
  const expiresSoon = Math.floor(Date.now() / 1000) + 30;
  const expiringLogin = { _id: new ObjectId(claims.sid) };
  await logins.updateOne(expiringLogin, { $set: { expiresAt: new Date(expiresSoon * 1000) } });
  const nearExpiry = await new SignJWT({ ...claims, exp: expiresSoon })
    .setProtectedHeader(decodeProtectedHeader(expiring.refresh.value)).sign(key);
  const finalPair = tokenPair(await refresh({ ...expiring.refresh, value: nearExpiry }));
  assert.equal(decodeJwt(finalPair.access.value).exp, expiresSoon);
  assert.equal(decodeJwt(finalPair.refresh.value).exp, expiresSoon);

  await logins.updateOne(expiringLogin, { $set: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await me(finalPair.access)).status, 401);
  assert.equal((await refresh(finalPair.refresh)).status, 401);
  assert.equal((await logins.indexes()).find((index) => index.name === 'expiresAt_1').expireAfterSeconds, 0);
});

test('independent IP and email budgets reserve concurrent attempts and expire without extension', options, async (t) => {
  const { request, stop, start, logs } = await fixture(t, {
    SIGN_IN_IP_LIMIT: '3', SIGN_IN_EMAIL_LIMIT: '2', SIGN_IN_WINDOW_SECONDS: '4',
    SIGN_UP_IP_LIMIT: '4', SIGN_UP_EMAIL_LIMIT: '2',
  });
  const ip = (number) => ({ 'X-Forwarded-For': `192.0.2.${number}` });
  const signup = (email, from) => request('sign-up', { body: { email, name: 'Ada', password: 'Example123!' }, headers: ip(from) });
  const signin = (email, from, password = 'wrong') => request('sign-in', { body: { email, password }, headers: ip(from) });
  const email = 'ada@example.com';
  const sharedIp = 10;

  assert.equal((await signup(email, sharedIp)).status, 204);
  assert.equal((await signup(' ADA@EXAMPLE.COM ', 11)).status, 409);
  assert.equal((await signup(email, 12)).status, 429);
  assert.equal((await signin(email, sharedIp, 'Example123!')).status, 204);

  const simultaneous = await Promise.all([
    signin(email, 11), signin(' ADA@EXAMPLE.COM ', 12), signin(email, 13),
  ]);
  assert.deepEqual(simultaneous.map((response) => response.status).sort(), [401, 401, 429]);
  const blocked = simultaneous.find((response) => response.status === 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0 && Number(blocked.headers.get('retry-after')) <= 4);

  const unknown = 'unknown@example.com';
  assert.equal((await signin(unknown, sharedIp)).status, 401);
  assert.equal((await signin(unknown, 15)).status, 401);
  assert.equal((await signin(unknown, 16)).status, 429);
  assert.equal((await signin('different@example.com', sharedIp)).status, 401);
  assert.equal((await signin('another@example.com', sharedIp)).status, 429);

  await delay(4_100);
  assert.equal((await signin(email, sharedIp, 'Example123!')).status, 204);
  assert.equal((await signin(unknown, sharedIp)).status, 401);
  assert.equal((await signin(unknown, sharedIp)).status, 401);
  assert.equal((await signin(unknown, sharedIp)).status, 429);
  await stop();
  for (const action of ['sign-up', 'sign-in']) {
    assert.ok(authAttemptEvents(logs()).some((event) => (
      event.action === action && event.outcome === 'rate_limited' && event.statusCode === 429
    )));
  }
  await start();
  assert.equal((await signin(unknown, sharedIp)).status, 401);
});

test('sign-up and IP-throttled sign-in leave existing tokens active', options, async (t) => {
  const { db, request } = await fixture(t, { SIGN_IN_IP_LIMIT: '1' });
  const user = { name: 'Ada Example', email: 'ada@example.com', password: 'Example123!' };
  assert.equal((await request('sign-up', { body: user })).status, 204);
  const tokens = tokenPair(await request('sign-in', { body: user }));
  const headers = cookieHeaders(tokens.access, tokens.refresh);
  const blocked = await request('sign-in', { body: user, headers });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal((await request('sign-up', { body: { ...user, email: 'other@example.com' }, headers })).status, 204);
  assert.equal((await request('me', { method: 'GET', headers })).status, 200);
  assert.equal(await db.collection('auth_logins').countDocuments(), 1);
});
