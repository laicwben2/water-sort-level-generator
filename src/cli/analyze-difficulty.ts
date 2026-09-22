import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  DEFAULT_MISTAKE_ANALYSIS_CONFIG,
  analyzeMistakeRecovery,
  analyzeOptimalPathDifficulty,
  analyzeStructuralDifficulty,
} from '../difficulty'
import type { AuditCatalog, MistakeAnalysisConfig } from '../types'
import { validateAuditCatalog } from '../validator'
import { positiveIntArg, stringArg } from './args'

const inputPath = resolve(stringArg('input', 'data/audit/catalog-expanded.json')!)
const outputPath = resolve(stringArg('output', 'data/audit/catalog-expanded-difficulty-v2.json')!)

const config: MistakeAnalysisConfig = {
  maxVisitedStatesPerAlternative: positiveIntArg(
    'max-states',
    DEFAULT_MISTAKE_ANALYSIS_CONFIG.maxVisitedStatesPerAlternative,
  ),
  maxDepthPerAlternative: positiveIntArg(
    'max-depth',
    DEFAULT_MISTAKE_ANALYSIS_CONFIG.maxDepthPerAlternative,
  ),
  maxAnalyzedSteps: positiveIntArg(
    'max-steps',
    DEFAULT_MISTAKE_ANALYSIS_CONFIG.maxAnalyzedSteps,
  ),
  maxAlternativesPerStep: positiveIntArg(
    'max-alternatives',
    DEFAULT_MISTAKE_ANALYSIS_CONFIG.maxAlternativesPerStep,
  ),
  severeRecoveryThreshold: positiveIntArg(
    'severe-penalty',
    DEFAULT_MISTAKE_ANALYSIS_CONFIG.severeRecoveryThreshold,
  ),
}

const catalog = JSON.parse(await readFile(inputPath, 'utf8')) as AuditCatalog
validateAuditCatalog(catalog)

for (let index = 0; index < catalog.puzzles.length; index += 1) {
  const puzzle = catalog.puzzles[index]
  const structural = analyzeStructuralDifficulty(puzzle.board, puzzle.capacity)
  const optimalPath = analyzeOptimalPathDifficulty(
    puzzle.board,
    puzzle.optimalSolution,
    puzzle.capacity,
  )
  const mistakeRecovery = analyzeMistakeRecovery(
    puzzle.board,
    puzzle.optimalSolution,
    puzzle.capacity,
    config,
  )

  puzzle.difficultyV2 = {
    structural,
    optimalPath,
    mistakeRecovery,
  }

  process.stderr.write(
    `difficulty-v2 ${index + 1}/${catalog.puzzles.length} ${puzzle.id} `
      + `coverage=${mistakeRecovery.knownCoverage.toFixed(3)}\n`,
  )
}

validateAuditCatalog(catalog)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  puzzles: catalog.puzzles.length,
  config,
}, null, 2))
