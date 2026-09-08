import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LANDING, visibleLandingStrings } from './landing-copy.ts';

describe('landing copy', () => {
  it('has zero em-dash or en-dash characters', () => {
    for (const value of visibleLandingStrings()) {
      assert.equal(/\u2014|\u2013/.test(value), false, value);
    }
  });

  it('uses Start free as the only signup CTA label', () => {
    assert.equal(LANDING.ctaPrimary, 'Start free');
    assert.equal(LANDING.ctaSecondary, 'Sign in');
    assert.equal(LANDING.joinPrimary, 'Start free');
  });

  it('has no hero eyebrow field', () => {
    assert.equal('eyebrow' in LANDING.hero, false);
  });
});
