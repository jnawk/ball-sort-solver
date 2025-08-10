import { useState, useMemo } from 'react';
import { Color } from '../solver';
import { ColorPalette } from './ColorPalette';
import { Tube } from './Tube';
import './PuzzleBuilder.css';

export function PuzzleBuilder() {
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [tubes, setTubes] = useState<Color[][]>([[], []]);

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

  // Check if state is valid (4 of each color used)
  const isValidState = useMemo(() => {
    const usedColors = Object.keys(colorCounts) as Color[];
    return usedColors.length > 0 && usedColors.every(color => colorCounts[color] === 4);
  }, [colorCounts]);

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
  };

  return (
    <div className="puzzle-builder">
      <h2>Build Your Puzzle</h2>
      
      <ColorPalette 
        selectedColor={selectedColor} 
        onColorSelect={setSelectedColor} 
      />
      
      <div className="tubes-container">
        {tubes.map((tube, index) => (
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
            <span className="invalid">❌ Need exactly 4 of each color</span>
          )}
        </div>
        
        <button onClick={clearAll} className="clear-button">
          Clear All
        </button>
      </div>
    </div>
  );
}