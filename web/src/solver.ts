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
  fromTubeNumber: number;
  toTubeNumber: number;
}

export class State {
  tubes: Color[][];

  constructor(tubes: Color[][]) {
    this.tubes = tubes.map(tube => [...tube]);
    this.validate();
  }

  private validate(): void {
    const validColors: Set<Color> = new Set([
      "Re", "Or", "Ye", "LG", "BG", "DG", "Cy", "LB", 
      "DB", "Pu", "Ma", "Pi", "Wh", "Gr", "Bl"
    ]);
    
    for (const tube of this.tubes) {
      for (const ball of tube) {
        if (!validColors.has(ball)) {
          throw new Error(`Invalid color: ${ball}`);
        }
      }
    }
  }

  equivalentTo(other: State): boolean {
    const sortedThis = this.tubes.map(tube => tube.join("")).sort();
    const sortedOther = other.tubes.map(tube => tube.join("")).sort();
    return JSON.stringify(sortedThis) === JSON.stringify(sortedOther);
  }

  get solved(): boolean {
    // Count balls of each color
    const colorCounts: Map<Color, number> = new Map();
    for (const tube of this.tubes) {
      for (const ball of tube) {
        colorCounts.set(ball, (colorCounts.get(ball) || 0) + 1);
      }
    }

    // Check each tube is either empty or has exactly 4 balls of one color
    for (const tube of this.tubes) {
      if (tube.length === 0) continue;
      if (tube.length !== 4 || !tube.every(ball => ball === tube[0])) {
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
    for (let fromIdx = 0; fromIdx < this.tubes.length; fromIdx++) {
      const fromTube = this.tubes[fromIdx];
      if (fromTube.length === 0) continue;

      for (let toIdx = 0; toIdx < this.tubes.length; toIdx++) {
        const toTube = this.tubes[toIdx];
        if (fromIdx === toIdx || toTube.length >= 4) continue;
        
        if (toTube.length === 0 || toTube[toTube.length - 1] === fromTube[fromTube.length - 1]) {
          moves.push({ fromTubeNumber: fromIdx, toTubeNumber: toIdx });
        }
      }
    }
    return moves;
  }

  applyMove(move: Move): State {
    const newTubes = this.tubes.map(tube => [...tube]);
    const ball = newTubes[move.fromTubeNumber].pop()!;
    newTubes[move.toTubeNumber].push(ball);
    return new State(newTubes);
  }

  toList(): string[] {
    return this.tubes.map(tube => tube.join(""));
  }

  canonicalKey(): string {
    return JSON.stringify(this.tubes.map(tube => tube.join("")).sort());
  }
}

export function fromTopDown(tubes: Color[][]): State {
  return new State(tubes.map(tube => [...tube].reverse()));
}

export function toOneBased(moves: Move[]): Move[] {
  return moves.map(move => ({
    fromTubeNumber: move.fromTubeNumber + 1,
    toTubeNumber: move.toTubeNumber + 1
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

export function solve(initialState: State): SolveResult {
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

    if (processed % 10000 === 0) {
      const elapsed = (performance.now() - startTime) / 1000;
      console.log(`Processed ${processed} states, queue: ${queue.length}, visited: ${visited.size}, elapsed: ${elapsed.toFixed(1)}s`);
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