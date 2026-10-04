import { DEFAULT_LOCAL_CONFIG } from '../shard'
import { stringArg } from './args'
import { runLocalGeneration } from './local'

if (process.argv.slice(2).some(arg => !arg.startsWith('--output='))) throw new Error('Certification accepts only --output; seed, config and range are fixed')
await runLocalGeneration({ startIndex: 0, endIndex: 999, batchSeed: 'cross-platform-cert-v1', config: DEFAULT_LOCAL_CONFIG, output: stringArg('output', 'output/certification.json')! })
