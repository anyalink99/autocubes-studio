import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const main = async () => {
  const original = process.cwd();
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'autocubes-sync-'));
  try {
    process.chdir(temporary);
    const {readSyncRecord, updateSyncRecord} = await import('../dev-server/sync-store');
    const created = await updateSyncRecord('documents', 0, [{id:'doc-1'}], 'qa-a');
    if (created.conflict || created.current?.revision !== 1) throw new Error('Initial sync revision was not created');
    const conflict = await updateSyncRecord('documents', 0, [{id:'stale'}], 'qa-b');
    if (!conflict.conflict || conflict.current?.revision !== 1) throw new Error('Stale sync write was not rejected');
    const saved = await updateSyncRecord('documents', 1, [{id:'doc-2'}], 'qa-a');
    if (saved.conflict || saved.current?.revision !== 2) throw new Error('Second sync revision was not saved');
    const loaded = await readSyncRecord('documents');
    if (loaded?.revision !== 2 || !Array.isArray(loaded.data)) throw new Error('Saved sync state could not be loaded');
    const backups = await fs.readdir(path.join(temporary, 'data/runtime/sync/backups/documents'));
    if (backups.length !== 2) throw new Error('Sync backups were not retained');
    console.log('Sync smoke passed · optimistic conflict · 2 revisions · 2 backups');
  } finally {
    process.chdir(original);
    await fs.rm(temporary, {recursive:true, force:true});
  }
};

void main().catch((error) => {console.error(error);process.exitCode = 1;});
