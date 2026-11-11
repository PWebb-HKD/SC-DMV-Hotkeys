// Resolve development dependencies locally, falling back to this workstation runtime; not shipped extension code.
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
const local = createRequire(import.meta.url);
const bundled = createRequire(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'));
/** Prefer project dependencies; fall back to the managed runtime when local resolution fails. */
export function dependency(name) { try { return local(name); } catch { return bundled(name); } }
