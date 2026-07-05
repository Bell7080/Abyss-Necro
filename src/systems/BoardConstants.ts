// Shared sentinel for "the boss/player cell" — lets the boss room
// participate in attack/placement targeting the same way an ordinary grid
// cell index does, instead of needing a parallel code path everywhere.
export const BOSS_CELL_INDEX = -1

// How long a freshly-spawned enemy's crawl-in from the fog takes. Shared
// between the visual (BoardRenderer's .is-spawning-approach slide + board.css
// transition-duration, which must match) and the model (WaveSystem holds an
// approaching enemy out of movement AND combat until it has visibly arrived —
// otherwise an ally at the entry cell would trade invisible blows with a
// token still off in the fog).
export const SPAWN_APPROACH_MS = 3800
