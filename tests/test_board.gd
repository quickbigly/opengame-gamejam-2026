extends TestSuite
## Walls, capture, pens, lives and the stage's end states.


func _still_ball(x: float, y: float) -> Ball:
	return Ball.new(Vector2(x, y), Vector2.ZERO)


## Steps until no wall is building or the stage ends, for at most `seconds`.
func _finish_walls(board: Board, seconds := 5.0) -> void:
	for i in int(seconds / Board.STEP):
		board.step()
		if board.halves.is_empty() or board.state != Board.State.PLAYING:
			return


func _event_types(board: Board) -> Array[String]:
	var types: Array[String] = []
	for event in board.take_events():
		types.append(event["type"])
	return types


func test_new_board_has_one_unlocked_pen() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(20.5, 15.5))
	check_equal(board.pens.size(), 1, "pens")
	check_equal(board.pens[0].area, 46 * 30, "pen area")
	check_near(board.pens[0].limit, 0.2 * 46 * 30, "pen limit")
	check(not board.pens[0].locked, "not locked")
	check_equal(board.state, Board.State.PLAYING, "state")


func test_cannot_start_a_wall_on_a_filled_cell_or_a_ball() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(20.8, 15.5))  # reaches into cell (21, 15)
	check(not board.start_wall(Vector2i(0, 5), true), "border")
	check(not board.start_wall(Vector2i(20, 15), true), "ball's cell")
	check(not board.start_wall(Vector2i(21, 15), true), "cell the ball overlaps")


func test_only_one_wall_builds_at_a_time() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(40.5, 15.5))
	check(board.start_wall(Vector2i(10, 15), true), "first wall")
	check_equal(board.walls_building(), 1, "walls building")
	check(not board.start_wall(Vector2i(20, 15), true), "second wall while the first builds")
	_finish_walls(board)
	check(board.start_wall(Vector2i(20, 15), true), "second wall after the first is done")


func test_a_wall_across_the_field_captures_the_empty_side() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(30.5, 15.5))
	board.start_wall(Vector2i(10, 15), true)
	_finish_walls(board)
	check(board.halves.is_empty(), "wall finished")
	check_equal(board.captured_cells, 9 * 30, "captured the left side")
	check_equal(board.grid.open_count(), 36 * 30, "right side still open")
	check(board.grid.is_filled(Vector2i(5, 5)), "left side filled")
	var types := _event_types(board)
	check_equal(types.count("half_completed"), 2, "both halves completed")
	check_equal(types.count("captured"), 1, "one capture")
	check_equal(board.lives, 3, "no life lost")


func test_a_ball_breaks_a_growing_half_and_costs_a_life() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(10.5, 20.5))
	board.start_wall(Vector2i(10, 10), true)
	_finish_walls(board)
	check_equal(board.lives, 2, "one life lost")
	check(board.grid.is_filled(Vector2i(10, 1)), "the upper half turned solid")
	check(board.grid.is_filled(Vector2i(10, 10)), "the upper half filled the origin")
	check(board.grid.is_open(Vector2i(10, 11)), "the lower half left nothing")
	check_equal(board.captured_cells, 0, "nothing captured through the gap")
	var types := _event_types(board)
	check(types.has("half_broken"), "half_broken event")


func test_losing_the_last_life_ends_the_stage() -> void:
	var board := Board.new(0.2, 1)
	board.add_ball(_still_ball(10.5, 20.5))
	board.start_wall(Vector2i(10, 10), true)
	_finish_walls(board)
	check_equal(board.lives, 0, "no lives left")
	check_equal(board.state, Board.State.GAME_OVER, "game over")
	check(board.halves.is_empty(), "walls cleared")
	check(not board.start_wall(Vector2i(30, 10), true), "no walls after game over")
	check(_event_types(board).has("game_over"), "game_over event")


func test_squeezing_under_the_limit_locks_the_pen_and_clears() -> void:
	var board := Board.new(0.2)  # limit 276 cells
	board.add_ball(_still_ball(5.5, 5.5))
	board.start_wall(Vector2i(12, 15), true)
	_finish_walls(board)
	check_equal(board.pens[0].area, 11 * 30, "left side is the pen")
	check(not board.pens[0].locked, "330 cells is over the limit")
	check_equal(board.state, Board.State.PLAYING, "still playing")
	board.take_events()

	board.start_wall(Vector2i(5, 20), false)
	_finish_walls(board)
	check_equal(board.pens[0].area, 11 * 19, "pen above the second wall")
	check(board.pens[0].locked, "209 cells is under the limit")
	check_equal(board.state, Board.State.CLEARED, "cleared")
	var types := _event_types(board)
	check(types.has("pen_locked"), "pen_locked event")
	check(types.has("cleared"), "cleared event")


func test_a_shared_pen_allows_the_limit_per_ball() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(5.5, 5.5))
	board.add_ball(_still_ball(8.5, 25.5))
	board.start_wall(Vector2i(20, 15), true)  # left side: 19 x 30 = 570 cells, limit 2 x 276
	_finish_walls(board)
	check_equal(board.pens.size(), 1, "one pen with both balls")
	check_near(board.pens[0].weight, 2.0, "weight")
	check_equal(board.pens[0].area, 570, "area")
	check(not board.pens[0].locked, "570 is over 552")
	board.start_wall(Vector2i(19, 15), true)  # a wall beside the first: 18 x 30 = 540
	_finish_walls(board)
	check_equal(board.pens[0].area, 540, "area after the second wall")
	check(board.pens[0].locked, "540 is under 552")
	check_equal(board.state, Board.State.CLEARED, "cleared")


func test_a_half_whose_path_is_captured_finishes_with_it() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(30.5, 15.5))
	for y in range(1, 31):
		board.grid.fill(Vector2i(20, y))  # left of x = 20 is empty but not yet captured
	board.start_wall(Vector2i(5, 15), false)
	# The left half reaches the border first; its capture takes the whole left side,
	# including the cells the right half was still growing into.
	for i in int(0.4 / Board.STEP):
		board.step()
	check(board.halves.is_empty(), "no half left building")
	check(board.grid.is_filled(Vector2i(19, 15)), "the right half's path is filled")
	check_equal(board.captured_cells, 19 * 30 - 5, "captured the left side")
	check_equal(board.lives, 3, "no life lost")


func test_spawned_balls_start_in_open_space_and_move_diagonally() -> void:
	var board := Board.new(0.1)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	board.spawn_balls(5, rng)
	check_equal(board.balls.size(), 5, "balls")
	for ball in board.balls:
		check(not ball.overlaps_filled(board.grid, ball.position), "ball at %s is in open space" % str(ball.position))
		check_near(absf(ball.velocity.x), absf(ball.velocity.y), "diagonal")
		check_near(ball.velocity.length(), Ball.DEFAULT_SPEED, "speed")
	check_equal(board.pens.size(), 1, "all in one pen")
	check_near(board.pens[0].weight, 5.0, "pen weight")
