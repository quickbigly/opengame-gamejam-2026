extends Node
## Runs the game's flow: title -> stage intro -> play -> stage clear -> upgrade picks -> next
## stage, ending in victory after the last stage (with the offer to go on into Endless) or
## game over. Play pauses with Esc or P, or when the window loses focus. Settings open from the
## title or the pause screen. Each finished run is appended to RUN_LOG, so real runs can be
## compared with the balance bot's (`dev -Balance --real`).
##
## Command-line options (after --, e.g. `dev --seed=42 --stage=6`):
##   --seed=N    seed for the run
##   --stage=N   start the run at stage N (for testing; past the last stage is Endless)

enum Screen { TITLE, INTRO, PLAYING, PAUSED, ENDING, CLEAR, PICK, OVER }

const SAVE_PATH := "user://save.cfg"
## One JSON line per finished run: Run.summary() plus the date and whether it was staged.
const RUN_LOG := "user://runs.jsonl"
## Written by `dev -Web` and `dev -WebTest` before exporting: the commit the build came from.
const BUILD_ID_PATH := "res://build_id.txt"
## Pause after the last pen locks or the last life goes, before the screen changes.
const END_DELAY := 1.2
const TITLE_BALLS := 3

var screen := Screen.TITLE
var run: Run

var _field: Node2D
var _screens: CanvasLayer
var _end_timer := 0.0
var _seed := 0
var _start_stage := 1
var _best_score := 0
var _best_stage := 0
var _tutorial: Tutorial
## Whether settings were opened from the pause screen (else from the title).
var _settings_from_pause := false
var _in_settings := false
var _build_id := "dev"
## Test builds with autoplay=<tier> only: the bot that advises the browser test (TestHooks).
var _advisor: Bot


func _ready() -> void:
	_seed = randi()
	if FileAccess.file_exists(BUILD_ID_PATH):
		_build_id = FileAccess.get_file_as_string(BUILD_ID_PATH).strip_edges()
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=")
		if parts.size() != 2:
			continue
		match parts[0]:
			"seed": _seed = parts[1].to_int()
			"stage": _start_stage = clampi(parts[1].to_int(), 1, 99)
	if TestHooks.start_stage > 0:
		_start_stage = TestHooks.start_stage

	_field = preload("res://scenes/game/field.gd").new()
	_field.board_event.connect(_on_board_event)
	_field.turned.connect(func() -> void: _tutorial_event("turned"))
	if TestHooks.autoplay != "":
		_field.stepped_once.connect(func() -> void:
			if _advisor and screen == Screen.PLAYING:
				_advisor.update())
	add_child(_field)
	_screens = preload("res://scenes/ui/screens.gd").new()
	add_child(_screens)
	_screens.start_pressed.connect(_start_run)
	_screens.begin_pressed.connect(_begin_play)
	_screens.continue_pressed.connect(_after_clear)
	_screens.pick_pressed.connect(_on_pick)
	_screens.reroll_pressed.connect(_on_reroll)
	_screens.again_pressed.connect(_start_run)
	_screens.title_pressed.connect(_show_title)
	_screens.endless_pressed.connect(_go_endless)
	_screens.settings_pressed.connect(_open_settings)
	_screens.settings_closed.connect(_close_settings)
	_screens.resume_pressed.connect(_resume)
	_screens.restart_pressed.connect(_start_run)

	_load_best()
	_show_title()
	print("Boxed In ready")


## On the web, mirrors a short summary to window.boxedIn whenever it changes, so a browser test
## can see where the game is in any build. Test builds also get the full state (test_state()).
func _summary_state() -> Dictionary:
	var state := {"build": _build_id, "screen": Screen.keys()[screen], "vertical": _field.vertical,
		"settings": _in_settings}
	if run:
		state.merge({"stage": run.stage, "lives": run.board.lives if run.board else run.lives,
			"score": run.score, "level": run.level})
	return state


var _published := ""


func _process(delta: float) -> void:
	if OS.has_feature("web"):
		var summary := JSON.stringify(_summary_state())
		if summary != _published:
			_published = summary
			JavaScriptBridge.eval("window.boxedIn = %s;" % summary, true)
	if TestHooks.enabled and not TestHooks.quiet:
		TestHooks.publish(test_state())
	if screen == Screen.PLAYING and _tutorial:
		# Tips time out on board time under the stepped clock, so they wait for a slow player.
		_tutorial.update(_field.stepped_seconds if TestHooks.stepped else delta)
		_field.tip = _tutorial.tip
	if screen != Screen.ENDING:
		return
	_end_timer -= _field.stepped_seconds if TestHooks.stepped else delta
	if _end_timer > 0.0:
		return
	if run.board.state == Board.State.CLEARED:
		var breakdown := run.finish_stage()
		if run.is_final_stage():
			_show_end(true)
		else:
			screen = Screen.CLEAR
			var tips_finished := _tutorial != null and run.stage == 2
			if tips_finished:
				Settings.set_value("tips", false)
			_screens.show_clear(run, breakdown, tips_finished)
	else:
		run.fail_stage()
		_show_end(false)


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	var pause_key: bool = event.keycode == KEY_P or event.keycode == KEY_ESCAPE
	if screen == Screen.PLAYING:
		if event.keycode == KEY_ESCAPE and TestHooks.planted("esc_quits"):
			get_viewport().set_input_as_handled()
			_show_title()
		elif pause_key:
			get_viewport().set_input_as_handled()
			_pause()
		elif event.keycode == KEY_TAB and _field.tip != "":
			get_viewport().set_input_as_handled()
			_tutorial = null
			_field.tip = ""
			Settings.set_value("tips", false)
	elif screen == Screen.PAUSED and not _in_settings and event.keycode == KEY_P:
		get_viewport().set_input_as_handled()
		_resume()


func _notification(what: int) -> void:
	var focus_lost := what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_WM_WINDOW_FOCUS_OUT
	if focus_lost and screen == Screen.PLAYING:
		_pause()


func _show_title() -> void:
	screen = Screen.TITLE
	run = null
	_tutorial = null
	_in_settings = false
	Audio.duck(false)
	Audio.music("menu")
	var rng := RandomNumberGenerator.new()
	rng.seed = _seed
	var demo := Board.new(0.2)  # 3 balls x 20% is far less than the field, so nothing locks
	demo.spawn_balls(TITLE_BALLS, rng)
	_field.show_board(demo, null)
	_field.tip = ""
	_field.running = true
	_field.input_enabled = false
	_screens.show_title(_best_score, _best_stage)


func _start_run() -> void:
	Audio.duck(false)
	_in_settings = false
	run = Run.new(_seed)
	run.stage = _start_stage
	run.endless = StageTable.is_endless(_start_stage)
	if TestHooks.autoplay != "":
		_advisor = Bot.new(TestHooks.autoplay, run.run_seed * 7919 + 17)
		_advisor.advise_only = true
	_seed = randi()
	_begin_stage()


func _begin_stage() -> void:
	screen = Screen.INTRO
	Audio.music("play")
	_field.show_board(run.start_stage(), run)
	if _advisor:
		_advisor.begin(run.board)
	_field.running = false
	_field.input_enabled = false
	_field.tip = ""
	_tutorial = Tutorial.new(run.stage) if Settings.value("tips") and Tutorial.has_tips(run.stage) else null
	_screens.show_intro(run)


func _begin_play() -> void:
	screen = Screen.PLAYING
	_screens.hide_all()
	_field.running = true
	_field.input_enabled = true


func _pause() -> void:
	if screen != Screen.PLAYING:
		return
	screen = Screen.PAUSED
	_field.running = false
	_field.input_enabled = false
	Audio.duck(true)
	Audio.play("ui_back")
	_screens.show_pause(run)


func _resume() -> void:
	if screen != Screen.PAUSED:
		return
	Audio.duck(false)
	Audio.play("ui_select")
	_begin_play()


func _open_settings() -> void:
	_settings_from_pause = screen == Screen.PAUSED
	_in_settings = true
	_screens.show_settings()


func _close_settings() -> void:
	_in_settings = false
	if _settings_from_pause and screen == Screen.PAUSED:
		_screens.show_pause(run)
	else:
		_screens.show_title(_best_score, _best_stage)


func _on_board_event(event: Dictionary) -> void:
	# The step that clears a stage reports "cleared" before its "wall_finished", so events still
	# count while the stage ends; otherwise the clearing wall's capture would never score.
	if run == null or not (screen == Screen.PLAYING or screen == Screen.ENDING):
		return
	run.handle_event(event)
	if screen != Screen.PLAYING:
		return
	_tutorial_event(event["type"])
	if event["type"] == "cleared" or event["type"] == "game_over":
		screen = Screen.ENDING
		_end_timer = END_DELAY
		_field.input_enabled = false
		_field.tip = ""


func _tutorial_event(type: String) -> void:
	if _tutorial:
		_tutorial.on_event(type)
		_field.tip = _tutorial.tip


func _after_clear() -> void:
	if run.pending_levels > 0:
		screen = Screen.PICK
		run.open_offer()
		_screens.show_pick(run)
	else:
		run.advance()
		_begin_stage()


func _on_pick(index: int) -> void:
	if screen != Screen.PICK:
		return
	Audio.play("pick")
	if TestHooks.planted("double_pick") and index >= 0 and index < run.offer.size():
		run.upgrades[run.offer[index]] = run.stacks(run.offer[index]) + 1
	run.pick(index)
	_after_clear()


func _on_reroll() -> void:
	if screen == Screen.PICK and run.reroll():
		_screens.show_pick(run)


func _go_endless() -> void:
	if screen != Screen.OVER or run == null:
		return
	run.endless = true
	_after_clear()


func _show_end(victory: bool) -> void:
	screen = Screen.OVER
	Audio.music("menu")
	if victory:
		Audio.play("victory")
	var new_best := run.score > _best_score
	if new_best:
		_best_score = run.score
	_best_stage = maxi(_best_stage, run.stage)
	_save_best()
	_log_run(victory)
	_screens.show_end(run, victory, _best_score, new_best)


func _log_run(victory: bool) -> void:
	var file := FileAccess.open(RUN_LOG, FileAccess.READ_WRITE) if FileAccess.file_exists(RUN_LOG) else FileAccess.open(RUN_LOG, FileAccess.WRITE)
	if file == null:
		return
	var entry := run.summary(victory)
	entry["date"] = Time.get_datetime_string_from_system()
	entry["staged"] = _start_stage != 1
	entry["source"] = TestHooks.run_source()
	entry["build"] = _build_id
	file.seek_end()
	file.store_line(JSON.stringify(entry))


func _load_best() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) == OK:
		_best_score = config.get_value("best", "score", 0)
		_best_stage = config.get_value("best", "stage", 0)


func _save_best() -> void:
	if TestHooks.planted("no_best_save"):
		return
	var config := ConfigFile.new()
	config.load(SAVE_PATH)
	config.set_value("best", "score", _best_score)
	config.set_value("best", "stage", _best_stage)
	config.save(SAVE_PATH)


## Everything a test needs to know, read-only and rebuilt from the real state. Published by
## TestHooks in test builds only. Cells are in grid units; screen = FIELD_ORIGIN + cell * CELL.
func test_state() -> Dictionary:
	var state := _summary_state()
	state.merge({"tip": _field.tip, "best": {"score": _best_score, "stage": _best_stage},
		"settings_values": Settings.values(), "field": {"origin": [_field.FIELD_ORIGIN.x, _field.FIELD_ORIGIN.y],
		"cell": _field.CELL}, "hover": [_field.hover_cell.x, _field.hover_cell.y],
		"controls": _screens.controls(), "effects": _field.effects_state()})
	if _advisor:
		var advice: Array = []
		for entry in _advisor.advice:
			var item := entry.duplicate()
			if item.has("cell"):
				item["cell"] = [item["cell"].x, item["cell"].y]
			if item.has("at"):
				item["at"] = [item["at"].x, item["at"].y]
			advice.append(item)
		state["advice"] = advice
	if run:
		state["run"] = {"seed": run.run_seed, "endless": run.endless, "xp": int(run.xp),
			"xp_needed": int(run.xp_needed()), "pending_levels": run.pending_levels,
			"upgrades": run.upgrades.duplicate(), "offer": run.offer.duplicate(),
			"rerolls_left": run.rerolls_left}
	var board := _field.board as Board
	if board and run:
		var rows: Array[String] = []
		for y in board.grid.height:
			var row := ""
			for x in board.grid.width:
				row += "#" if board.grid.is_filled(Vector2i(x, y)) else "."
			rows.append(row)
		var balls: Array = []
		for ball in board.balls:
			balls.append({"x": snappedf(ball.position.x, 0.01), "y": snappedf(ball.position.y, 0.01),
				"vx": snappedf(ball.velocity.x, 0.01), "vy": snappedf(ball.velocity.y, 0.01),
				"r": snappedf(ball.radius, 0.01), "kind": Ball.KIND_NAMES[ball.kind], "locked": ball.locked})
		var halves: Array = []
		for half in board.halves:
			var rect := half.rect()
			halves.append({"wall": half.wall_id, "dir": [half.direction.x, half.direction.y],
				"rect": [snappedf(rect.position.x, 0.01), snappedf(rect.position.y, 0.01),
					snappedf(rect.size.x, 0.01), snappedf(rect.size.y, 0.01)]})
		var pens: Array = []
		for pen in board.pens:
			pens.append({"area": pen.area, "limit": snappedf(pen.limit, 0.1), "locked": pen.locked,
				"balls": pen.balls.size(), "centre": [snappedf(pen.centroid.x, 0.1), snappedf(pen.centroid.y, 0.1)]})
		state["board"] = {"state": Board.State.keys()[board.state], "time": snappedf(board.time, 0.001),
			"lives": board.lives, "pen_limit_cells": snappedf(board.pen_limit_cells(), 0.1),
			"walls_building": board.walls_building(), "max_walls": board.max_walls,
			"wall_speed": board.wall_speed, "walls_started": board.walls_started,
			"crossbeam": board.crossbeam, "active": board.active, "active_ready": board.active_ready(),
			"active_charge": board.active_charge, "active_cost": board.active_cost,
			"frozen": board.is_frozen(), "shield_hits": board.shield_hits,
			"rows": rows, "balls": balls, "halves": halves, "pens": pens}
	return state
