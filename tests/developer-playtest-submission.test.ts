import { describe, expect, it } from 'vitest'
import type { SubmissionBenchmark } from '../apps/developer-playtest/lib/submission-validation'
import {
  SubmissionValidationError,
  validateSubmissionRequest,
} from '../apps/developer-playtest/lib/submission-validation'

const benchmark: SubmissionBenchmark = {
  benchmark: 'difficulty-v2-benchmark-v1',
  puzzles: [{
    benchmarkId: 'B01',
    capacity: 2,
    board: [[0, 1], [0, 1], []],
  }],
}

function solvedSubmission() {
  return {
    sessionId: '123e4567-e89b-42d3-a456-426614174000',
    document: {
      version: 'difficulty-v2-playtest-results-v2',
      benchmark: 'difficulty-v2-benchmark-v1',
      exportedAt: '2026-09-23T06:10:00.000Z',
      results: [{
        benchmarkId: 'B01',
        outcome: 'solved',
        elapsedMs: 5000,
        moves: 3,
        restarts: 0,
        actions: [
          { type: 'move', atMs: 1000, from: 0, to: 2, color: 1, amount: 1 },
          { type: 'move', atMs: 2000, from: 1, to: 2, color: 1, amount: 1 },
          { type: 'move', atMs: 3000, from: 0, to: 1, color: 0, amount: 1 },
        ],
        finalBoard: [[], [0, 0], [1, 1]],
        perceivedDifficulty: 2,
      }],
    },
  }
}

describe('developer playtest submission validation', () => {
  it('accepts a replayable solved submission', () => {
    const validated = validateSubmissionRequest(solvedSubmission(), benchmark)
    expect(validated.document.results).toHaveLength(1)
  })

  it('rejects moves that disagree with classic-v1 replay', () => {
    const submission = solvedSubmission()
    submission.document.results[0].actions[0].amount = 2
    expect(() => validateSubmissionRequest(submission, benchmark))
      .toThrow(SubmissionValidationError)
  })

  it('rejects final boards that disagree with the action history', () => {
    const submission = solvedSubmission()
    submission.document.results[0].finalBoard = [[0], [0], [1, 1]]
    expect(() => validateSubmissionRequest(submission, benchmark))
      .toThrow(/finalBoard disagrees/)
  })

  it('rejects false solved outcomes', () => {
    const submission = solvedSubmission()
    submission.document.results[0].actions = []
    submission.document.results[0].moves = 0
    submission.document.results[0].finalBoard = [[0, 1], [0, 1], []]
    expect(() => validateSubmissionRequest(submission, benchmark))
      .toThrow(/Solved outcome is not solved/)
  })

  it('accepts an unsolved gave-up result with a reason', () => {
    const submission = solvedSubmission()
    submission.document.results[0] = {
      benchmarkId: 'B01',
      outcome: 'gave-up',
      elapsedMs: 1500,
      moves: 0,
      restarts: 0,
      actions: [],
      finalBoard: [[0, 1], [0, 1], []],
      perceivedDifficulty: 5,
      giveUpReasons: ['no-next-move'],
    } as typeof submission.document.results[number]

    expect(validateSubmissionRequest(submission, benchmark).document.results[0].outcome)
      .toBe('gave-up')
  })
})
