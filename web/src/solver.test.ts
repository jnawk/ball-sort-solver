import { describe, it, expect } from "vitest";
import { State, fromTopDown, solve, toOneBased, Color } from "./solver";

describe("Ball Sort Solver", () => {
  it("should detect equivalent states", () => {
    const state1 = new State([
      ["DB", "Ye", "DB", "DB"],
      ["BG", "Ye", "BG", "Re"],
      ["Re", "Re", "BG", "DB"],
      ["Ye", "Ye", "BG", "Re"],
      [],
      [],
    ]);

    const state2 = new State([
      ["BG", "Ye", "BG", "Re"],
      ["Re", "Re", "BG", "DB"],
      ["Ye", "Ye", "BG", "Re"],
      ["DB", "Ye", "DB", "DB"],
      [],
      [],
    ]);

    const state3 = new State([
      ["Ye", "BG", "BG", "Re"],
      ["Re", "Re", "BG", "DB"],
      ["Ye", "Ye", "BG", "Re"],
      ["DB", "Ye", "DB", "DB"],
      [],
      [],
    ]);

    expect(state1.boxes).not.toEqual(state2.boxes);
    expect(state1.equivalentTo(state2)).toBe(true);
    expect(state1.equivalentTo(state3)).toBe(false);
  });

  it("should detect solved state", () => {
    const solvedState = new State([
      ["DB", "DB", "DB", "DB"],
      ["BG", "BG", "BG", "BG"],
      ["Re", "Re", "Re", "Re"],
      ["Ye", "Ye", "Ye", "Ye"],
      [],
      [],
    ]);

    const unsolvedState = new State([
      ["BG", "Ye", "BG", "Re"],
      ["Re", "Re", "BG", "DB"],
      ["Ye", "Ye", "BG", "Re"],
      ["DB", "Ye", "DB", "DB"],
      [],
      [],
    ]);

    expect(solvedState.solved).toBe(true);
    expect(unsolvedState.solved).toBe(false);
  });

  it("should generate valid moves", () => {
    const state = new State([
      ["BG", "Ye", "BG", "Re"],
      ["Re", "Re", "BG", "DB"],
      ["Ye", "Ye", "BG", "Re"],
      ["DB", "Ye", "DB", "DB"],
      [],
      [],
    ]);

    const moves = state.moves;
    expect(moves).toHaveLength(8);

    // Should be able to move from each filled box to each empty box
    for (let fromNumber = 0; fromNumber < 4; fromNumber++) {
      for (let toNumber = 4; toNumber < 6; toNumber++) {
        expect(moves).toContainEqual({
          fromBoxNumber: fromNumber,
          toBoxNumber: toNumber,
        });
      }
    }
  });

  it("should validate colors", () => {
    expect(() => {
      new State([
        ["BG", "Ye", "BG", "Re"],
        ["Re", "Re", "BG", "DB"],
        [("XX" as Color), "Ye", "BG", "Re"], // Invalid color "XX"
        ["DB", "Ye", "DB", "DB"],
        [],
        [],
      ]);
    }).toThrow("Invalid color: XX");
  });

  it("should solve a simple puzzle", async () => {
    const initialState = fromTopDown([
      ["Re", "DB", "BG", "DB"],
      ["Ma", "DB", "BG", "Ye"],
      ["Re", "Wh", "Ye", "Ma"],
      ["Wh", "Ma", "BG", "Ye"],
      ["Wh", "Wh", "BG", "Re"],
      ["DB", "Ma", "Re", "Ye"],
      [],
      [],
    ]);

    const result = await solve(initialState);

    expect(result.moves).not.toBeNull();
    expect(result.finalState.solved).toBe(true);
    expect(result.stats.solutionLength).toBeGreaterThan(0);
    expect(result.stats.totalTime).toBeGreaterThan(0);

    console.log(
      `Solution found in ${result.stats.totalTime.toFixed(2)}s with ${
        result.stats.solutionLength
      } moves`
    );
    console.log("Final state:", result.finalState.toList());

    if (result.moves) {
      const oneBasedMoves = toOneBased(result.moves);
      console.log(
        "Moves (1-based):",
        oneBasedMoves.map((m) => [m.fromBoxNumber, m.toBoxNumber])
      );
    }
  });

  it("should solve level 4 puzzle", async () => {
    const initialState = fromTopDown([
      ["Re", "Pu", "Pi", "Ma"],
      ["LB", "Or", "Re", "Gr"],
      ["Ye", "DB", "Pu", "Wh"],
      ["Cy", "Pi", "LG", "Ye"],
      ["BG", "Ma", "Ma", "Gr"],
      ["Pi", "DB", "Gr", "Ye"],
      ["Or", "LG", "Or", "Pu"],
      ["BG", "Re", "Cy", "BG"],
      ["Or", "LG", "Pi", "LB"],
      ["Cy", "LG", "Ma", "Wh"],
      ["Wh", "LB", "BG", "Re"],
      ["Cy", "Wh", "Ye", "Gr"],
      ["DB", "LB", "DB", "Pu"],
      [],
      [],
    ]);

    const result = await solve(initialState);

    expect(result.moves).not.toBeNull();
    expect(result.finalState.solved).toBe(true);
    expect(result.stats.solutionLength).toBeGreaterThan(0);

    console.log(
      `Level 4 puzzle solved in ${result.stats.totalTime.toFixed(2)}s with ${
        result.stats.solutionLength
      } moves`
    );
    console.log(JSON.stringify(result.finalState.toList(), null, 2));
  });

  it("should solve level 5 puzzle", async () => {
    const initialState = fromTopDown([
      ["Or", "BG", "Re", "Cy"],
      ["DB", "BG", "LG", "Or"],
      ["Ye", "Ma", "Ye", "Ma"],
      ["Wh", "BG", "LG", "Cy"],
      ["Wh", "Cy", "Or", "Pi"],
      ["DB", "LB", "Gr", "Pu"],
      ["Or", "Gr", "LG", "Wh"],
      ["Re", "Pu", "LB", "BG"],
      ["Ye", "Ma", "Pu", "LB"],
      ["Ye", "LB", "DB", "Pu"],
      ["Cy", "Re", "Gr", "Pi"],
      ["LG", "Ma", "DB", "Pi"],
      ["Wh", "Gr", "Re", "Pi"],
      [],
      [],
    ]);

    const result = await solve(initialState);

    expect(result.moves).not.toBeNull();
    expect(result.finalState.solved).toBe(true);
    expect(result.stats.solutionLength).toBeGreaterThan(0);

    console.log(
      `Level 5 puzzle solved in ${result.stats.totalTime.toFixed(2)}s with ${
        result.stats.solutionLength
      } moves`
    );
    console.log(JSON.stringify(result.finalState.toList(), null, 2));
  });
});
