import { Color } from '../solver';
import { getColorInfo } from '../types';
import './Box.css';

interface BoxProps {
  balls: Color[];
  onCellClick: () => void;
  boxIndex: number;
}

export function Box({ balls, onCellClick, boxIndex }: BoxProps) {
  // Create 4 cells, filled from bottom up
  const cells = [];
  for (let i = 3; i >= 0; i--) {
    const ball = balls[i];
    cells.push(
      <div
        key={i}
        className="box-cell"
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
    <div className="box">
      <div className="box-label">Box {boxIndex + 1}</div>
      <div className="box-cells">
        {cells}
      </div>
    </div>
  );
}