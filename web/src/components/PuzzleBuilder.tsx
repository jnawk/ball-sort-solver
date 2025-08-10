import { useState, useMemo, useEffect, useRef } from 'react';
import { Color, State, fromTopDown, solve, toOneBased, SolveResult } from '../solver';
import { ColorPalette } from './ColorPalette';
import { Tube } from './Tube';
import './PuzzleBuilder.css';

export function PuzzleBuilder() {
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [tubes, setTubes] = useState<Color[][]>([[], []]);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [animationTubes, setAnimationTubes] = useState<Color[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(0.5); // seconds between moves
  const animationTimer = useRef<NodeJS.Timeout | null>(null);

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

  const handleTubeClick = (tubeIndex: number) => {
    if (!selectedColor) return;

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

      return newTubes;
    });
  };

  const clearAll = () => {
    setTubes([[], []]);
    setSolveResult(null);
    setAnimationTubes([]);
    setIsPlaying(false);
    setCurrentMoveIndex(0);
    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }
  };

  const handleSolve = async () => {
    if (!isValidState) return;

    setIsLoading(true);
    setSolveResult(null);

    try {
      // Convert tubes to bottom-up format for solver
      const initialState = fromTopDown(tubes);
      const result = solve(initialState);
      setSolveResult(result);
      // Initialize animation with original state
      setAnimationTubes([...tubes]);
      setCurrentMoveIndex(0);
    } catch (error) {
      console.error('Solver error:', error);
    } finally {
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
      const ball = newTubes[move.fromTubeNumber].pop()!;
      newTubes[move.toTubeNumber].push(ball);
      
      setAnimationTubes([...newTubes]);
      setCurrentMoveIndex(moveIndex + 1);
      
      animationTimer.current = setTimeout(() => {
        playNextMove(moveIndex + 1, newTubes);
      }, animationSpeed * 1000);
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
    setAnimationTubes([...tubes]);
    setCurrentMoveIndex(0);
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
      <h2>Build Your Puzzle</h2>

      <ColorPalette
        selectedColor={selectedColor}
        onColorSelect={setSelectedColor}
      />

      <div className="tubes-container" data-tube-count={tubes.length}>
        {(animationTubes.length > 0 ? animationTubes : tubes).map((tube, index) => (
          <Tube
            key={index}
            balls={tube}
            onCellClick={() => handleTubeClick(index)}
            tubeIndex={index}
          />
        ))}
      </div>

      <div className="status">
        <h3>Color Counts:</h3>
        {Object.entries(colorCounts).map(([color, count]) => (
          <span key={color} className={`color-count ${count === 4 ? 'valid' : 'invalid'}`}>
            {color}: {count}/4
          </span>
        ))}

        <div className="validation">
          {isValidState ? (
            <span className="valid">✅ Valid puzzle state!</span>
          ) : (
            <span className="invalid">❌ Need exactly 4 of each color & tubes must be full or empty</span>
          )}
        </div>

        <div className="buttons">
          <button onClick={clearAll} className="clear-button">
            Clear All
          </button>

          <button
            onClick={handleSolve}
            disabled={!isValidState || isLoading}
            className="solve-button"
          >
            {isLoading ? 'Solving...' : 'Solve Puzzle'}
          </button>
        </div>

        {solveResult && (
          <div className="solve-result">
            <h3>Solution Found!</h3>
            <p>Time: {solveResult.stats.totalTime.toFixed(2)}s</p>
            <p>States processed: {solveResult.stats.statesProcessed.toLocaleString()}</p>
            <p>Solution length: {solveResult.stats.solutionLength} moves</p>

            {solveResult.moves && (
              <div className="moves">
                <h4>Moves (1-based):</h4>
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
                
                <div className="animation-controls">
                  <div className="speed-control">
                    <label>Animation Speed: {animationSpeed.toFixed(1)}s</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={animationSpeed}
                      onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                      className="speed-slider"
                    />
                  </div>
                  
                  <div className="play-controls">
                    <button 
                      onClick={playAnimation} 
                      disabled={isPlaying}
                      className="play-button"
                    >
                      ▶️ Play
                    </button>
                    
                    <button 
                      onClick={stopAnimation} 
                      disabled={!isPlaying}
                      className="stop-button"
                    >
                      ⏹️ Stop
                    </button>
                    
                    <button 
                      onClick={resetAnimation}
                      className="reset-button"
                    >
                      🔄 Reset
                    </button>
                  </div>
                  
                  <div className="progress">
                    Move {currentMoveIndex} of {solveResult.moves.length}
                  </div>
                </div>
              </div>
            )}

            <div className="final-state">
              <h4>Final State:</h4>
              <pre>{JSON.stringify(solveResult.finalState.toList(), null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
