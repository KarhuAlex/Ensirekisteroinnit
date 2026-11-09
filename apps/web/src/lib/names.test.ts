import { describe, expect, it } from 'vitest';
import { displayName } from './names';

describe('displayName', () => {
  it('title-cases long words', () => {
    expect(displayName('ACME ROAD STAR')).toBe('Acme Road Star');
    expect(displayName('ACME-BENZ')).toBe('Acme-Benz');
  });
  it('keeps short acronyms upper case', () => {
    expect(displayName('ACE')).toBe('ACE');
    expect(displayName('ACE ROADSTER')).toBe('ACE Roadster');
  });
  it('keeps tokens with digits upper case', () => {
    expect(displayName('ACME ZX4')).toBe('Acme ZX4');
    expect(displayName('ACME ZX4X')).toBe('Acme ZX4X');
  });
  it('collapses extra whitespace', () => {
    expect(displayName('  ACME   ROADSTER ')).toBe('Acme Roadster');
  });
});
