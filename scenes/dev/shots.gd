extends Node
## A scripted tour of the game's screens that saves a screenshot of each, for checking the look
## without playing. Leaves the player's saved settings as it found them (it doesn't save scores).
##   dev -Shots --out=C:/some/folder

var _out := "user://shots"
var _main: Node


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			_out = arg.trim_prefix("--out=")
	DirAccess.make_dir_recursive_absolute(_out)
	_tour.call_deferred()


func _shot(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(_out.path_join(file_name + ".png"))
	print("saved ", file_name)


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


func _tour() -> void:
	var saved := {}
	for entry in Settings.SCHEMA:
		saved[entry["key"]] = Settings.value(entry["key"])
	Settings.set_value("tips", true)
	Settings.set_value("reduced_motion", false)
	Settings.set_value("colorblind", false)

	_main = preload("res://scenes/main.tscn").instantiate()
	add_child(_main)
	await _wait(1.5)
	await _shot("01_title")

	_main._start_run()
	await _wait(0.5)
	await _shot("02_intro")
	_main._begin_play()
	await _wait(0.3)
	await _shot("03_play_tip")
	var field: Node2D = _main._field
	field._try_wall(Vector2i(30, 16), false)
	await _wait(0.12)
	await _shot("04_growing")
	await _wait(1.2)
	field._try_wall(Vector2i(38, 8), true)
	await _wait(1.0)
	await _shot("05_captured")

	_main._pause()
	await _wait(0.3)
	await _shot("06_pause")
	_main._open_settings()
	await _wait(0.3)
	await _shot("07_settings")
	_main._close_settings()
	_main._resume()

	# A later stage with an active ability and Crossbeam, for the HUD columns.
	var run := Run.new(5)
	run.stage = 10
	run.upgrades = {"freeze": 1, "crossbeam": 1, "quick_build": 2}
	run.level = 7
	_main.run = run
	_main._begin_stage()
	_main._begin_play()
	await _wait(0.8)
	field._try_wall(Vector2i(24, 10), true)
	await _wait(0.1)
	await _shot("08_late_stage")

	Settings.set_value("colorblind", true)
	await _wait(0.6)
	await _shot("09_colorblind")
	Settings.set_value("colorblind", false)

	_main.screen = _main.Screen.CLEAR
	run.pending_levels = 2
	_main._after_clear()
	await _wait(0.3)
	await _shot("10_pick")

	_main._screens.show_end(run, true, 123456, true)
	await _wait(0.3)
	await _shot("11_victory")

	for key in saved:
		Settings.set_value(key, saved[key])
	get_tree().quit()
