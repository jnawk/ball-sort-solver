import lyfoes_solver


def test_equivalent():
    state1 = lyfoes_solver.from_top_down(
        [
            ["B", "B", "B", "B"],
            ["Y", "Y", "Y", "Y"],
            ["M", "M", "M", "M"],
            [],
            ["R", "R", "R", "R"],
            [],
            ["W", "W", "W", "W"],
            ["G", "G", "G", "G"],
        ]
    )

    state2 = lyfoes_solver.from_top_down(
        [
            ["B", "B", "B", "B"],
            ["G", "G", "G", "G"],
            ["Y", "Y", "Y", "Y"],
            ["M", "M", "M", "M"],
            ["R", "R", "R", "R"],
            ["W", "W", "W", "W"],
            [],
            [],
        ]
    )

    assert state1.equivalent_to(state2)


def test_solver():
    initial_state = lyfoes_solver.from_top_down(
        [
            ["R", "B", "G", "B"],
            ["M", "B", "G", "Y"],
            ["R", "W", "Y", "M"],
            ["W", "M", "G", "Y"],
            ["W", "W", "G", "R"],
            ["B", "M", "R", "Y"],
            [],
            [],
        ]
    )

    solved = lyfoes_solver.from_top_down(
        [
            ["B", "B", "B", "B"],
            ["Y", "Y", "Y", "Y"],
            ["M", "M", "M", "M"],
            [],
            ["R", "R", "R", "R"],
            [],
            ["W", "W", "W", "W"],
            ["G", "G", "G", "G"],
        ]
    )

    solved_state, moves = lyfoes_solver.solve(initial_state)

    assert solved_state.equivalent_to(solved)
