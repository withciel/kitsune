import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildZip, readZip } from './vault-zip.ts';

describe('vault zip', () => {
  it('round-trips entries built by buildZip', () => {
    const entries = [
      { name: 'a.md', data: Buffer.from('---\nid: 1\n---\n\nBody A', 'utf8') },
      { name: 'nested/b.md', data: Buffer.from('Body B', 'utf8') },
    ];
    const zip = buildZip(entries);
    const back = readZip(zip);
    assert.equal(back.length, 2);
    assert.deepEqual(
      back.map((e) => ({ name: e.name, data: e.data.toString('utf8') })),
      [
        { name: 'a.md', data: '---\nid: 1\n---\n\nBody A' },
        { name: 'nested/b.md', data: 'Body B' },
      ],
    );
  });

  it('produces a valid empty archive for zero entries', () => {
    const zip = buildZip([]);
    const back = readZip(zip);
    assert.deepEqual(back, []);
  });

  it('throws a clear error for non-zip input', () => {
    assert.throws(() => readZip(Buffer.from('not a zip', 'utf8')));
  });
});
