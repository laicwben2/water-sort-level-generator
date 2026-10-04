import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { writeExclusive } from '../artifact-store';
import { installTelemetry } from '../telemetry';
export async function supervise(output: string): Promise<void> {
    if (process.env.WATER_SORT_SUPERVISED === '1') {
        installTelemetry();
        return;
    }
    const started = performance.now(), startTime = new Date().toISOString();
    const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], { env: { ...process.env, WATER_SORT_SUPERVISED: '1' }, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    let telemetry: unknown = null;
    child.on('message', m => { if ((m as {
        kind?: string;
    })?.kind === 'water-sort-telemetry')
        telemetry = m; });
    const heartbeat = setInterval(() => process.stderr.write(`Working: ${((performance.now() - started) / 1000).toFixed(0)}s elapsed\n`), 10000);
    const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    const result = await new Promise<{
        code: number | null;
        signal: string | null;
    }>(resolve => { child.once('error', () => resolve({ code: 1, signal: 'spawn-error' })); child.once('close', (code, signal) => resolve({ code, signal })); });
    clearInterval(heartbeat);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
    const report = join(`${output}.process-runs`, `${randomUUID()}.json`);
    await writeExclusive(report, { formatVersion: 'local-process-run-v1', startTime, finishTime: new Date().toISOString(), elapsedMs: performance.now() - started, status: result.code === 0 ? 'completed' : 'failed', ...result, telemetry, scope: 'Whole worker workload including artifact writes; excludes parent report I/O. Child terminal snapshot unavailable on forced termination. Phase durations are inclusive and may overlap.' });
    process.stderr.write(`Process report: ${report}\n`);
    process.exit(result.code ?? (result.signal === 'SIGINT' ? 130 : 1));
}
