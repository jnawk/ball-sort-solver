import collections
import dataclasses
import json
import resource
import time
import typing

Color = typing.Literal[
    "Re",  # Red
    "Or",  # Orange
    "Ye",  # Yellow
    "LG",  # Light Green
    "BG",  # Bright Green
    "DG",  # Dark Green
    "Cy",  # Cyan
    "LB",  # Light Blue
    "DB",  # Dark Blue
    "Pu",  # Purple
    "Ma",  # Magenta
    "Pi",  # Pink
    "Wh",  # White
    "Gr",  # Grey
    "Bl",  # Black
]


@dataclasses.dataclass(frozen=True)
class Move:
    """A move from one tube to another."""

    from_tube_number: int
    to_tube_number: int


class State:
    """Game state with tubes containing colored balls."""

    def __init__(self, tubes: typing.Sequence[typing.Sequence[Color]]):
        self.tubes: typing.Sequence[typing.List[Color]] = [list(tube) for tube in tubes]
        self._validate()

    def _validate(self):
        valid_colors: typing.Set[Color] = set(typing.get_args(Color))
        for tube in self.tubes:
            for ball in tube:
                if ball not in valid_colors:
                    raise ValueError(f"Invalid color: {ball}")

    def equivalent_to(self, other: "State") -> bool:
        """Check if two states are equivalent (same tubes in different order)."""
        return sorted(tuple(tube) for tube in self.tubes) == sorted(
            tuple(tube) for tube in other.tubes
        )

    @property
    def solved(self) -> bool:
        """True if all balls of each color are grouped in tubes of exactly 4."""
        # Count balls of each color
        color_counts = collections.Counter()
        for tube in self.tubes:
            for ball in tube:
                color_counts[ball] += 1

        # Check each tube is either empty or has exactly 4 balls of one color
        for tube in self.tubes:
            if not tube:
                continue
            if len(tube) != 4 or not all(ball == tube[0] for ball in tube):
                return False

        # Check all colors have exactly 4 balls and are in separate tubes
        for count in color_counts.values():
            if count != 4:
                return False

        return True

    @property
    def moves(self) -> typing.Sequence[Move]:
        """All valid moves from this state."""
        moves = []
        for from_idx, from_tube in enumerate(self.tubes):
            if not from_tube:
                continue
            for to_idx, to_tube in enumerate(self.tubes):
                if from_idx == to_idx or len(to_tube) >= 4:
                    continue
                if not to_tube or to_tube[-1] == from_tube[-1]:
                    moves.append(Move(from_idx, to_idx))
        return moves

    def apply_move(self, move: Move) -> "State":
        """Apply a move and return the new state."""
        new_tubes = [tube[:] for tube in self.tubes]
        ball = new_tubes[move.from_tube_number].pop()
        new_tubes[move.to_tube_number].append(ball)
        return State(new_tubes)

    def to_list(self) -> typing.List[str]:
        """Convert state to list of strings."""
        return ["".join(tube) for tube in self.tubes]

    def canonical_key(self) -> typing.Tuple[typing.Tuple[str, ...], ...]:
        """Get canonical representation for equivalent state detection."""
        return tuple(sorted(tuple(tube) for tube in self.tubes))


def from_top_down(tubes: typing.Sequence[typing.Sequence[Color]]) -> State:
    """Create state from top-down tube representation."""
    return State([list(reversed(tube)) for tube in tubes])


def to_one_based(moves: typing.Sequence[Move]) -> typing.Sequence[Move]:
    """Convert 0-based moves to 1-based moves."""
    return [Move(move.from_tube_number + 1, move.to_tube_number + 1) for move in moves]


def solve(
    initial_state: State,
) -> typing.Tuple[State, typing.Optional[typing.Sequence[Move]]]:
    """Find sequence of moves to solve the puzzle using optimized BFS with canonical states."""
    if initial_state.solved:
        return initial_state, []

    # Memory tracking
    start_memory = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # MB on Linux
    start_time = time.time()

    queue = collections.deque([(initial_state, [])])
    visited = {initial_state.canonical_key()}
    processed = 0

    while queue:
        state, path = queue.popleft()
        processed += 1

        if processed % 10000 == 0:
            current_memory = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # MB
            elapsed = time.time() - start_time
            print(
                f"Processed {processed} states, queue: {len(queue)}, visited: {len(visited)}, "
                f"memory: {current_memory:.1f}MB, elapsed: {elapsed:.1f}s"
            )

        for move in state.moves:
            new_state = state.apply_move(move)
            canonical_key = new_state.canonical_key()

            if canonical_key in visited:
                continue
            visited.add(canonical_key)

            new_path = path + [move]

            if new_state.solved:
                final_memory = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
                total_time = time.time() - start_time
                print(f"\nSolution found!")
                print(f"Total time: {total_time:.2f}s")
                print(f"Peak memory: {final_memory:.1f}MB")
                print(f"States processed: {processed}")
                print(f"Solution length: {len(new_path)} moves")
                return new_state, new_path

            queue.append((new_state, new_path))

    return initial_state, None


def main():
    """CLI entry point."""
    print("Starting optimized single-threaded BFS solver...")

    final_state, moves = solve(
        from_top_down(
            [
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
            ]
        )
    )

    if not moves:
        print("no solutions found")
        return
    one_based_moves = to_one_based(moves)
    print(json.dumps(final_state.to_list(), indent=True))
    print([(move.from_tube_number, move.to_tube_number) for move in one_based_moves])


if __name__ == "__main__":
    main()
