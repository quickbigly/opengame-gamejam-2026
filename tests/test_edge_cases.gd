extends TestSuite
## The M5 bug bash: clicks on walls, balls in a wall's start cell, walls that close two pens
## at once, and hits that touch several halves at once.


func _ball(x: float, y: float, velocity := Vector2.ZERO) -> Ball:
	return Ball.new(Vector2(x, y), velocity)


func _steps(board: Board, seconds: float) -> void:
	for i in int(seconds / Board.STEP):
		board.step()


func _finish_walls(board: Board, seconds := 5.0) -> void:
	for i in int(seconds / Board.STEP):
		board.step()
		if board.halves.is_empty() or board.state != Board.State.PLAYING:
			return


func _events_of(board: Board, type: String) -> Array[Dictionary]:
	var found: Array[Dictionary] = []
	for event in board.take_events():
		if event["type"] == type:
			found.append(event)
	return found


func test_clicks_on_walls_are_refused() -> void:
	var board := Board.new(0.2)
	board.max_walls = 2  # so only the overlap check can refuse a second wall
	board.add_ball(_ball(40.5, 25.5))
	check(board.start_wall(Vector2i(10, 15), true), "first wall")
	_steps(board, 0.15)
	check(not board.start_wall(Vector2i(10, 15), false), "on the growing wall's origin")
	check(not board.start_wall(Vector2i(10, 14), false), "on a growing half")
	check(not board.start_wall(Vector2i(10, 17), false), "on the other growing half")
	check(not board.start_wall(Vector2i(0, 15), false), "on the border")
	check(not board.start_wall(Vector2i(-3, 99), false), "off the field")
	_finish_walls(board)
	check(not board.start_wall(Vector2i(10, 5), false), "on the finished wall")
	check(board.start_wall(Vector2i(30, 5), false), "in open space")


func test_a_ball_entering_the_start_cell_costs_one_life() -> void:
	var board := Board.new(0.2)
	board.add_ball(_ball(12.5, 15.5, Vector2(-10, 0)))  # heading straight for the origin cell
	board.start_wall(Vector2i(10, 15), true)
	_finish_walls(board)
	var breaks := _events_of(board, "half_broken")
	check_equal(breaks.size(), 2, "both halves cover the origin, so both break")
	check_equal(board.lives, 2, "but the one hit costs one life")
	var costs := breaks.filter(func(e: Dictionary) -> bool: return e["costs_life"])
	check_equal(costs.size(), 1, "one break says it cost a life")


func test_a_ball_at_a_cross_origin_costs_one_life() -> void:
	var board := Board.new(0.2)
	board.crossbeam = true
	board.wall_speed = 0.5  # so the ball reaches the origin before an arm reaches the ball
	board.add_ball(_ball(12.5, 15.5, Vector2(-10, 0)))
	board.start_wall(Vector2i(10, 15), true, true)
	_finish_walls(board)
	check_equal(board.lives, 2, "four halves broken by one hit cost one life")


func test_a_ball_that_breaks_one_half_and_runs_on_into_the_other_costs_one_life() -> void:
	var board := Board.new(0.2)
	# Heading left along the wall's row: it meets the right half's tip, breaks it, and carries
	# on into the origin cell, which the left half covers too.
	board.add_ball(_ball(16.5, 15.5, Vector2(-10, 0)))
	board.start_wall(Vector2i(10, 15), false)
	_finish_walls(board)
	check_equal(_events_of(board, "half_broken").size(), 2, "both halves broken")
	check_equal(board.lives, 2, "by one ball in one pass: one life")


func test_two_balls_breaking_two_halves_cost_two_lives() -> void:
	var board := Board.new(0.2)
	board.add_ball(_ball(10.5, 5.5))
	board.add_ball(_ball(10.5, 25.5))
	board.start_wall(Vector2i(10, 15), true)
	_finish_walls(board)
	check_equal(board.lives, 1, "two balls, two hits")


func test_a_hit_at_the_origin_uses_one_shield() -> void:
	var board := Board.new(0.2)
	board.shield_hits = 2
	board.add_ball(_ball(12.5, 15.5, Vector2(-10, 0)))
	board.start_wall(Vector2i(10, 15), true)
	_steps(board, 0.3)
	check_equal(board.shield_hits, 1, "one shield spent")
	check_equal(board.lives, 3, "no life lost")


func test_close_call_spares_a_hit_at_the_origin() -> void:
	var board := Board.new(0.2)
	board.close_calls = 1
	board.add_ball(_ball(12.5, 15.5, Vector2(-10, 0)))
	board.start_wall(Vector2i(10, 15), true)
	_finish_walls(board)
	check_equal(board.lives, 3, "the one hit was spared")
	check_equal(board.close_calls, 0, "Close Call used")


## A strip 10 x 29 = 290 cells on the left, just over the 281.5-cell limit for two balls, so a
## wall across it leaves two pens of 140 cells, each under the 140.8-cell limit for one ball.
func _strip_board() -> Board:
	var board := Board.new(0.102)
	for y in range(1, 31):
		board.grid.fill(Vector2i(11, y))
	for x in range(1, 11):
		board.grid.fill(Vector2i(x, 30))
	return board


func test_a_wall_that_closes_two_pens_at_once() -> void:
	var board := _strip_board()
	board.add_ball(_ball(30.5, 15.5))  # first, so the board isn't cleared while balls are added
	board.add_ball(_ball(4.5, 5.5))
	board.add_ball(_ball(4.5, 25.5))
	check_equal(board.pens.size(), 2, "strip pen and right-side pen")
	check(not board.pens[0].locked and not board.pens[1].locked, "neither locked yet")
	board.take_events()
	check(board.start_wall(Vector2i(5, 15), false), "wall across the strip")
	_finish_walls(board)
	var locks := _events_of(board, "pen_locked")
	check_equal(locks.size(), 2, "both new pens lock")
	if locks.size() == 2:
		check_equal([locks[0]["area"], locks[1]["area"]], [140, 140], "pen areas")
		for event in locks:
			check(board.grid.is_open(event["cell"]), "a locked pen's cell is open")
	check_equal(board.locked_count(), 2, "two balls boxed")
	check_equal(board.state, Board.State.PLAYING, "the third ball is still free")


func test_a_wall_that_closes_the_last_two_pens_clears() -> void:
	var board := _strip_board()
	for y in range(1, 31):
		for x in range(12, 47):
			board.grid.fill(Vector2i(x, y))  # nothing left right of the strip
	board.add_ball(_ball(4.5, 5.5))
	board.add_ball(_ball(4.5, 25.5))
	board.take_events()
	check(board.start_wall(Vector2i(5, 15), false), "wall across the strip")
	_finish_walls(board)
	check_equal(board.state, Board.State.CLEARED, "cleared by one wall")
	check_equal(_events_of(board, "cleared").size(), 1, "one cleared event")


func test_a_one_cell_gap_wall_fills_once() -> void:
	var board := Board.new(0.2)
	for y in range(1, 31):
		if y != 15:
			board.grid.fill(Vector2i(20, y))  # a wall with a one-cell gap at (20, 15)
	board.add_ball(_ball(30.5, 10.5))
	board.take_events()
	check(board.start_wall(Vector2i(20, 15), true), "wall in the gap")
	_finish_walls(board)
	check(board.halves.is_empty(), "done")
	check(board.grid.is_filled(Vector2i(20, 15)), "the gap is closed")
	check_equal(_events_of(board, "captured").size(), 1, "the left side is captured once")
	check_equal(board.captured_cells, 19 * 30, "left side")
	check_equal(board.lives, 3, "no life lost")
