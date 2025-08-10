import { Color } from '../solver';
import { getColorInfo } from '../types';
import './Tube.css';

interface TubeProps {
  balls: Color[];
  onCellClick: () => void;
  tubeIndex: number;
}

export function Tube({ balls, onCellClick, tubeIndex }: TubeProps) {
  // Create 4 cells, filled from bottom up
  const cells = [];
  for (let i = 3; i >= 0; i--) {
    const ball = balls[i];
    cells.push(
      <div
        key={i}
        className="tube-cell"
        onClick={onCellClick}
        style={{
          backgroundColor: ball ? getColorInfo(ball).color : 'transparent',
          border: ball ? '2px solid #333' : '2px dashed #ccc'
        }}
      >
        {ball || ''}
      </div>
    );
  }

  return (
    <div className="tube">
      <div className="tube-label">Tube {tubeIndex + 1}</div>
      <div className="tube-cells">
        {cells}
      </div>
    </div>
  );
}