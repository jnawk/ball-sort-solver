import { useState, useMemo, useEffect, useRef } from 'react';
import { Color, State, fromTopDown, solve, toOneBased, SolveResult } from '../solver';
import { ColorPalette } from './ColorPalette';
import { Tube } from './Tube';
import { COLOR_MAP, getColorInfo } from '../types';
import './PuzzleBuilder.css';

export function PuzzleBuilder() {
  const [selectedColor, setSelectedColor] = useState<Color | null>('Re');
  const [tubes, setTubes] = useState<Color[][]>([[], [], [], []]);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [animationTubes, setAnimationTubes] = useState<Color[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [movesPerSecond, setMovesPerSecond] = useState(2); // moves per second
  const [solveProgress, setSolveProgress] = useState({ processed: 0, queued: 0 });
  const animationTimer = useRef<NodeJS.Timeout | null>(null);
  const [puzzleJson, setPuzzleJson] = useState('[[],[],[],[]]');
  const [tubeCount, setTubeCount] = useState(4);
  const [showJson, setShowJson] = useState(false);

  // Count colors to validate state
  const colorCounts = useMemo(() => {
    const counts: Record<Color, number> = {} as Record<Color, number>;
    tubes.forEach(tube => {
      tube.forEach(ball => {
        counts[ball] = (counts[ball] || 0) + 1;
      });
    });
    return counts;
  }, [tubes]);

  // Check if state is valid (4 of each color used, tubes either full or empty)
  const isValidState = useMemo(() => {
    const usedColors = Object.keys(colorCounts) as Color[];
    const hasValidColors = usedColors.length > 0 && usedColors.every(color => colorCounts[color] === 4);
    const hasValidTubes = tubes.every(tube => tube.length === 0 || tube.length === 4);
    return hasValidColors && hasValidTubes;
  }, [colorCounts, tubes]);

  // Auto-select first available color when current selection becomes unavailable
  useEffect(() => {
    if (selectedColor && (colorCounts[selectedColor] || 0) >= 4) {
      const firstAvailable = COLOR_MAP.find(colorInfo => (colorCounts[colorInfo.code] || 0) < 4);
      setSelectedColor(firstAvailable?.code || null);
    }
  }, [colorCounts, selectedColor]);

  const handleTubeClick = (tubeIndex: number) => {
    if (!selectedColor) return;

    // Don't allow adding more than 4 of any color
    if ((colorCounts[selectedColor] || 0) >= 4) return;

    setTubes(prev => {
      const newTubes = [...prev];

      // Add ball to tube if there's space
      if (newTubes[tubeIndex].length < 4) {
        newTubes[tubeIndex] = [...newTubes[tubeIndex], selectedColor];
      }

      // Ensure we always have at least 2 empty tubes
      const emptyTubes = newTubes.filter(tube => tube.length === 0).length;
      if (emptyTubes < 2) {
        newTubes.push([]);
      }

      // Update JSON representation
      setPuzzleJson(JSON.stringify(newTubes));

      return newTubes;
    });
  };

  const clearAll = () => {
    const emptyTubes = Array(tubeCount).fill([]);
    setTubes(emptyTubes);
    setPuzzleJson(JSON.stringify(emptyTubes));
    setSelectedColor('Re');
    setSolveResult(null);
    setAnimationTubes([]);
    setIsPlaying(false);
    setCurrentMoveIndex(0);
    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }
  };

  const handleTubeCountChange = (newCount: number) => {
    setTubeCount(newCount);
    setTubes(prev => {
      let newTubes = [...prev];

      if (newCount > prev.length) {
        // Add empty tubes
        while (newTubes.length < newCount) {
          newTubes.push([]);
        }
      } else if (newCount < prev.length) {
        // Remove tubes from end, ensuring 2 empty remain
        newTubes = newTubes.slice(0, newCount);
        const emptyCount = newTubes.filter(tube => tube.length === 0).length;
        if (emptyCount < 2) {
          // Clear tubes from end until we have 2 empty
          for (let i = newTubes.length - 1; i >= 0 && emptyCount < 2; i--) {
            if (newTubes[i].length > 0) {
              newTubes[i] = [];
            }
          }
        }
      }

      setPuzzleJson(JSON.stringify(newTubes));
      return newTubes;
    });
  };

  const loadFromJson = () => {
    try {
      const parsed = JSON.parse(puzzleJson);
      if (Array.isArray(parsed) && parsed.every(tube => Array.isArray(tube))) {
        setTubes(parsed);
        setTubeCount(parsed.length);
        setSolveResult(null);
        setAnimationTubes([]);
        setIsPlaying(false);
        setCurrentMoveIndex(0);
        if (animationTimer.current) {
          clearTimeout(animationTimer.current);
        }
      }
    } catch (e) {
      alert('Invalid JSON format');
    }
  };

  const handleSolve = async () => {
    if (!isValidState) return;

    setIsLoading(true);
    setSolveResult(null);

    try {
      // Convert tubes to bottom-up format for solver
      console.log('UI tubes (top-down):', tubes);
      const initialState = fromTopDown(tubes);
      console.log('Solver state (bottom-up):', initialState.toList());

      // Use setTimeout to allow UI to update before starting solve
      setTimeout(async () => {
        const result = await solve(initialState, (processed, queued) => {
          setSolveProgress({ processed, queued });
        });
        setSolveResult(result);
        // Initialize animation with original state
        setAnimationTubes([...tubes]);
        setCurrentMoveIndex(0);
        setIsLoading(false);
        setSolveProgress({ processed: 0, queued: 0 });
      }, 10);
    } catch (error) {
      console.error('Solver error:', error);
      setIsLoading(false);
    }
  };

  const playAnimation = () => {
    if (!solveResult?.moves) return;

    setIsPlaying(true);
    setCurrentMoveIndex(0);
    setAnimationTubes([...tubes]);

    const playNextMove = (moveIndex: number, currentTubes: Color[][]) => {
      if (moveIndex >= solveResult.moves!.length) {
        setIsPlaying(false);
        return;
      }

      const move = solveResult.moves![moveIndex];
      const newTubes = [...currentTubes];

      // Apply the move
      // UI tubes are top-down, solver moves are for bottom-up
      // So we need to remove from the end (bottom) and add to end (bottom) of UI tubes
      const ball = newTubes[move.fromTubeNumber].pop()!;
      newTubes[move.toTubeNumber].push(ball);

      setAnimationTubes([...newTubes]);
      setCurrentMoveIndex(moveIndex + 1);

      animationTimer.current = setTimeout(() => {
        playNextMove(moveIndex + 1, newTubes);
      }, 1000 / movesPerSecond);
    };

    playNextMove(0, [...tubes]);
  };

  const stopAnimation = () => {
    setIsPlaying(false);
    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }
  };

  const resetAnimation = () => {
    stopAnimation();
    // Load from JSON to reset to original puzzle state
    try {
      const parsed = JSON.parse(puzzleJson);
      if (Array.isArray(parsed) && parsed.every(tube => Array.isArray(tube))) {
        setTubes(parsed);
        setAnimationTubes([]);
        setCurrentMoveIndex(0);
      }
    } catch (e) {
      // Fallback if JSON is invalid
      setAnimationTubes([]);
      setCurrentMoveIndex(0);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
      }
    };
  }, []);

  return (
    <div className="puzzle-builder">
      <div className="main-layout">
        <div className="puzzle-area">
          <div className="puzzle-content">
            <div className="tubes-container" data-tube-count={tubes.length}>
        {(() => {
          const displayTubes = animationTubes.length > 0 ? animationTubes : tubes;

          if (tubes.length <= 5) {
            // Single row for 1-5 tubes
            return (
              <div className="tube-row">
                {displayTubes.map((tube, index) => (
                  <Tube
                    key={index}
                    balls={tube}
                    onCellClick={() => handleTubeClick(index)}
                    tubeIndex={index}
                  />
                ))}
              </div>
            );
          } else if (tubes.length <= 16) {
            // Two rows for 6-16 tubes
            const firstRowCount = Math.ceil(tubes.length / 2);
            return (
              <>
                <div className="tube-row">
                  {displayTubes.slice(0, firstRowCount).map((tube, index) => (
                    <Tube
                      key={index}
                      balls={tube}
                      onCellClick={() => handleTubeClick(index)}
                      tubeIndex={index}
                    />
                  ))}
                </div>
                <div className="tube-row">
                  {displayTubes.slice(firstRowCount).map((tube, index) => (
                    <Tube
                      key={index + firstRowCount}
                      balls={tube}
                      onCellClick={() => handleTubeClick(index + firstRowCount)}
                      tubeIndex={index + firstRowCount}
                    />
                  ))}
                </div>
              </>
            );
          } else {
            // Three rows for 17+ tubes
            const tubesPerRow = Math.ceil(tubes.length / 3);
            const firstRowCount = tubesPerRow;
            const secondRowCount = tubesPerRow;
            const thirdRowCount = tubes.length - firstRowCount - secondRowCount;

            return (
              <>
                <div className="tube-row">
                  {displayTubes.slice(0, firstRowCount).map((tube, index) => (
                    <Tube
                      key={index}
                      balls={tube}
                      onCellClick={() => handleTubeClick(index)}
                      tubeIndex={index}
                    />
                  ))}
                </div>
                <div className="tube-row">
                  {displayTubes.slice(firstRowCount, firstRowCount + secondRowCount).map((tube, index) => (
                    <Tube
                      key={index + firstRowCount}
                      balls={tube}
                      onCellClick={() => handleTubeClick(index + firstRowCount)}
                      tubeIndex={index + firstRowCount}
                    />
                  ))}
                </div>
                <div className="tube-row">
                  {displayTubes.slice(firstRowCount + secondRowCount).map((tube, index) => (
                    <Tube
                      key={index + firstRowCount + secondRowCount}
                      balls={tube}
                      onCellClick={() => handleTubeClick(index + firstRowCount + secondRowCount)}
                      tubeIndex={index + firstRowCount + secondRowCount}
                    />
                  ))}
                </div>
              </>
            );
          }
        })()}
            </div>
          </div>

          <div className="puzzle-bottom">
            <div className="puzzle-status">
              <div className="color-counts-compact">
                {Object.entries(colorCounts).length > 0 ? (
                  Object.entries(colorCounts).map(([color, count]) => (
                    <div
                      key={color}
                      className={`color-square ${count === 4 ? 'valid' : 'invalid'}`}
                      style={{ backgroundColor: getColorInfo(color as Color).color }}
                    >
                      {count}
                    </div>
                  ))
                ) : (
                  <div className="color-square placeholder">&nbsp;</div>
                )}
              </div>

              <div className="validation-compact">
                {isValidState ? (
                  <span className="valid">✅ Valid</span>
                ) : (
                  <span className="invalid">❌ Invalid</span>
                )}
              </div>
            </div>

            <ColorPalette
              selectedColor={selectedColor}
              onColorSelect={setSelectedColor}
              colorCounts={colorCounts}
            />
          </div>
        </div>

        <div className="controls-area">
          <div className="status">

        <div className="tube-count-control">
          <label>Number of tubes: {tubeCount}</label>
          <input
            type="range"
            min="4"
            max="20"
            value={tubeCount}
            onChange={(e) => handleTubeCountChange(parseInt(e.target.value))}
            className="tube-count-slider"
          />
        </div>

        <div className="buttons">
          <div className="main-buttons">
            <button onClick={clearAll} className="clear-button">
              Clear All
            </button>

            <button
              onClick={handleSolve}
              disabled={!isValidState || isLoading}
              className={`solve-button ${isLoading ? 'solving' : ''}`}
            >
              {isLoading ? '🔄 Solving...' : 'Solve Puzzle'}
            </button>
          </div>
          <div className="solve-progress">
            <small>Processed: {solveProgress.processed.toLocaleString()} | Queue: {solveProgress.queued.toLocaleString()}</small>
          </div>

          <div className="animation-controls">
            <div className="play-controls">
              <button
                onClick={playAnimation}
                disabled={isPlaying || !solveResult?.moves}
                className="play-button"
              >
                ▶️ Play
              </button>

              <button
                onClick={stopAnimation}
                disabled={!isPlaying || !solveResult?.moves}
                className="stop-button"
              >
                ⏹️ Stop
              </button>

              <button
                onClick={resetAnimation}
                disabled={!solveResult?.moves}
                className="reset-button"
              >
                🔄 Reset
              </button>
            </div>
          </div>


          <div className="speed-control">
            <label>Animation Speed: {movesPerSecond} moves/sec</label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={movesPerSecond}
              onChange={(e) => setMovesPerSecond(parseInt(e.target.value))}
              className="speed-slider"
            />
          </div>
        </div>

        {solveResult && (
          <div className="solve-result">
            {solveResult.moves && (
              <div className="moves">
                <h4>Moves:</h4>
                <div className="moves-list">
                  {toOneBased(solveResult.moves).map((move, index) => (
                    <span
                      key={index}
                      className={`move ${index < currentMoveIndex ? 'completed' : ''} ${index === currentMoveIndex ? 'current' : ''}`}
                    >
                      {move.fromTubeNumber} → {move.toTubeNumber}
                    </span>
                  ))}
                </div>

                <div className="progress">
                  Move {currentMoveIndex} of {solveResult.moves.length}
                </div>
              </div>
            )}

            <div className="solution-stats">
              <h3>Solution Found!</h3>
              <p>Time: {solveResult.stats.totalTime.toFixed(2)}s</p>
              <p>States processed: {solveResult.stats.statesProcessed.toLocaleString()}</p>
              <p>Solution length: {solveResult.stats.solutionLength} moves</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowJson(!showJson)}
          className="json-toggle"
        >
          {showJson ? '▼' : '▶'} JSON
        </button>

        {showJson && (
          <div className="puzzle-json">
            <textarea
              value={puzzleJson}
              onChange={(e) => setPuzzleJson(e.target.value)}
              rows={4}
              cols={50}
              className="json-textarea"
            />
            <button onClick={loadFromJson} className="load-button">
              Load from JSON
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
