import { Color } from '../solver';
import { COLOR_MAP, getColorInfo } from '../types';
import './ColorPalette.css';

interface ColorPaletteProps {
  selectedColor: Color | null;
  onColorSelect: (color: Color) => void;
}

export function ColorPalette({ selectedColor, onColorSelect }: ColorPaletteProps) {
  return (
    <div className="color-palette">
      <h3>Color Palette</h3>
      <div className="palette-grid">
        {COLOR_MAP.map((colorInfo) => (
          <button
            key={colorInfo.code}
            className={`color-button ${selectedColor === colorInfo.code ? 'selected' : ''}`}
            style={{ backgroundColor: colorInfo.color }}
            onClick={() => onColorSelect(colorInfo.code)}
            title={colorInfo.name}
          >
            {colorInfo.code}
          </button>
        ))}
      </div>
      {selectedColor && (
        <p>Selected: {getColorInfo(selectedColor).name}</p>
      )}
    </div>
  );
}