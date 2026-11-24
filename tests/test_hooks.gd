extends TestSuite
## The persona playtest hooks (scripts/test_hooks.gd) stay declared and contained: only
## TestHooks reads test flags, every plant is wired in exactly one place, and a release build
## can't turn them on.

const HOOKS_PATH := "res://scripts/test_hooks.gd"
const HOOKS := preload("res://scripts/test_hooks.gd")
## What only TestHooks may read.
const FLAG_READS := ["location.search", "has_feature(\"test_hooks\")"]


func _game_scripts(dir := "res://", found: Array[String] = []) -> Array[String]:
	for sub in DirAccess.get_directories_at(dir):
		if sub.begins_with(".") or sub in ["tests", "build", "addons"]:
			continue
		_game_scripts(dir.path_join(sub), found)
	for file in DirAccess.get_files_at(dir):
		if file.ends_with(".gd"):
			found.append(dir.path_join(file))
	return found


func test_only_test_hooks_reads_test_flags() -> void:
	var scripts := _game_scripts()
	check(scripts.size() > 10, "found the game's scripts (%d)" % scripts.size())
	for path in scripts:
		if path == HOOKS_PATH:
			continue
		var text := FileAccess.get_file_as_string(path)
		for read in FLAG_READS:
			check(not text.contains(read), "%s reads %s; only TestHooks may" % [path, read])


func test_every_plant_is_wired_once() -> void:
	var uses := {}
	for path in _game_scripts():
		var text := FileAccess.get_file_as_string(path)
		var regex := RegEx.create_from_string("TestHooks\\.planted\\(\"([a-z_]+)\"\\)")
		for found in regex.search_all(text):
			var plant_name := found.get_string(1)
			uses[plant_name] = uses.get(plant_name, 0) + 1
	for plant_name in uses:
		check(HOOKS.PLANTS.has(plant_name), "planted(\"%s\") names a declared plant" % plant_name)
	for plant_name in HOOKS.PLANTS:
		check_equal(uses.get(plant_name, 0), 1, "plant %s is wired in exactly one place" % plant_name)


func test_hooks_are_off_without_flags() -> void:
	var hooks: Node = HOOKS.new()
	check(not hooks.enabled, "off by default")
	check(not hooks.planted("no_meter"), "no plant is on while the hooks are off")
	check_equal(hooks.run_source(), "human", "runs count as a person's")
	hooks.free()


func test_steps_are_handed_out_once() -> void:
	var hooks: Node = HOOKS.new()
	hooks.steps_pending = 300
	check_equal(hooks.take_steps(240), 240, "at most the cap in one frame")
	check_equal(hooks.take_steps(240), 60, "then the rest")
	check_equal(hooks.take_steps(240), 0, "then none")
	check_equal(hooks.steps_taken, 300, "every step counted once")
	hooks.free()


func test_persona_runs_are_labelled() -> void:
	var hooks: Node = HOOKS.new()
	hooks.enabled = true
	hooks.persona = "P2"
	check_equal(hooks.run_source(), "persona:P2", "a persona's runs are labelled as theirs")
	hooks.free()
