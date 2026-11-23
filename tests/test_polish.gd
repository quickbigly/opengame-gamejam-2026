extends TestSuite
## M4: tutorial tips, settings, palettes and sound files.


func test_stage_one_tips_follow_the_player() -> void:
	var tutorial := Tutorial.new(1)
	check(tutorial.tip.begins_with("Click"), "first tip: build")
	tutorial.update(30.0)
	check(tutorial.tip.begins_with("Click"), "waits for a wall, however long")
	tutorial.on_event("wall_started")
	check(tutorial.tip.begins_with("Right-click"), "then: turn")
	tutorial.on_event("turned")
	check(tutorial.tip.begins_with("A ball"), "then: danger")
	tutorial.update(4.0)
	check(tutorial.tip.begins_with("A ball"), "danger shows for a while")
	tutorial.update(4.0)
	check(tutorial.tip.begins_with("Space"), "then: capture and squeeze")
	tutorial.update(60.0)
	check(tutorial.tip.begins_with("Space"), "until the stage clears")
	tutorial.on_event("cleared")
	check_equal(tutorial.tip, "", "no tip after the clear")


func test_turn_tip_gives_up_after_a_few_walls() -> void:
	var tutorial := Tutorial.new(1)
	for i in 4:
		tutorial.on_event("wall_started")
	check(tutorial.tip.begins_with("A ball"), "skipped the turn tip")


func test_a_tip_for_something_already_done_is_skipped() -> void:
	var tutorial := Tutorial.new(1)
	tutorial.on_event("turned")  # turned before building anything
	tutorial.on_event("wall_started")
	check(tutorial.tip.begins_with("A ball"), "no turn tip: the player already turned")


func test_only_stages_one_and_two_have_tips() -> void:
	check(Tutorial.has_tips(1) and Tutorial.has_tips(2), "stages 1 and 2")
	check(not Tutorial.has_tips(3), "not stage 3")
	check_equal(Tutorial.new(3).tip, "", "no tip on stage 3")


func test_settings_sanitize() -> void:
	var settings: GDScript = load("res://scripts/settings.gd")
	check_equal(settings.sanitize("music_volume", 0.5), 0.5, "a volume")
	check_equal(settings.sanitize("music_volume", 3), 1.0, "clamped high")
	check_equal(settings.sanitize("music_volume", -1.0), 0.0, "clamped low")
	check_equal(settings.sanitize("music_volume", "loud"), 0.6, "junk gives the default")
	check_equal(settings.sanitize("music_volume", NAN), 0.6, "NaN gives the default")
	check_equal(settings.sanitize("reduced_motion", true), true, "a switch")
	check_equal(settings.sanitize("reduced_motion", 0), false, "zero is off")
	check_equal(settings.sanitize("show_grid", "yes"), true, "junk gives the default")
	check_equal(settings.sanitize("no_such_setting", 1), null, "unknown key")


func test_settings_keys_are_unique() -> void:
	var settings: GDScript = load("res://scripts/settings.gd")
	var seen := {}
	for entry in settings.SCHEMA:
		check(not seen.has(entry["key"]), "duplicate key " + entry["key"])
		seen[entry["key"]] = true
		check(entry.has("label"), entry["key"] + " has a label")


func test_palettes_cover_the_same_names() -> void:
	for color_name in Palette.COLORBLIND:
		check(Palette.DEFAULT.has(color_name), "colour-blind %s has a default" % color_name)
	Palette.colorblind = true
	var cb_good := Palette.c("good")
	var cb_bad := Palette.c("bad")
	Palette.colorblind = false
	check(cb_good != Palette.c("good"), "colour-blind changes good")
	check(cb_bad != Palette.c("bad"), "colour-blind changes bad")


func test_every_sound_file_is_there() -> void:
	var audio: GDScript = load("res://scripts/audio.gd")
	var constants := audio.get_script_constant_map()
	for sound_name in constants["SOUNDS"]:
		var stream: AudioStream = load("res://audio/%s.wav" % sound_name)
		check(stream != null, sound_name + " loads")
		check(constants["LEVELS"].has(sound_name), sound_name + " has a level")
		if stream:
			check(stream.get_length() > 0.0 and stream.get_length() < 3.0, sound_name + " is a short one-shot")


func test_music_loops() -> void:
	for loop_name in ["menu", "play"]:
		var stream: AudioStreamWAV = load("res://audio/music_%s.wav" % loop_name)
		check(stream != null, loop_name + " loads")
		if stream:
			check_equal(stream.loop_mode, AudioStreamWAV.LOOP_FORWARD, loop_name + " loops")
			check(stream.get_length() > 20.0, loop_name + " is a long loop")
