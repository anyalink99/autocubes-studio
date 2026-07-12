import fs from 'node:fs/promises';
import path from 'node:path';
import {workspacePath} from './paths';

export type SyncRecord = {
  channel: 'operations' | 'documents';
  revision: number;
  updatedAt: string;
  updatedBy: string;
  data: unknown;
};

const allowedChannels = new Set<SyncRecord['channel']>(['operations', 'documents']);
const root = workspacePath('data/runtime/sync');
const queues = new Map<string, Promise<unknown>>();

export const assertSyncChannel = (channel: string): SyncRecord['channel'] => {
  if (!allowedChannels.has(channel as SyncRecord['channel'])) throw new Error('Unknown sync channel');
  return channel as SyncRecord['channel'];
};

const recordPath = (channel: SyncRecord['channel']) => path.join(root, `${channel}.json`);

export const readSyncRecord = async (channel: SyncRecord['channel']): Promise<SyncRecord | null> => {
  try {
    return JSON.parse(await fs.readFile(recordPath(channel), 'utf8')) as SyncRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

const keepRecentBackups = async (directory: string, keep = 25) => {
  const entries = await fs.readdir(directory, {withFileTypes: true}).catch(() => []);
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name));
  await Promise.all(files.slice(keep).map((entry) => fs.unlink(path.join(directory, entry.name)).catch(() => undefined)));
};

const writeRecord = async (record: SyncRecord) => {
  await fs.mkdir(root, {recursive: true});
  const target = recordPath(record.channel);
  const temporary = path.join(root, `.${record.channel}-${process.pid}-${Date.now()}.tmp`);
  const serialized = `${JSON.stringify(record, null, 2)}\n`;
  await fs.writeFile(temporary, serialized, 'utf8');
  await fs.copyFile(temporary, target);
  await fs.unlink(temporary).catch(() => undefined);
  const backupDirectory = path.join(root, 'backups', record.channel);
  await fs.mkdir(backupDirectory, {recursive: true});
  await fs.writeFile(path.join(backupDirectory, `${String(record.revision).padStart(8, '0')}.json`), serialized, 'utf8');
  await keepRecentBackups(backupDirectory);
};

export const updateSyncRecord = async (channel: SyncRecord['channel'], baseRevision: number, data: unknown, updatedBy: string) => {
  const pending = queues.get(channel) ?? Promise.resolve();
  const next = pending.then(async () => {
    const current = await readSyncRecord(channel);
    const revision = current?.revision ?? 0;
    if (revision !== baseRevision) return {conflict: true as const, current};
    const record: SyncRecord = {channel, revision: revision + 1, updatedAt: new Date().toISOString(), updatedBy: updatedBy.slice(0, 80) || 'studio', data};
    await writeRecord(record);
    return {conflict: false as const, current: record};
  });
  const queued = next.finally(() => { if (queues.get(channel) === queued) queues.delete(channel); });
  queues.set(channel, queued);
  return next;
};
