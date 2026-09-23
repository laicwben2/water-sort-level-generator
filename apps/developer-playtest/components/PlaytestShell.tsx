'use client'

import { useEffect, useMemo, useState } from 'react'
import { deterministicShuffle, getOrCreateSessionId } from '../lib/session'

interface Puzzle {
  benchmarkId: string
  capacity: number
  board: number[][]
}

interface BlindBenchmark {
  version: string
  benchmark: string
  puzzles: Puzzle[]
}

const palette = [
  '#ef5350', '#42a5f5', '#66bb6a', '#ffca28',
  '#ab47bc', '#26c6da', '#ff7043', '#8d6e63',
  '#78909c', '#ec407a', '#7e57c2', '#9ccc65',
]

export function PlaytestShell() {
  const [benchmark, setBenchmark] = useState<BlindBenchmark | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const id = getOrCreateSessionId()
    setSessionId(id)

    fetch('/benchmark.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load benchmark')
        return response.json() as Promise<BlindBenchmark>
      })
      .then(setBenchmark)
      .catch((error) => {
        console.error(error)
      })
  }, [])

  const orderedPuzzles = useMemo(() => {
    if (!benchmark || !sessionId) return []
    return deterministicShuffle(benchmark.puzzles, sessionId)
  }, [benchmark, sessionId])

  const currentPuzzle = orderedPuzzles[currentIndex]

  if (!benchmark || !sessionId) {
    return (
      <section className="card">
        <strong>載入測試資料中…</strong>
      </section>
    )
  }

  return (
    <>
      <h1>Water Sort Developer Playtest</h1>
      <p className="muted">
        這是盲測版本。頁面不會顯示原始 Easy / Medium / Hard、最佳步數或 solver 指標。
      </p>

      <section className="card">
        <div className="row">
          <strong>匿名 Session</strong>
          <code>{sessionId.slice(0, 8)}</code>
        </div>
        <p className="muted">
          題目順序會依這個匿名 session 決定；重新整理後順序保持不變。
        </p>

        {!started ? (
          <button className="primary" onClick={() => setStarted(true)}>
            開始測試
          </button>
        ) : (
          <>
            <div className="row">
              <strong>
                第 {currentIndex + 1} / {orderedPuzzles.length} 題
              </strong>
              <span>{currentPuzzle?.benchmarkId}</span>
            </div>

            <div className="order">
              {orderedPuzzles.map((puzzle, index) => (
                <div
                  key={puzzle.benchmarkId}
                  className={'pill' + (index === currentIndex ? ' current' : '')}
                >
                  {puzzle.benchmarkId}
                </div>
              ))}
            </div>

            {currentPuzzle && (
              <div className="board" aria-label={currentPuzzle.benchmarkId}>
                {currentPuzzle.board.map((tube, tubeIndex) => (
                  <div className="tube" key={tubeIndex}>
                    {Array.from({ length: currentPuzzle.capacity }, (_, slot) => {
                      const color = tube[slot]
                      return (
                        <div
                          className="cell"
                          key={slot}
                          style={{
                            background:
                              color === undefined
                                ? 'transparent'
                                : palette[color % palette.length],
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ marginTop: 18 }}>
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
              >
                上一題
              </button>
              <button
                className="primary"
                disabled={currentIndex >= orderedPuzzles.length - 1}
                onClick={() =>
                  setCurrentIndex((value) =>
                    Math.min(orderedPuzzles.length - 1, value + 1)
                  )
                }
              >
                下一題
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <strong>目前這一版的範圍</strong>
        <p className="muted">
          已完成匿名 session、固定隨機題序與 blind benchmark 載入。下一階段才會把正式倒水操作、
          計時、放棄原因與結果提交接進這個部署版頁面。
        </p>
      </section>
    </>
  )
}
