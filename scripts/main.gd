extends Node
## Runs the game's flow: title -> stage intro -> play -> stage clear -> upgrade picks -> next
## stage, ending in victory after the last stage (with the offer to go on into Endless) or
## game over. Each finished run is appended to RUN_LOG, so real runs can be compared with the
## balance bot's (`dev -Balance --real`).
##
## Command-line options (after --, e.g. `dev --seed=42 --stage=6`):
##   --seed=N    seed for the run
##   --stage=N   start the run at stage N (for testing; past the last stage is Endless)

enum Screen { TITLE, INTRO, PLAYING, ENDING, CLEAR, PICK, OVER }

const SAVE_PATH := "user://save.cfg"
## One JSON line per finished run: Run.summary() plus the date and whether it was staged.
const RUN_LOG := "user://runs.jsonl"
## Pause after the last pen locks or the last life goes, before the screen changes.
const END_DELAY := 1.0
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


func _ready() -> void:
	_seed = randi()
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=")
		if parts.size() != 2:
			continue
		match parts[0]:
			"seed": _seed = parts[1].to_int()
			"stage": _start_stage = clampi(parts[1].to_int(), 1, 99)

	_field = preload("res://scenes/game/field.gd").new()
	_field.board_event.connect(_on_board_event)
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

	_load_best()
	_show_title()


func _process(delta: float) -> void:
	if screen != Screen.ENDING:
		return
	_end_timer -= delta
	if _end_timer > 0.0:
		return
	if run.board.state == Board.State.CLEARED:
		var breakdown := run.finish_stage()
		if run.is_final_stage():
			_show_end(true)
		else:
			screen = Screen.CLEAR
			_screens.show_clear(run, breakdown)
	else:
		run.fail_stage()
		_show_end(false)


func _show_title() -> void:
	screen = Screen.TITLE
	run = null
	var rng := RandomNumberGenerator.new()
	rng.seed = _seed
	var demo := Board.new(0.2)  # 3 balls x 20% is far less than the field, so nothing locks
	demo.spawn_balls(TITLE_BALLS, rng)
	_field.show_board(demo, null)
	_field.running = true
	_field.input_enabled = false
	_screens.show_title(_best_score, _best_stage)


func _start_run() -> void:
	run = Run.new(_seed)
	run.stage = _start_stage
	run.endless = StageTable.is_endless(_start_stage)
	_seed = randi()
	_begin_stage()


func _begin_stage() -> void:
	screen = Screen.INTRO
	_field.show_board(run.start_stage(), run)
	_field.running = false
	_field.input_enabled = false
	_screens.show_intro(run)


func _begin_play() -> void:
	screen = Screen.PLAYING
	_screens.hide_all()
	_field.running = true
	_field.input_enabled = true


func _on_board_event(event: Dictionary) -> void:
	if run == null or screen != Screen.PLAYING:
		return
	run.handle_event(event)
	if event["type"] == "cleared" or event["type"] == "game_over":
		screen = Screen.ENDING
		_end_timer = END_DELAY
		_field.input_enabled = false


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
	file.seek_end()
	file.store_line(JSON.stringify(entry))



func _load_best() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) == OK:
		_best_score = config.get_value("best", "score", 0)
		_best_stage = config.get_value("best", "stage", 0)


func _save_best() -> void:
	var config := ConfigFile.new()
	config.load(SAVE_PATH)
	config.set_value("best", "score", _best_score)
	config.set_value("best", "stage", _best_stage)
	config.save(SAVE_PATH)
