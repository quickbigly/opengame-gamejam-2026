extends TestSuite
## The game flow in main.gd: what it does with the board's events.

const MAIN := preload("res://scripts/main.gd")


func _clearing_events() -> Array[Dictionary]:
	# One ball, boxed in by a single wall across the field: the step that sets it clears the stage.
	var run := Run.new(1)
	var board := run.start_stage()
	board.balls.clear()
	var ball := Ball.new(Vector2(5.5, 5.5), Vector2.ZERO)
	board.add_ball(ball)
	board.start_wall(Vector2i(10, 15), true)
	var events: Array[Dictionary] = []
	for i in 2000:
		board.step()
		events.append_array(board.take_events())
		if board.state != Board.State.PLAYING and board.walls_building() == 0:
			break
	return events


func test_the_clearing_wall_is_reported_after_cleared() -> void:
	var types := _clearing_events().map(func(e: Dictionary) -> String: return e["type"])
	check(types.has("cleared"), "the wall clears the stage: %s" % [types])
	check(types.find("wall_finished") > types.find("cleared"), "wall_finished comes after cleared (why main keeps listening)")


func test_the_clearing_wall_scores() -> void:
	var main: Node = MAIN.new()
	main.run = Run.new(1)
	main.run.start_stage()
	main.screen = MAIN.Screen.ENDING
	main._on_board_event({"type": "wall_finished", "wall_id": 0, "cells": 500, "regions": 1})
	check(main.run.score > 0, "a wall that finishes while the stage ends still scores (score %d)" % main.run.score)
	main.free()
