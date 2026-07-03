// Shared sentinel for "the boss/player cell" — lets the boss room
// participate in attack/placement targeting the same way an ordinary grid
// cell index does, instead of needing a parallel code path everywhere.
export const BOSS_CELL_INDEX = -1
