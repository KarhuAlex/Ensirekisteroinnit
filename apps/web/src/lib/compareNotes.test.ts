import { describe, expect, it } from 'vitest';
import { noteFlags } from './compareNotes';

const base = { dropped: 0, chosen: 2, mixedLevels: false, hasCorporateGroup: false };

describe('noteFlags', () => {
  it('has no notes when nothing is chosen', () => {
    expect(noteFlags({ ...base, chosen: 0 })).toEqual({
      askForAnother: false,
      droppedItems: false,
      reading: false,
      overlap: false,
      ownership: false,
    });
  });

  it('explains how to read the figures once something is compared', () => {
    expect(noteFlags(base)).toMatchObject({ reading: true, overlap: false, ownership: false });
  });

  it('asks for a second thing only while there is one', () => {
    expect(noteFlags({ ...base, chosen: 1 }).askForAnother).toBe(true);
    expect(noteFlags({ ...base, chosen: 2 }).askForAnother).toBe(false);
  });

  it('warns about overlap only for things on more than one level', () => {
    expect(noteFlags({ ...base, mixedLevels: true }).overlap).toBe(true);
    expect(noteFlags(base).overlap).toBe(false);
  });

  it('mentions ownership when a corporate group is compared', () => {
    expect(noteFlags({ ...base, hasCorporateGroup: true }).ownership).toBe(true);
  });

  it('reports what the address asked for in vain', () => {
    expect(noteFlags({ ...base, dropped: 2 }).droppedItems).toBe(true);
  });
});
