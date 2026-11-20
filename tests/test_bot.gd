extends TestSuite
## The balance bot: it plays, it replays exactly, and it uses Crossbeam when it has it.


## Plays one stage with the bot; returns the board when it ends or after `seconds`.
func _play_stage(run: Run, tier: String, seed_value: int, seconds := 120.0) -> Board:
	var board := run.start_stage()
	var bot := Bot.new(tier, seed_value)
	bot.begin(board)
	while board.state == Board.State.PLAYING and board.time < seconds:
		board.step()
		for event in board.take_events():
			run.handle_event(event)
		bot.update()
	return board


func test_expert_clears_stage_one() -> void:
	var board := _play_stage(Run.new(11), "expert", 11)
	check_equal(board.state, Board.State.CLEARED, "cleared")


func test_same_seed_same_run() -> void:
	var first := _play_stage(Run.new(5), "average", 5)
	var second := _play_stage(Run.new(5), "average", 5)
	check_equal(first.time, second.time, "same length")
	check_equal(first.lives, second.lives, "same lives")
	check_equal(first.grid.open_count(), second.grid.open_count(), "same field")


func test_bot_builds_crosses_with_crossbeam() -> void:
	var crosses := 0
	for seed_value in 4:
		var run := Run.new(seed_value)
		run.stage = 4
		run.upgrades = {"crossbeam": 1}
		var board := run.start_stage()
		var bot := Bot.new("expert", seed_value)
		bot.begin(board)
		while board.state == Board.State.PLAYING and board.time < 60.0:
			board.step()
			for event in board.take_events():
				if event["type"] == "wall_started" and event["cross"]:
					crosses += 1
			bot.update()
	check(crosses > 0, "at least one + wall in four stages")
