extends TestSuite
## Run: stages, scoring, XP, offers and upgrade effects.


func _still_ball(x: float, y: float) -> Ball:
	return Ball.new(Vector2(x, y), Vector2.ZERO)


func _finish_walls(board: Board, seconds := 5.0) -> void:
	for i in int(seconds / Board.STEP):
		board.step()
		if board.halves.is_empty() or board.state != Board.State.PLAYING:
			return


## Steps the board and feeds its events to the run.
func _play(run: Run, seconds := 5.0) -> void:
	for i in int(seconds / Board.STEP):
		run.board.step()
		for event in run.board.take_events():
			run.handle_event(event)
		if run.board.halves.is_empty() or run.board.state != Board.State.PLAYING:
			return


func _wall(cells: int, regions: int) -> Dictionary:
	return {"type": "wall_finished", "wall_id": 0, "cells": cells, "regions": regions}


func test_stage_table_has_twelve_stages() -> void:
	check_equal(StageTable.count(), 12, "stages")
	check_equal(StageTable.stage(1)["balls"], 1, "stage 1 balls")
	check_equal(StageTable.stage(12)["balls"], 7, "stage 12 balls")
	check_equal(StageTable.stage(99), StageTable.stage(12), "past the end clamps to the finale")


func test_start_stage_builds_the_stage_board() -> void:
	var run := Run.new(1)
	run.stage = 4
	var board := run.start_stage()
	check_equal(board.balls.size(), 3, "balls")
	check_near(board.pen_limit, 0.11, "pen limit")
	check_equal(board.lives, 3, "lives carried in")


func test_capture_points_use_the_stage_multiplier() -> void:
	var run := Run.new(1)
	run.start_stage()
	run.handle_event(_wall(100, 1))
	check_equal(run.score, 1150, "100 cells × 10 × 1.15")
	check_equal(run.capture_points, 1150, "capture points")
	run.handle_event(_wall(0, 0))
	check_equal(run.score, 1150, "a wall that captured nothing scores nothing")


func test_combo_multiplies_by_regions() -> void:
	var run := Run.new(1)
	run.start_stage()
	run.handle_event(_wall(100, 2))
	check_equal(run.score, 2300, "two regions double the wall's points")
	check_equal(run.combo_points, 1150, "the extra is counted as combo")
	run.upgrades["chain"] = 1
	check_equal(run.combo_multiplier(2), 3, "Chain adds one to a combo")
	check_equal(run.combo_multiplier(1), 1, "but not to a single region")


func test_greed_and_study() -> void:
	var run := Run.new(1)
	run.upgrades = {"greed": 2, "study": 1}
	run.start_stage()
	run.handle_event(_wall(100, 1))
	check_equal(run.score, roundi(1000 * 1.15 * 1.3), "Greed ×2 is +30%")
	check_near(run.xp, run.score * 1.2, "Study gives +20% XP", 0.5)


func test_xp_levels_up_and_queues_picks() -> void:
	var run := Run.new(1)
	check_near(run.xp_needed(1), 5000.0, "level 1 needs the base")
	check_near(run.xp_needed(2), 6250.0, "level 2 needs 25% more")
	run.start_stage()
	run._add_points(12000)
	check_equal(run.level, 3, "12000 XP passes two thresholds")
	check_equal(run.pending_levels, 2, "two picks queued")
	check_near(run.xp, 12000.0 - 5000.0 - 6250.0, "leftover XP")


func test_clearing_a_stage_scores_squeeze_and_clean_bonus() -> void:
	var run := Run.new(1)
	run.board = Board.new(0.2)  # limit 276 cells
	run.board.add_ball(_still_ball(5.5, 5.5))
	run.board.start_wall(Vector2i(12, 15), true)
	_play(run)
	run.board.start_wall(Vector2i(5, 20), false)
	_play(run)
	check_equal(run.board.state, Board.State.CLEARED, "cleared")
	var captured := 34 * 30 + 11 * 10
	check_equal(run.capture_points, roundi(34 * 30 * 10 * 1.15) + roundi(11 * 10 * 10 * 1.15), "capture points")
	var before := run.stage_points
	var breakdown := run.finish_stage()
	var squeeze := roundi(25 * (0.2 * 1380 - 11 * 19) * 1.15)
	check_equal(breakdown["squeeze"], squeeze, "squeeze bonus")
	check_equal(breakdown["clean"], roundi((before + squeeze) * 0.25), "clean clear is 25% of the stage")
	check_equal(breakdown["total"], run.stage_points, "total")
	check_equal(run.score, run.stage_points, "score")
	check_equal(run.lives, 4, "clearing gives a life")
	check(captured > 0, "sanity")


func test_losing_a_life_skips_the_clean_bonus() -> void:
	var run := Run.new(1)
	run.board = Board.new(0.2)
	run.board.add_ball(_still_ball(5.5, 25.5))
	run.board.start_wall(Vector2i(5, 10), true)  # the lower half hits the ball
	_play(run)
	check_equal(run.lives, 2, "life lost")
	check_equal(run.lives_lost, 1, "counted")
	run.board.state = Board.State.CLEARED
	check_equal(run.finish_stage()["clean"], 0, "no clean bonus")


func test_offers_are_distinct_and_respect_max_stacks() -> void:
	var run := Run.new(5)
	for i in 50:
		run.open_offer()
		check_equal(run.offer.size(), 3, "offer size")
		var seen := {}
		for id in run.offer:
			check(not seen.has(id), "no repeats in an offer")
			seen[id] = true
	run.upgrades = {"twin_crews": 1, "chain": 1}
	for i in 50:
		run.open_offer()
		check(not run.offer.has("twin_crews") and not run.offer.has("chain"), "maxed upgrades aren't offered")


func test_rerolls_and_picks() -> void:
	var run := Run.new(5)
	run.pending_levels = 2
	run.open_offer()
	check_equal(run.rerolls_left, 1, "one reroll by default")
	check(run.reroll(), "reroll")
	check(not run.reroll(), "no more rerolls")
	run.offer = ["spare", "greed", "study"]
	check_equal(run.pick(0), "spare", "picked")
	check_equal(run.lives, 4, "Spare adds a life now")
	check_equal(run.pending_levels, 1, "one pick left")
	run.upgrades["reroll"] = 2
	run.open_offer()
	check_equal(run.rerolls_left, 3, "Reroll adds rerolls")


func test_upgrades_change_the_board() -> void:
	var run := Run.new(1)
	run.upgrades = {"quick_build": 2, "loose_fit": 1, "shrink": 1, "thick_air": 1, "twin_crews": 1,
			"last_stretch": 1, "stun": 1, "close_call": 1, "auto_lock": 1}
	var board := run.start_stage()
	check_near(board.wall_speed, Board.WALL_SPEED * 1.44, "Quick Build")
	check_near(board.pen_limit, 0.2 * 1.08, "Loose Fit")
	check_near(board.balls[0].radius, Ball.DEFAULT_RADIUS * 0.9, "Shrink")
	check_near(board.balls[0].velocity.length(), Ball.DEFAULT_SPEED * 0.92, "Thick Air", 0.01)
	check_equal(board.max_walls, 2, "Twin Crews")
	check_near(board.last_stretch, 3.0, "Last Stretch")
	check_near(board.stun_time, 0.75, "Stun")
	check_equal(board.close_calls, 1, "Close Call")
	check_near(board.auto_lock, 0.1, "Auto-Lock")


func test_close_call_spares_one_life() -> void:
	var board := Board.new(0.2)
	board.close_calls = 1
	board.add_ball(_still_ball(5.5, 25.5))
	board.start_wall(Vector2i(5, 10), true)
	_finish_walls(board)
	check_equal(board.lives, 3, "spared")
	var spared := false
	for event in board.take_events():
		if event["type"] == "half_broken":
			spared = event["spared"]
	check(spared, "the break says it was spared")
	board.start_wall(Vector2i(5, 12), true)
	_finish_walls(board)
	check_equal(board.lives, 2, "only the first is spared")


func test_twin_crews_builds_two_walls() -> void:
	var board := Board.new(0.2)
	board.max_walls = 2
	board.add_ball(_still_ball(40.5, 15.5))
	check(board.start_wall(Vector2i(10, 15), true), "first")
	check(board.start_wall(Vector2i(20, 15), true), "second")
	check(not board.start_wall(Vector2i(30, 15), true), "not a third")
	check(not board.start_wall(Vector2i(10, 15), false), "not on a growing half")


func test_stun_freezes_balls_when_a_half_sets() -> void:
	var board := Board.new(0.2)
	board.stun_time = 0.75
	board.add_ball(Ball.new(Vector2(40.5, 15.5), Vector2(0, 10)))
	board.start_wall(Vector2i(10, 1), true)  # the upper half sets within a few steps
	while board.halves.size() == 2:
		check(not board.is_frozen(), "not frozen before a half sets")
		board.step()
	check(board.is_frozen(), "frozen after a half sets")
	var at := board.balls[0].position
	board.step()
	check_equal(board.balls[0].position, at, "the ball doesn't move while frozen")


func test_last_stretch_finishes_short_halves_at_once() -> void:
	var board := Board.new(0.2)
	board.last_stretch = 3.0
	board.add_ball(_still_ball(40.5, 15.5))
	board.start_wall(Vector2i(10, 3), true)
	board.step()
	check_equal(board.halves.size(), 1, "the 3-cell upper half finished on the first step")
	check(board.grid.is_filled(Vector2i(10, 1)), "and filled its cells")


func test_auto_lock_accepts_a_pen_just_over_the_limit() -> void:
	var board := Board.new(0.2)  # limit 276
	board.auto_lock = 0.1  # up to 303.6
	board.add_ball(_still_ball(5.5, 5.5))
	board.start_wall(Vector2i(11, 15), true)  # left side: 10 x 30 = 300
	_finish_walls(board)
	check_equal(board.pens[0].area, 300, "area")
	check(board.pens[0].locked, "locked within 10%")
	check_equal(board.state, Board.State.CLEARED, "cleared")


func test_wall_finished_reports_the_wall_totals() -> void:
	var board := Board.new(0.2)
	board.add_ball(_still_ball(30.5, 15.5))
	board.start_wall(Vector2i(10, 15), true)
	_finish_walls(board)
	var finished: Array[Dictionary] = []
	for event in board.take_events():
		if event["type"] == "wall_finished":
			finished.append(event)
	check_equal(finished.size(), 1, "one wall_finished")
	if finished.size() == 1:
		check_equal(finished[0]["cells"], 270, "cells")
		check_equal(finished[0]["regions"], 1, "regions")
