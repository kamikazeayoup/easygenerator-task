import { randomBytes } from 'node:crypto';
import { link, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function localJwtSecret() {
  const directory = '/var/lib/easygenerator/jwt';
  const target = join(directory, 'signing-key');
  try {
    return await readFile(target, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const temporary = await mkdtemp(join(directory, 'key-'));
  try {
    const source = join(temporary, 'signing-key');
    await writeFile(source, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' });
    await link(source, target).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return readFile(target, 'utf8');
}

if (process.env.NODE_ENV !== 'production' && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = await localJwtSecret();
}
await import('../dist/main.js');
