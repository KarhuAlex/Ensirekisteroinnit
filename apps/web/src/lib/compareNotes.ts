/** Which notes a comparison shows, separate from how they are worded. */
export interface NoteFlags {
  /** Only one item is chosen, so there is nothing to compare it with yet. */
  askForAnother: boolean;
  /** The address named items that were left out. */
  droppedItems: boolean;
  /** How to read the figures. Shown whenever something is compared. */
  reading: boolean;
  /** Items are on more than one level, so a make's figures include its models. */
  overlap: boolean;
  /** A corporate group is chosen, and its makes follow today's ownership. */
  ownership: boolean;
}

interface NoteInput {
  dropped: number;
  chosen: number;
  mixedLevels: boolean;
  hasCorporateGroup: boolean;
}

export function noteFlags({
  dropped,
  chosen,
  mixedLevels,
  hasCorporateGroup,
}: NoteInput): NoteFlags {
  return {
    askForAnother: chosen === 1,
    droppedItems: dropped > 0,
    reading: chosen > 0,
    overlap: chosen > 0 && mixedLevels,
    ownership: chosen > 0 && hasCorporateGroup,
  };
}
