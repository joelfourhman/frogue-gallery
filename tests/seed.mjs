// Pacing probes must exercise the same world/AI stream on every invocation.
// Human input noise still uses its separate HUMAN_SEED stream.
import { mulberry32 } from '../src/math.js';
Math.random = mulberry32(1337);
Date.now = () => 1790467200000;
