import type { KitsuneEngine } from '@kitsuneos/core';
import { provisionUserWorkspace } from '@kitsuneos/provisioning';
import { v4 as uuidv4 } from 'uuid';
import { beforeAll, describe, expect, it } from 'vitest';
import { getEngine } from './fixtures.js';

describe('Signup provisioning', () => {
  let engine: KitsuneEngine;

  beforeAll(async () => {
    engine = await getEngine();
  });

  it('provisions a fresh empty workspace (no seeded databases)', async () => {
    const workosId = `user_${uuidv4()}`;
    const first = await provisionUserWorkspace(engine, {
      workosId,
      email: `${workosId}@example.com`,
    });
    expect(first.workspaceId).toBeTruthy();
    expect(first.apiKeyPlaintext).toBeNull();
    expect(first.created).toContain('workspace');
    expect(first.created).toContain('principal');
    expect(first.created).toContain('user');
    expect(first.created).not.toContain('collection:opportunities');
    expect(first.created).not.toContain('collection:notes');
    expect(first.created).not.toContain('seed');

    const schema = await engine.describeSchema(
      first.workspaceId,
      first.principalId,
    );
    expect(schema.collections).toEqual([]);

    const second = await provisionUserWorkspace(engine, {
      workosId,
      email: `${workosId}@example.com`,
    });
    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.apiKeyPlaintext).toBeNull();
    expect(second.skipped).toContain('already provisioned');
  });

  it('two fresh signups produce isolated empty workspaces', async () => {
    const a = await provisionUserWorkspace(engine, {
      workosId: `user_${uuidv4()}`,
      email: 'a@example.com',
    });
    const b = await provisionUserWorkspace(engine, {
      workosId: `user_${uuidv4()}`,
      email: 'b@example.com',
    });
    expect(a.workspaceId).not.toBe(b.workspaceId);

    const schemaA = await engine.describeSchema(a.workspaceId, a.principalId);
    const schemaB = await engine.describeSchema(b.workspaceId, b.principalId);
    expect(schemaA.collections).toEqual([]);
    expect(schemaB.collections).toEqual([]);
  });
});
