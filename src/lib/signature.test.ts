import { describe, it, expect } from 'vitest';
import {
  encodeAnalystSignature,
  parseAnalystSignature,
  signatureSummary,
} from './signature';

const sample = {
  typed: 'Jane Doe',
  image: 'data:image/png;base64,AAAA',
  signedAt: '2026-06-06T10:00:00.000Z',
  signedBy: 'Jane Doe',
  username: 'analyst01',
};

describe('analyst signature encode/parse', () => {
  it('round-trips every field through encode then parse', () => {
    const parsed = parseAnalystSignature(encodeAnalystSignature(sample));
    expect(parsed).toMatchObject({ version: 1, ...sample });
  });

  it('stamps version 1 into the encoded payload', () => {
    const encoded = encodeAnalystSignature(sample);
    expect(encoded.startsWith('sig:v1:')).toBe(true);
    expect(parseAnalystSignature(encoded).version).toBe(1);
  });

  it('treats a plain (non-prefixed) string as a typed signature', () => {
    const parsed = parseAnalystSignature('just a typed name');
    expect(parsed.typed).toBe('just a typed name');
    expect(parsed.image).toBe('');
    expect(parsed.username).toBe('');
  });

  it('falls back gracefully on malformed payload after the prefix', () => {
    const parsed = parseAnalystSignature('sig:v1:{not valid json');
    // Must not throw, and must not invent fields.
    expect(parsed.version).toBe(1);
    expect(parsed.image).toBe('');
    expect(parsed.signedBy).toBe('');
  });

  it('coerces non-string fields in the payload to empty strings', () => {
    const malformed = 'sig:v1:' + JSON.stringify({ version: 1, typed: 42, image: null });
    const parsed = parseAnalystSignature(malformed);
    expect(parsed.typed).toBe('');
    expect(parsed.image).toBe('');
  });

  it('handles an empty string', () => {
    const parsed = parseAnalystSignature('');
    expect(parsed.typed).toBe('');
    expect(parsed.image).toBe('');
  });
});

describe('signatureSummary', () => {
  it('reports a drawn signature when an image is present', () => {
    expect(signatureSummary(encodeAnalystSignature(sample))).toBe('Drawn signature');
  });

  it('falls back to the typed name when there is no image', () => {
    const typedOnly = encodeAnalystSignature({ ...sample, image: '' });
    expect(signatureSummary(typedOnly)).toBe('Jane Doe');
  });

  it('reports "Not signed" when neither image nor typed name exists', () => {
    const blank = encodeAnalystSignature({ ...sample, image: '', typed: '' });
    expect(signatureSummary(blank)).toBe('Not signed');
  });
});
