import { useState, useMemo, useEffect, useRef } from 'react';
import { Color, fromTopDown, solve, toOneBased, SolveResult } from '../solver';
import { ColorPalette } from './ColorPalette';
import { Box } from './Box';
import { COLOR_MAP, getColorInfo } from '../types';
import './PuzzleBuilder.css';

export function PuzzleBuilder() {
  const [selectedColor, setSelectedColor] = useState<Color | null>('Re');
  const [boxes, setBoxes] = useState<Color[][]>([[], [], [], []]);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [animationBoxes, setAnimationBoxes] = useState<Color[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [movesPerSecond, setMovesPerSecond] = useState(2); // moves per second
  const [solveProgress, setSolveProgress] = useState({ processed: 0, queued: 0 });
  const animationTimer = useRef<number | null>(null);
  const [puzzleJson, setPuzzleJson] = useState('[[],[],[],[]]');
  const [boxCount, setBoxCount] = useState(4);
  const [showJson, setShowJson] = useState(false);

  // Count colors to validate state
  const colorCounts = useMemo(() => {
    const counts: Record<Color, number> = {} as Record<Color, number>;
    boxes.forEach(box => {
      box.forEach(ball => {
        counts[ball] = (counts[ball] || 0) + 1;
      });
    });
    return counts;
  }, [boxes]);

  // Check if state is valid (4 of each color used, boxes either full or empty)
  const isValidState = useMemo(() => {
    const usedColors = Object.keys(colorCounts) as Color[];
    const hasValidColors = usedColors.length > 0 && usedColors.every(color => colorCounts[color] === 4);
    const hasValidBoxes = boxes.every(box => box.length === 0 || box.length === 4);
    return hasValidColors && hasValidBoxes;
  }, [colorCounts, boxes]);

  // Auto-select first available color when current selection becomes unavailable
  useEffect(() => {
    if (selectedColor && (colorCounts[selectedColor] || 0) >= 4) {
      const firstAvailable = COLOR_MAP.find(colorInfo => (colorCounts[colorInfo.code] || 0) < 4);
      setSelectedColor(firstAvailable?.code || null);
    }
  }, [colorCounts, selectedColor]);

  const handleBoxClick = (boxIndex: number) => {
    if (!selectedColor) return;

    // Don't allow adding more than 4 of any color
    if ((colorCounts[selectedColor] || 0) >= 4) return;

    setBoxes(prev => {
      const newBoxes = [...prev];

      // Add ball to box if there's space
      if (newBoxes[boxIndex].length < 4) {
        newBoxes[boxIndex] = [...newBoxes[boxIndex], selectedColor];
      }

      // Ensure we always have at least 2 empty boxes
      const emptyBoxes = newBoxes.filter(box => box.length === 0).length;
      if (emptyBoxes < 2) {
        newBoxes.push([]);
      }

      // Update JSON representation
      setPuzzleJson(JSON.stringify(newBoxes));

      return newBoxes;
    });
  };

  const clearAll = () => {
    const emptyBoxes = Array(boxCount).fill([]);
    setBoxes(emptyBoxes);
    setPuzzleJson(JSON.stringify(emptyBoxes));
    setSelectedColor('Re');
    setSolveResult(null);
    setAnimationBoxes([]);
    setIsPlaying(false);
    setCurrentMoveIndex(0);
    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }
  };

  const handleBoxCountChange = (newCount: number) => {
    setBoxCount(newCount);
    setBoxes(prev => {
      let newBoxes = [...prev];

      if (newCount > prev.length) {
        // Add empty boxes
        while (newBoxes.length < newCount) {
          newBoxes.push([]);
        }
      } else if (newCount < prev.length) {
        // Remove boxes from end, ensuring 2 empty remain
        newBoxes = newBoxes.slice(0, newCount);
        const emptyCount = newBoxes.filter(box => box.length === 0).length;
        if (emptyCount < 2) {
          // Clear boxes from end until we have 2 empty
          for (let i = newBoxes.length - 1; i >= 0 && emptyCount < 2; i--) {
            if (newBoxes[i].length > 0) {
              newBoxes[i] = [];
            }
          }
        }
      }

      setPuzzleJson(JSON.stringify(newBoxes));
      return newBoxes;
    });
  };

  const loadFromJson = () => {
    try {
      const parsed = JSON.parse(puzzleJson);
      if (Array.isArray(parsed) && parsed.every(box => Array.isArray(box))) {
        setBoxes(parsed);
        setBoxCount(parsed.length);
        setSolveResult(null);
        setAnimationBoxes([]);
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
      // Convert boxes to bottom-up format for solver
      console.log('UI boxes (top-down):', boxes);
      const initialState = fromTopDown(boxes);
      console.log('Solver state (bottom-up):', initialState.toList());

      // Use setTimeout to allow UI to update before starting solve
      setTimeout(async () => {
        const result = await solve(initialState, (processed, queued) => {
          setSolveProgress({ processed, queued });
        });
        setSolveResult(result);
        // Initialize animation with original state
        setAnimationBoxes([...boxes]);
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
    setAnimationBoxes([...boxes]);

    const playNextMove = (moveIndex: number, currentBoxes: Color[][]) => {
      if (moveIndex >= solveResult.moves!.length) {
        setIsPlaying(false);
        return;
      }

      const move = solveResult.moves![moveIndex];
      const newBoxes = [...currentBoxes];

      // Apply the move
      // UI boxes are top-down, solver moves are for bottom-up
      // So we need to remove from the end (bottom) and add to end (bottom) of UI boxes
      const ball = newBoxes[move.fromBoxNumber].pop()!;
      newBoxes[move.toBoxNumber].push(ball);

      setAnimationBoxes([...newBoxes]);
      setCurrentMoveIndex(moveIndex + 1);

      animationTimer.current = setTimeout(() => {
        playNextMove(moveIndex + 1, newBoxes);
      }, 1000 / movesPerSecond);
    };

    playNextMove(0, [...boxes]);
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
      if (Array.isArray(parsed) && parsed.every(box => Array.isArray(box))) {
        setBoxes(parsed);
        setAnimationBoxes([]);
        setCurrentMoveIndex(0);
      }
    } catch (e) {
      // Fallback if JSON is invalid
      setAnimationBoxes([]);
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
            <div className="boxes-container" data-box-count={boxes.length}>
        {(() => {
          const displayBoxes = animationBoxes.length > 0 ? animationBoxes : boxes;

          if (boxes.length <= 5) {
            // Single row for 1-5 boxes
            return (
              <div className="box-row">
                {displayBoxes.map((box, index) => (
                  <Box
                    key={index}
                    balls={box}
                    onCellClick={() => handleBoxClick(index)}
                    boxIndex={index}
                  />
                ))}
              </div>
            );
          } else if (boxes.length <= 16) {
            // Two rows for 6-16 boxes
            const firstRowCount = Math.ceil(boxes.length / 2);
            return (
              <>
                <div className="box-row">
                  {displayBoxes.slice(0, firstRowCount).map((box, index) => (
                    <Box
                      key={index}
                      balls={box}
                      onCellClick={() => handleBoxClick(index)}
                      boxIndex={index}
                    />
                  ))}
                </div>
                <div className="box-row">
                  {displayBoxes.slice(firstRowCount).map((box, index) => (
                    <Box
                      key={index + firstRowCount}
                      balls={box}
                      onCellClick={() => handleBoxClick(index + firstRowCount)}
                      boxIndex={index + firstRowCount}
                    />
                  ))}
                </div>
              </>
            );
          } else {
            // Three rows for 17+ boxes
            const boxesPerRow = Math.ceil(boxes.length / 3);
            const firstRowCount = boxesPerRow;
            const secondRowCount = boxesPerRow;
            // const thirdRowCount = boxes.length - firstRowCount - secondRowCount;

            return (
              <>
                <div className="box-row">
                  {displayBoxes.slice(0, firstRowCount).map((box, index) => (
                    <Box
                      key={index}
                      balls={box}
                      onCellClick={() => handleBoxClick(index)}
                      boxIndex={index}
                    />
                  ))}
                </div>
                <div className="box-row">
                  {displayBoxes.slice(firstRowCount, firstRowCount + secondRowCount).map((box, index) => (
                    <Box
                      key={index + firstRowCount}
                      balls={box}
                      onCellClick={() => handleBoxClick(index + firstRowCount)}
                      boxIndex={index + firstRowCount}
                    />
                  ))}
                </div>
                <div className="box-row">
                  {displayBoxes.slice(firstRowCount + secondRowCount).map((box, index) => (
                    <Box
                      key={index + firstRowCount + secondRowCount}
                      balls={box}
                      onCellClick={() => handleBoxClick(index + firstRowCount + secondRowCount)}
                      boxIndex={index + firstRowCount + secondRowCount}
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

        <div className="box-count-control">
          <label>Number of boxes: {boxCount}</label>
          <input
            type="range"
            min="4"
            max="20"
            value={boxCount}
            onChange={(e) => handleBoxCountChange(parseInt(e.target.value))}
            className="box-count-slider"
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
                      {move.fromBoxNumber} → {move.toBoxNumber}
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
