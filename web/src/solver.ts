// Color type definition
export type Color =
  | "Re" // Red
  | "Or" // Orange
  | "Ye" // Yellow
  | "LG" // Light Green
  | "BG" // Bright Green
  | "DG" // Dark Green
  | "Cy" // Cyan
  | "LB" // Light Blue
  | "DB" // Dark Blue
  | "Pu" // Purple
  | "Ma" // Magenta
  | "Pi" // Pink
  | "Wh" // White
  | "Gr" // Grey
  | "Bl"; // Black

export interface Move {
  fromBoxNumber: number;
  toBoxNumber: number;
}

export class State {
  boxes: Color[][];

  constructor(boxes: Color[][]) {
    this.boxes = boxes.map(box => [...box]);
    this.validate();
  }

  private validate(): void {
    const validColors: Set<Color> = new Set([
      "Re", "Or", "Ye", "LG", "BG", "DG", "Cy", "LB",
      "DB", "Pu", "Ma", "Pi", "Wh", "Gr", "Bl"
    ]);

    for (const box of this.boxes) {
      for (const ball of box) {
        if (!validColors.has(ball)) {
          throw new Error(`Invalid color: ${ball}`);
        }
      }
    }
  }

  equivalentTo(other: State): boolean {
    const sortedThis = this.boxes.map(box => box.join("")).sort();
    const sortedOther = other.boxes.map(box => box.join("")).sort();
    return JSON.stringify(sortedThis) === JSON.stringify(sortedOther);
  }

  get solved(): boolean {
    // Count balls of each color
    const colorCounts: Map<Color, number> = new Map();
    for (const box of this.boxes) {
      for (const ball of box) {
        colorCounts.set(ball, (colorCounts.get(ball) || 0) + 1);
      }
    }

    // Check each box is either empty or has exactly 4 balls of one color
    for (const box of this.boxes) {
      if (box.length === 0) continue;
      if (box.length !== 4 || !box.every(ball => ball === box[0])) {
        return false;
      }
    }

    // Check all colors have exactly 4 balls
    for (const count of colorCounts.values()) {
      if (count !== 4) {
        return false;
      }
    }

    return true;
  }

  get moves(): Move[] {
    const moves: Move[] = [];
    for (let fromIdx = 0; fromIdx < this.boxes.length; fromIdx++) {
      const fromBox = this.boxes[fromIdx];
      if (fromBox.length === 0) continue;

      for (let toIdx = 0; toIdx < this.boxes.length; toIdx++) {
        const toBox = this.boxes[toIdx];
        if (fromIdx === toIdx || toBox.length >= 4) continue;

        if (toBox.length === 0 || toBox[toBox.length - 1] === fromBox[fromBox.length - 1]) {
          moves.push({ fromBoxNumber: fromIdx, toBoxNumber: toIdx });
        }
      }
    }
    return moves;
  }

  applyMove(move: Move): State {
    const newBoxes = this.boxes.map(box => [...box]);
    const ball = newBoxes[move.fromBoxNumber].pop()!;
    newBoxes[move.toBoxNumber].push(ball);
    return new State(newBoxes);
  }

  toList(): string[] {
    return this.boxes.map(box => box.join(""));
  }

  canonicalKey(): string {
    return JSON.stringify(this.boxes.map(box => box.join("")).sort());
  }
}

export function fromTopDown(boxes: Color[][]): State {
  return new State(boxes.map(box => [...box]));
}

export function toOneBased(moves: Move[]): Move[] {
  return moves.map(move => ({
    fromBoxNumber: move.fromBoxNumber + 1,
    toBoxNumber: move.toBoxNumber + 1
  }));
}

export interface SolveResult {
  finalState: State;
  moves: Move[] | null;
  stats: {
    totalTime: number;
    statesProcessed: number;
    solutionLength: number;
  };
}

export async function solve(initialState: State, progressCallback?: (processed: number, queued: number) => void): Promise<SolveResult> {
  const startTime = performance.now();

  if (initialState.solved) {
    return {
      finalState: initialState,
      moves: [],
      stats: {
        totalTime: 0,
        statesProcessed: 0,
        solutionLength: 0
      }
    };
  }

  const queue: Array<[State, Move[]]> = [[initialState, []]];
  const visited = new Set<string>([initialState.canonicalKey()]);
  let processed = 0;

  while (queue.length > 0) {
    const [state, path] = queue.shift()!;
    processed++;

    if (processed % 1000 === 0) {
      const elapsed = (performance.now() - startTime) / 1000;
      if (processed % 10000 === 0) {
        console.log(`Processed ${processed} states, queue: ${queue.length}, visited: ${visited.size}, elapsed: ${elapsed.toFixed(1)}s`);
      }
      if (progressCallback) {
        progressCallback(processed, queue.length);
      }
      // Yield control every 1000 states to allow UI updates
      if (processed % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    for (const move of state.moves) {
      const newState = state.applyMove(move);
      const canonicalKey = newState.canonicalKey();

      if (visited.has(canonicalKey)) {
        continue;
      }
      visited.add(canonicalKey);

      const newPath = [...path, move];

      if (newState.solved) {
        const totalTime = (performance.now() - startTime) / 1000;
        console.log(`\nSolution found!`);
        console.log(`Total time: ${totalTime.toFixed(2)}s`);
        console.log(`States processed: ${processed}`);
        console.log(`Solution length: ${newPath.length} moves`);

        return {
          finalState: newState,
          moves: newPath,
          stats: {
            totalTime,
            statesProcessed: processed,
            solutionLength: newPath.length
          }
        };
      }

      queue.push([newState, newPath]);
    }
  }

  return {
    finalState: initialState,
    moves: null,
    stats: {
      totalTime: (performance.now() - startTime) / 1000,
      statesProcessed: processed,
      solutionLength: 0
    }
  };
}
