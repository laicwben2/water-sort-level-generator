import { parseCliOptions, stringArg, positiveIntArg } from './args';
import { safeIntArg, requireLocalRuntime } from './local';
import { runBatches } from '../batch-runner';
parseCliOptions(['directory', 'baseline', 'start-index', 'end-index', 'batch-size', 'dry-run', 'resume', 'status', 'publish', 'publish-retry'], 'Local candidate batches: --directory=DIR --baseline=SHARD --start-index=N --end-index=N [--batch-size=100 --dry-run=true --publish=true]. Resume/status: --directory=DIR --resume=true or --status=true. --publish-retry=true retries indexed/committed work without generation. Only origin/current branch; no force-push.');
requireLocalRuntime();
const directory = stringArg('directory');
if (!directory)
    throw new Error('--directory required');
const bool = (name: string) => { const s = stringArg(name); if (s !== undefined && s !== 'true')
    throw new Error(`--${name} only accepts true`); return s === 'true'; };
await runBatches({ directory, baseline: stringArg('baseline'), startIndex: stringArg('start-index') === undefined ? undefined : safeIntArg('start-index'), endIndex: stringArg('end-index') === undefined ? undefined : safeIntArg('end-index'), batchSize: stringArg('batch-size') === undefined ? undefined : positiveIntArg('batch-size', 100), dryRun: bool('dry-run'), resume: bool('resume'), status: bool('status'), publish: stringArg('publish') === undefined ? undefined : bool('publish'), publishRetry: bool('publish-retry') });
