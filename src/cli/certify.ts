import { DEFAULT_LOCAL_CONFIG } from '../shard'
import { parseCliOptions, stringArg } from './args'
import { runLocalGeneration } from './local'

parseCliOptions(['output'], 'Certification: --output=FILE. Fixed seed cross-platform-cert-v1, range 0–999, default config; requires native pinned runtime.')
await runLocalGeneration({ startIndex: 0, endIndex: 999, batchSeed: 'cross-platform-cert-v1', config: DEFAULT_LOCAL_CONFIG, output: stringArg('output', 'output/certification.json')! })
