import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MCP_CONSENT_UI_SHIPPED,
  allConnectGuideSteps,
} from './connect-copy.ts';

describe('connect copy honesty', () => {
  it('does not promise a consent prompt while consent UI is unshipped', () => {
    if (MCP_CONSENT_UI_SHIPPED) return;
    for (const step of allConnectGuideSteps()) {
      assert.equal(
        /approve access|oauth consent when prompted|when prompted/i.test(step),
        false,
        step,
      );
    }
  });

  it('states sign-in grants access when consent UI is unshipped', () => {
    if (MCP_CONSENT_UI_SHIPPED) return;
    const blob = allConnectGuideSteps().join('\n');
    assert.match(blob, /sign in|signed in|login/i);
  });
});
