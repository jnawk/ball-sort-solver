import { Color } from '../solver';
import { COLOR_MAP, getColorInfo } from '../types';
import './ColorPalette.css';

interface ColorPaletteProps {
  selectedColor: Color | null;
  onColorSelect: (color: Color) => void;
  colorCounts: Record<Color, number>;
}

export function ColorPalette({ selectedColor, onColorSelect, colorCounts }: ColorPaletteProps) {
  return (
    <div className="color-palette">
      <div className="palette-grid">
        {COLOR_MAP.map((colorInfo) => {
          const count = colorCounts[colorInfo.code] || 0;
          const isComplete = count >= 4;
          
          if (isComplete) return null;
          
          return (
            <button
              key={colorInfo.code}
              className={`color-button ${selectedColor === colorInfo.code ? 'selected' : ''}`}
              style={{ backgroundColor: colorInfo.color }}
              onClick={() => onColorSelect(colorInfo.code)}
              title={colorInfo.name}
            >
              {colorInfo.code}
            </button>
          );
        })}
      </div>
      {selectedColor && (
        <p>Selected: {getColorInfo(selectedColor).name}</p>
      )}
    </div>
  );
}
