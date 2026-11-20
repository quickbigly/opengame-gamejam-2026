extends TestSuite
## M3: ball kinds, Hardened Tip, Crossbeam, the actives, Endless and run history.


func _still_ball(x: float, y: float) -> Ball:
	return Ball.new(Vector2(x, y), Vector2.ZERO)


func _finish_walls(board: Board, seconds := 5.0) -> void:
	for i in int(seconds / Board.STEP):
		board.step()
		if board.halves.is_empty() or board.state != Board.State.PLAYING:
			return


func _events_of(board: Board, type: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for event in board.take_events():
		if event["type"] == type:
			result.append(event)
	return result


func test_kinds_change_speed_size_and_weight() -> void:
	var swift := Ball.of_kind(Ball.Kind.SWIFT, Vector2(10, 10), Vector2(1, 1))
	check_near(swift.velocity.length(), Ball.DEFAULT_SPEED * 1.5, "Swift is 1.5× as fast")
	var big := Ball.of_kind(Ball.Kind.BIG, Vector2(10, 10), Vector2(1, -1))
	check_near(big.radius, Ball.DEFAULT_RADIUS * 2.0, "Big is twice the size")
	check_near(big.weight, 1.5, "Big counts as 1.5 balls")
	var drifter := Ball.of_kind(Ball.Kind.DRIFTER, Vector2(10, 10), Vector2(1, 1), 10.0, 0.35, -1)
	check_near(drifter.turn_rate, -Ball.DRIFT_RATE, "Drifter turns the given way")
	check_near(drifter.copy().turn_rate, drifter.turn_rate, "copies keep the turn")


func test_drifter_curves_and_stays_in_the_open() -> void:
	var grid := Grid.new()
	var ball := Ball.of_kind(Ball.Kind.DRIFTER, Vector2(20.5, 15.5), Vector2(1, 1))
	var start := ball.velocity
	for i in 1200:  # ten seconds
		ball.step(grid, Board.STEP)
		check(not ball.overlaps_filled(grid, ball.position), "never inside a filled cell")
		if failures.size() > 0:
			return
	check(ball.velocity.angle_to(start) != 0.0, "heading changed")
	check_near(ball.velocity.length(), start.length(), "speed kept", 0.01)


func test_big_balls_spawn_clear_of_the_border() -> void:
	var rng := RandomNumberGenerator.new()
	for seed_value in 30:
		rng.seed = seed_value
		var board := Board.new(0.2)
		board.spawn_balls(4, rng, Ball.DEFAULT_SPEED, Ball.DEFAULT_RADIUS, [Ball.Kind.BIG, Ball.Kind.BIG])
		for ball in board.balls:
			check(not ball.overlaps_filled(board.grid, ball.position), "seed %d: ball clear of filled cells" % seed_value)
		check_equal(board.balls[0].kind, Ball.Kind.BIG, "kinds come first")
		check_equal(board.balls[3].kind, Ball.Kind.BASIC, "then Basic")


func test_big_ball_widens_its_pen() -> void:
	var board := Board.new(0.1)  # 138 cells per ball
	var big := Ball.of_kind(Ball.Kind.BIG, Vector2(5.5, 15.5), Vector2.ZERO)
	board.add_ball(big)
	board.start_wall(Vector2i(8, 15), true)  # left side: 7 × 30 = 210, under 1.5 × 138
	_finish_walls(board)
	check_near(board.pens[0].limit, 207.0, "limit is 1.5 × the per-ball limit", 0.01)
	check(not board.pens[0].locked, "210 is still over 207")
	board.start_wall(Vector2i(3, 2), false)  # the wall row and the row above it: 196 cells
	_finish_walls(board)
	check(board.pens[0].locked, "203 locks")


func test_splitter_splits_below_half_the_field() -> void:
	var board := Board.new(0.2)
	board.add_ball(Ball.of_kind(Ball.Kind.SPLITTER, Vector2(10.5, 15.5), Vector2(1, 1), 0.001))
	board.start_wall(Vector2i(30, 15), true)  # leaves x 1..29: 870 of 1380 cells, over half
	_finish_walls(board)
	check_equal(board.balls.size(), 1, "not yet")
	board.take_events()
	board.start_wall(Vector2i(20, 15), true)  # leaves 19 × 30 = 570, under half
	_finish_walls(board)
	check_equal(board.balls.size(), 2, "split in two")
	check_equal(board.balls[0].kind, Ball.Kind.BASIC, "into Basics")
	check(board.balls[0].velocity.x == -board.balls[1].velocity.x, "heading apart")
	check_equal(_events_of(board, "ball_split").size(), 1, "split event")
	check_equal(board.pens[0].balls.size(), 2, "both in the pen")


func test_a_shield_saves_a_half() -> void:
	var board := Board.new(0.2)
	board.shield_hits = 1
	var ball := Ball.new(Vector2(14.5, 20.5), Vector2(-10, 0))  # meets the lower half's side
	board.add_ball(ball)
	board.start_wall(Vector2i(5, 10), true)
	_finish_walls(board)
	check_equal(board.lives, 3, "no life lost")
	check(ball.velocity.x > 0, "the ball was turned away")
	check_equal(_events_of(board, "half_shielded").size(), 1, "one shielded hit")
	check(board.grid.is_filled(Vector2i(5, 30)), "the half still set")


func test_a_ball_that_cant_get_clear_still_breaks_it() -> void:
	var board := Board.new(0.2)
	board.shield_hits = 1
	board.add_ball(_still_ball(5.5, 25.5))  # a still ball can't get clear
	board.start_wall(Vector2i(5, 10), true)
	_finish_walls(board)
	check_equal(board.lives, 2, "the second touch after the grace breaks it")


func test_shields_run_out() -> void:
	var board := Board.new(0.2)
	board.shield_hits = 1
	board.add_ball(Ball.new(Vector2(20.5, 18.5), Vector2(0, -10)))  # meets the left half first
	board.add_ball(Ball.new(Vector2(35.5, 25.5), Vector2(0, -10)))  # then the right half
	board.start_wall(Vector2i(24, 10), false)
	_finish_walls(board)
	check_equal(_events_of(board, "half_shielded").size(), 1, "the first hit is shrugged off")
	check_equal(board.lives, 2, "the second hit breaks it")
	check_equal(board.shield_hits, 0, "none left")


func test_clearing_gives_lives_up_to_the_cap() -> void:
	var run := Run.new(1)
	run.start_stage()
	run.board.lives = Run.MAX_LIVES
	run.board.state = Board.State.CLEARED
	check_equal(run.finish_stage()["lives_gained"], 0, "no life past the cap")
	check_equal(run.lives, Run.MAX_LIVES, "lives at the cap")
	run.upgrades["second_wind"] = 1
	run.start_stage()
	run.board.lives = Run.MAX_LIVES - 1
	run.board.state = Board.State.CLEARED
	check_equal(run.finish_stage()["lives_gained"], 1, "Second Wind still stops at the cap")
	run.offer = ["spare", "greed", "study"]
	run.pick(0)
	check_equal(run.lives, Run.MAX_LIVES + 1, "Spare adds a life")
	check_equal(run.max_lives(), Run.MAX_LIVES + 1, "and raises the cap")


func test_crossbeam_builds_four_halves() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(40.5, 25.5))
	board.start_wall(Vector2i(10, 10), true, true)
	check_equal(board.halves.size(), 2, "no Crossbeam: a plain wall")
	board = Board.new(0.2)
	board.crossbeam = true
	board.add_ball(_still_ball(40.5, 25.5))
	board.start_wall(Vector2i(10, 10), true, true)
	check_equal(board.halves.size(), 4, "a + wall")
	_finish_walls(board)
	check(board.grid.is_filled(Vector2i(10, 1)) and board.grid.is_filled(Vector2i(1, 10)), "all four arms set")
	check_equal(board.grid.open_count(), 36 * 20, "only the ball's quarter is left")


func test_freeze_active() -> void:
	var run := Run.new(1)
	run.upgrades = {"freeze": 1}
	var board := run.start_stage()
	check_equal(board.active, "freeze", "active set")
	check(board.active_ready(), "ready at the start of a stage")
	var at := board.balls[0].position
	check(board.use_active(Vector2(1, 1)), "used")
	check(not board.active_ready(), "spent")
	for i in 120:
		board.step()
	check_equal(board.balls[0].position, at, "balls stop")
	check_equal(_events_of(board, "active_used").size(), 1, "event")


func test_actives_recharge_by_walls() -> void:
	var board := Board.new(0.2)
	board.active = "repel"
	board.active_cost = 2
	board.add_ball(_still_ball(40.5, 25.5))
	board.start_wall(Vector2i(5, 10), true)
	_finish_walls(board)
	check_equal(board.active_charge, 1, "one wall")
	board.start_wall(Vector2i(10, 10), true)
	_finish_walls(board)
	check(board.active_ready(), "ready after two")


func test_repel_turns_every_ball_away() -> void:
	var board := Board.new(0.2)
	board.active = "repel"
	var near := Ball.new(Vector2(12.5, 12.5), Ball.diagonal(10, -1, -1))
	var far := Ball.new(Vector2(40.5, 25.5), Ball.diagonal(10, -1, -1))
	board.add_ball(near)
	board.add_ball(far)
	check(board.use_active(Vector2(10, 10)), "used")
	check(near.velocity.x > 0 and near.velocity.y > 0, "the near ball heads away")
	check(far.velocity.x > 0 and far.velocity.y > 0, "so does the far one")


func test_a_new_active_replaces_the_old() -> void:
	var run := Run.new(1)
	run.offer = ["freeze", "greed", "study"]
	run.pick(0)
	check_equal(run.active(), "freeze", "holding Freeze")
	run.offer = ["repel", "greed", "study"]
	run.pick(0)
	check_equal(run.active(), "repel", "swapped")
	check(not run.has("freeze"), "Freeze is gone")
	for i in 30:
		run.open_offer()
		check(not run.offer.has("repel"), "the held active isn't offered")


func test_stage_kinds() -> void:
	check_equal(StageTable.stage(4)["kinds"], [Ball.Kind.SWIFT], "Swift arrives on stage 4")
	check_equal(StageTable.new_kinds(4), [Ball.Kind.SWIFT], "and is new there")
	check_equal(StageTable.new_kinds(5), [], "but not on stage 5")
	check_equal(StageTable.stage(12)["kinds"].size(), 4, "the finale has one of each")
	var run := Run.new(3)
	run.stage = 12
	var board := run.start_stage()
	var kinds := {}
	for ball in board.balls:
		kinds[ball.kind] = true
	check_equal(kinds.size(), 5, "Basic plus the four specials")


func test_endless_keeps_tightening() -> void:
	check(not StageTable.is_endless(12), "12 is the finale")
	check(StageTable.is_endless(13), "13 is Endless")
	var last := StageTable.stage(12)
	var previous := last
	for number in range(13, 40):
		var next := StageTable.stage(number)
		check(next["limit"] <= previous["limit"], "stage %d: limit never loosens" % number)
		check(next["balls"] >= previous["balls"], "stage %d: balls never drop" % number)
		check(next["balls"] <= StageTable.ENDLESS_MAX_BALLS, "stage %d: ball cap" % number)
		check(next["kinds"].size() <= next["balls"], "stage %d: kinds fit" % number)
		check(next["limit"] * next["balls"] * 1.5 < 1.0, "stage %d: pens can't cover the field" % number)
		previous = next
	check_near(StageTable.stage(99)["limit"], StageTable.ENDLESS_FLOOR, "the limit floors")


func test_endless_runs_past_the_finale() -> void:
	var run := Run.new(1)
	run.stage = 12
	check(run.is_final_stage(), "final before Endless")
	run.endless = true
	check(not run.is_final_stage(), "not final in Endless")
	run.advance()
	check(run.is_endless_stage(), "stage 13 is Endless")
	check_equal(run.start_stage().balls.size(), StageTable.stage(13)["balls"], "Endless board")


func test_history_records_each_stage() -> void:
	var run := Run.new(1)
	var board := run.start_stage()
	board.add_ball(_still_ball(5.5, 5.5))
	for i in 60:
		board.step()
	board.state = Board.State.CLEARED
	run.finish_stage()
	run.advance()
	run.start_stage()
	run.fail_stage()
	check_equal(run.history.size(), 2, "two stages")
	check(run.history[0]["cleared"], "first cleared")
	check_near(run.history[0]["time"], 0.5, "time played", 0.02)
	check(not run.history[1]["cleared"], "second lost")
	var summary := run.summary(false)
	check_equal(summary["stage"], 2, "summary stage")
	check_equal(summary["stages"].size(), 2, "summary stages")
