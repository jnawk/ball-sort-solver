import collections
import dataclasses
import json
import multiprocessing
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


def from_top_down(tubes: typing.Sequence[typing.Sequence[Color]]) -> State:
    """Create state from top-down tube representation."""
    return State([list(reversed(tube)) for tube in tubes])


def to_one_based(moves: typing.Sequence[Move]) -> typing.Sequence[Move]:
    """Convert 0-based moves to 1-based moves."""
    return [Move(move.from_tube_number + 1, move.to_tube_number + 1) for move in moves]


def _worker_solve(args: typing.Tuple[State, typing.List[Move], int]) -> typing.Optional[typing.Tuple[State, typing.List[Move]]]:
    """Worker function for parallel solving."""
    initial_state, initial_path, max_depth = args
    
    if initial_state.solved:
        return initial_state, initial_path
    
    queue = collections.deque([(initial_state, initial_path, 0)])
    visited = {tuple(tuple(tube) for tube in initial_state.tubes)}
    
    while queue:
        state, path, depth = queue.popleft()
        
        if depth >= max_depth:
            continue
            
        for move in state.moves:
            new_state = state.apply_move(move)
            state_key = tuple(tuple(tube) for tube in new_state.tubes)
            
            if state_key in visited:
                continue
            visited.add(state_key)
            
            new_path = path + [move]
            
            if new_state.solved:
                return new_state, new_path
                
            queue.append((new_state, new_path, depth + 1))
    
    return None


def solve(initial_state: State) -> typing.Tuple[State, typing.Optional[typing.Sequence[Move]]]:
    """Find sequence of moves to solve the puzzle using parallel BFS."""
    if initial_state.solved:
        return initial_state, []
    
    # Start with depth-limited parallel search
    max_depth = 8
    cpu_count = min(24, multiprocessing.cpu_count())
    
    while max_depth <= 50:  # Reasonable upper bound
        # Generate initial work items by exploring first few levels
        work_items = []
        queue = collections.deque([(initial_state, [], 0)])
        visited = {tuple(tuple(tube) for tube in initial_state.tubes)}
        
        # Build work items from first 2-3 levels
        target_items = cpu_count * 4
        while queue and len(work_items) < target_items:
            state, path, depth = queue.popleft()
            
            if depth >= 3:  # Start parallel work from depth 3
                work_items.append((state, path, max_depth - depth))
                continue
                
            for move in state.moves:
                new_state = state.apply_move(move)
                state_key = tuple(tuple(tube) for tube in new_state.tubes)
                
                if state_key in visited:
                    continue
                visited.add(state_key)
                
                new_path = path + [move]
                
                if new_state.solved:
                    return new_state, new_path
                    
                queue.append((new_state, new_path, depth + 1))
        
        if not work_items:
            break
            
        # Process work items in parallel
        with multiprocessing.Pool(cpu_count) as pool:
            results = pool.map(_worker_solve, work_items)
            
        # Check for solution
        for result in results:
            if result is not None:
                return result
                
        max_depth += 5  # Increase search depth
        print(f"Searching deeper: max_depth = {max_depth}")
    
    return initial_state, None


def main():
    """CLI entry point."""
    print(f"Using {min(24, multiprocessing.cpu_count())} CPUs for parallel solving...")
    
    final_state, moves = solve(
        from_top_down(
            [
                ["LB", "Ma", "Pu", "Pu"],
                ["Wh", "Or", "Pu", "LB"],
                ["Or", "Re", "LB", "DB"],
                ["BG", "DB", "Ye", "Re"],
                ["Ma", "Ye", "DB", "BG"],
                ["Re", "Wh", "Or", "BG"],
                ["Ye", "Or", "Ma", "BG"],
                ["Pu", "DB", "LB", "Wh"],
                ["Ma", "Wh", "Ye", "Re"],
                [],[]
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
