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
	_field.turned.connect(func() -> void: _tutorial_event("turned"))
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


## On the web, mirrors the screen to window.boxedIn so a browser test can see where the game is.
func _publish_state() -> void:
	if not OS.has_feature("web"):
		return
	var state := {"screen": Screen.keys()[screen], "vertical": _field.vertical, "settings": _in_settings}
	JavaScriptBridge.eval("window.boxedIn = %s;" % JSON.stringify(state), true)


var _published := ""


func _process(delta: float) -> void:
	var state := "%d %s %s" % [screen, _field.vertical, _in_settings]
	if state != _published:
		_published = state
		_publish_state()
	if screen == Screen.PLAYING and _tutorial:
		_tutorial.update(delta)
		_field.tip = _tutorial.tip
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
		if pause_key:
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
	_seed = randi()
	_begin_stage()


func _begin_stage() -> void:
	screen = Screen.INTRO
	Audio.music("play")
	_field.show_board(run.start_stage(), run)
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
	if run == null or screen != Screen.PLAYING:
		return
	run.handle_event(event)
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
