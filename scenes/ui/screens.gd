extends CanvasLayer
## The menu screens, built in code: title, stage intro, stage clear, upgrade pick, end of run,
## pause and settings. One screen shows at a time over the field. Mouse, or arrows and Enter;
## Esc goes back where there's somewhere to go back to. Exactly one control has focus, and the
## pointer moves it. Focus changes and presses make a sound.

signal start_pressed
signal begin_pressed
signal continue_pressed
signal pick_pressed(index: int)
signal reroll_pressed
signal again_pressed
signal title_pressed
signal endless_pressed
signal settings_pressed
signal resume_pressed
signal restart_pressed
signal settings_closed

## Seconds a destructive button stays armed for its confirming second press.
const CONFIRM_TIME := 3.0
## Focus sounds are skipped this soon after a screen opens (its first focus is automatic).
const QUIET_AFTER_OPEN := 0.15

var _root: Control
var _cards: Array[Button] = []
## What Esc does on the current screen, if anything.
var _back_action := Callable()
var _opened_at := 0.0


## The game's name drawn in cells, like the field's walls.
class Wordmark extends Control:
	const CELL := 12.0
	const GAP := 2.0
	const LETTERS := {
		"B": ["####.", "#...#", "####.", "#...#", "####."],
		"O": [".###.", "#...#", "#...#", "#...#", ".###."],
		"X": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
		"E": ["#####", "#....", "####.", "#....", "#####"],
		"D": ["####.", "#...#", "#...#", "#...#", "####."],
		"I": ["###", ".#.", ".#.", ".#.", "###"],
		"N": ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
		" ": ["..", "..", "..", "..", ".."],
	}
	const TEXT := "BOXED IN"
	var _shown_at := 0.0

	func _ready() -> void:
		custom_minimum_size = Vector2(_columns() * CELL, 5 * CELL + 16)
		_shown_at = Time.get_ticks_msec() / 1000.0

	func _columns() -> int:
		var count := 0
		for ch in TEXT:
			count += LETTERS[ch][0].length() + 1
		return count - 1

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var now := Time.get_ticks_msec() / 1000.0 - _shown_at
		var reduced: bool = Settings.reduced_motion()
		var x0 := (size.x - _columns() * CELL) * 0.5
		var column := 0
		var a := Palette.c("half_a")
		var b := Palette.c("half_b")
		var total := float(_columns())
		for ch in TEXT:
			var rows: Array = LETTERS[ch]
			for r in rows.size():
				var row: String = rows[r]
				for c in row.length():
					if row[c] != "#":
						continue
					var x := column + c
					var delay := x * 0.025 + r * 0.02
					var k := 1.0 if reduced else clampf((now - delay) / 0.25, 0.0, 1.0)
					if k <= 0.0:
						continue
					var color := a.lerp(b, x / total).lerp(Color.WHITE, (1.0 - k) * 0.8)
					var at := Vector2(x0 + x * CELL, r * CELL + (1.0 - k) * -10.0)
					draw_rect(Rect2(at + Vector2(GAP, GAP) * 0.5, Vector2(CELL - GAP, CELL - GAP)), Color(color, k))
			column += rows[0].length() + 1
		# A box around "IN".
		var in_from := (_columns() - 9) * CELL + x0 - 6.0
		var box := Rect2(in_from, -6.0, 9 * CELL + 12.0, 5 * CELL + 12.0)
		var box_k := 1.0 if reduced else clampf((now - 0.7) / 0.3, 0.0, 1.0)
		draw_rect(box, Color(Palette.c("good"), box_k), false, 2.0)


func _ready() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_root)
	_apply_theme()
	Settings.changed.connect(_apply_theme)
	hide_all()


func _apply_theme() -> void:
	_root.theme = _make_theme()


func is_open() -> bool:
	return _root.visible


func hide_all() -> void:
	for child in _root.get_children():
		_root.remove_child(child)
		child.queue_free()
	_cards.clear()
	_back_action = Callable()
	_root.visible = false


func show_title(best_score: int, best_stage: int) -> void:
	var box := _open(620, 0.35)
	box.add_child(Wordmark.new())
	box.add_child(_label("Box every ball into a pen small enough.\nNo clock. Just nerve.", 20, Palette.c("text_dim")))
	if best_score > 0:
		box.add_child(_label("Best  %s   ·   furthest  %s" % [Run.thousands(best_score), _stage_name(best_stage)], 18, Palette.c("xp")))
	box.add_child(_spacer(4))
	box.add_child(_button("Start run", start_pressed.emit))
	box.add_child(_button("Settings", settings_pressed.emit))
	box.add_child(_label("Click: build a wall   ·   Right-click or Space: turn   ·   Esc or P: pause", 14, Palette.c("text_dim")))
	_focus_first(box)


func show_intro(run: Run) -> void:
	var box := _open(600)
	var title := _stage_name(run.stage).capitalize() if run.is_endless_stage() else "Stage %d / %d" % [run.stage, run.stage_count()]
	box.add_child(_label(title, 44, Palette.c("text")))
	var balls := run.ball_count()
	var limit_cells := floori(run.pen_limit() * Grid.new().playable_area)
	box.add_child(_label("%d ball%s   ·   pen limit %s per ball (%d cells)" % [balls, "s" if balls > 1 else "", Run.percent(run.pen_limit()), limit_cells], 20, Palette.c("text")))
	var fresh := StageTable.new_kinds(run.stage)
	var shown := {}
	for kind in run.ball_kinds():
		if shown.has(kind):
			continue
		shown[kind] = true
		var is_new: bool = fresh.has(kind)
		var line := "%s%s: %s" % ["New!  " if is_new else "", Ball.KIND_NAMES[kind], Ball.KIND_TEXT[kind]]
		box.add_child(_label(line, 17, Palette.c("xp") if is_new else Palette.c("text_dim")))
	box.add_child(_label("Lives  %d" % run.lives, 20, Palette.c("text_dim")))
	if run.stage == 1 and not Settings.value("tips"):
		box.add_child(_label("Click to build a wall. Right-click or Space turns it.\nA ball that touches a growing wall breaks it and costs a life.\nBox every ball into a pen no bigger than its limit.", 16, Palette.c("text_dim")))
	box.add_child(_button("Start stage", begin_pressed.emit))
	_focus_first(box)


func show_clear(run: Run, breakdown: Dictionary, tips_finished := false) -> void:
	var box := _open(520)
	box.add_child(_label("Stage %d clear" % run.stage, 44, Palette.c("good")))
	var rows := GridContainer.new()
	rows.columns = 2
	rows.add_theme_constant_override("h_separation", 48)
	rows.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_row(rows, "Captures", breakdown["captures"])
	if breakdown["combos"] > 0:
		_row(rows, "Combos", breakdown["combos"])
	_row(rows, "Squeeze bonus", breakdown["squeeze"])
	if breakdown["clean"] > 0:
		_row(rows, "Clean clear", breakdown["clean"])
	_row(rows, "Stage total", breakdown["total"], Palette.c("text"))
	_row(rows, "Score", run.score, Palette.c("text"))
	box.add_child(rows)
	box.add_child(_label("+%d life   ·   Lives  %d" % [breakdown["lives_gained"], run.lives], 18, Palette.c("text_dim")))
	if tips_finished:
		box.add_child(_label("That's all the tips. You can turn them back on in Settings.", 15, Palette.c("text_dim")))
	if run.pending_levels > 0:
		box.add_child(_label("Level %d!  %d upgrade%s to pick" % [run.level, run.pending_levels, "s" if run.pending_levels > 1 else ""], 20, Palette.c("xp")))
		box.add_child(_button("Pick upgrade", continue_pressed.emit))
	else:
		box.add_child(_button("Next stage", continue_pressed.emit))
	_focus_first(box)


func show_pick(run: Run) -> void:
	var box := _open(900)
	box.add_child(_label("Pick an upgrade", 40, Palette.c("xp")))
	if run.pending_levels > 1:
		box.add_child(_label("%d more after this one" % (run.pending_levels - 1), 16, Palette.c("text_dim")))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	var held := run.active()
	for i in run.offer.size():
		var replaces := ""
		if Upgrades.is_active(run.offer[i]) and held != "" and held != run.offer[i]:
			replaces = Upgrades.find(held)["name"]
		var card := _card(Upgrades.find(run.offer[i]), run.stacks(run.offer[i]), i, replaces)
		row.add_child(card)
		_cards.append(card)
	box.add_child(row)
	var reroll := _button("Reroll  (%d left)" % run.rerolls_left, reroll_pressed.emit)
	reroll.disabled = run.rerolls_left <= 0
	if reroll.disabled:
		reroll.focus_mode = Control.FOCUS_NONE
	box.add_child(reroll)
	box.add_child(_label("1 / 2 / 3 to pick   ·   R to reroll", 14, Palette.c("text_dim")))
	if not _cards.is_empty():
		_focus_later(_cards[0])


func show_end(run: Run, victory: bool, best_score: int, new_best: bool) -> void:
	var box := _open(560)
	if victory:
		box.add_child(_label("Victory!", 56, Palette.c("good")))
		box.add_child(_label("All %d stages boxed in." % run.stage_count(), 20, Palette.c("text")))
	else:
		box.add_child(_label("Out of lives", 56, Palette.c("bad")))
		if run.is_endless_stage():
			box.add_child(_label("Reached %s" % _stage_name(run.stage), 20, Palette.c("text")))
		else:
			box.add_child(_label("Reached stage %d of %d" % [run.stage, run.stage_count()], 20, Palette.c("text")))
	box.add_child(_label("Score  %s" % Run.thousands(run.score), 32, Palette.c("text")))
	if new_best:
		box.add_child(_label("New best!", 20, Palette.c("xp")))
	else:
		box.add_child(_label("Best  %s" % Run.thousands(best_score), 18, Palette.c("text_dim")))
	box.add_child(_label("Level %d" % run.level, 18, Palette.c("text_dim")))
	var names := _upgrade_names(run)
	if names != "":
		box.add_child(_label(names, 16, Palette.c("text_dim")))
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	if victory:
		box.add_child(_label("Keep going in Endless: more balls, tighter pens, score is all that counts.", 16, Palette.c("text_dim")))
		buttons.add_child(_button("Endless", endless_pressed.emit))
	buttons.add_child(_button("Play again", again_pressed.emit))
	buttons.add_child(_button("Title", title_pressed.emit))
	box.add_child(buttons)
	_focus_first(buttons)


func show_pause(run: Run) -> void:
	var box := _open(480)
	box.add_child(_label("Paused", 44, Palette.c("text")))
	var where := _stage_name(run.stage).capitalize() if run.is_endless_stage() else "Stage %d / %d" % [run.stage, run.stage_count()]
	box.add_child(_label("%s   ·   Score %s" % [where, Run.thousands(run.score)], 18, Palette.c("text_dim")))
	var names := _upgrade_names(run)
	if names != "":
		box.add_child(_label(names, 15, Palette.c("text_dim")))
	box.add_child(_spacer(4))
	box.add_child(_button("Resume", resume_pressed.emit))
	box.add_child(_button("Settings", settings_pressed.emit))
	box.add_child(_confirm_button("Restart run", "Restart? Press again", restart_pressed.emit))
	box.add_child(_confirm_button("Quit to title", "Quit? Press again", title_pressed.emit))
	box.add_child(_label("Esc or P to resume", 14, Palette.c("text_dim")))
	_back_action = resume_pressed.emit
	_focus_first(box)


func show_settings() -> void:
	var box := _open(600, 0.8)
	box.add_theme_constant_override("separation", 10)
	box.add_child(_label("Settings", 36, Palette.c("text")))
	var first: Control = null
	for entry in Settings.SCHEMA:
		var control := _setting_row(box, entry)
		if first == null:
			first = control
	if not Settings.storage_ok:
		box.add_child(_label("Your browser isn't letting the game save, so settings will reset when you leave.", 15, Palette.c("bad")))
	box.add_child(_button("Back", _close_settings))
	box.add_child(_label("Arrows move and adjust   ·   Enter toggles   ·   Esc goes back", 14, Palette.c("text_dim")))
	_back_action = _close_settings
	_focus_later(first)


func _close_settings() -> void:
	Audio.play("ui_back")
	settings_closed.emit()


## One setting from the schema: a slider for a volume, a switch for an option.
func _setting_row(box: VBoxContainer, entry: Dictionary) -> Control:
	var key: String = entry["key"]
	var current: Variant = Settings.value(key)
	if entry["default"] is float:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 16)
		var name_label := _label(entry["label"], 18, Palette.c("text"))
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		name_label.custom_minimum_size = Vector2(160, 0)
		name_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		row.add_child(name_label)
		var slider := HSlider.new()
		slider.min_value = 0
		slider.max_value = 100
		slider.step = 5
		slider.value = roundf(current * 100.0)
		slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		slider.custom_minimum_size = Vector2(0, 28)
		var value_label := _label("%d%%" % roundi(current * 100.0), 18, Palette.c("text_dim"))
		value_label.custom_minimum_size = Vector2(56, 0)
		value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		value_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		slider.value_changed.connect(func(v: float) -> void:
			value_label.text = "%d%%" % roundi(v)
			Settings.set_value(key, v / 100.0)
			Audio.play("ui_move"))
		_wire_sounds(slider, false)
		# The slider draws no focus ring, so its name lights up instead.
		slider.focus_entered.connect(func() -> void: name_label.add_theme_color_override("font_color", Palette.c("focus")))
		slider.focus_exited.connect(func() -> void: name_label.add_theme_color_override("font_color", Palette.c("text")))
		row.add_child(slider)
		row.add_child(value_label)
		box.add_child(row)
		return slider
	# An option: its name and what it does on the left, an On/Off switch on the right.
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	var text_box := VBoxContainer.new()
	text_box.add_theme_constant_override("separation", 0)
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name_label := _label(entry["label"], 18, Palette.c("text"))
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	text_box.add_child(name_label)
	if entry.has("hint"):
		var hint := _label(entry["hint"], 14, Palette.c("text_dim"))
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		text_box.add_child(hint)
	row.add_child(text_box)
	var toggle := Button.new()
	toggle.toggle_mode = true
	toggle.button_pressed = current
	toggle.custom_minimum_size = Vector2(88, 40)
	toggle.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var show_state := func(on: bool) -> void:
		toggle.text = "On" if on else "Off"
		var color := Palette.c("good") if on else Palette.c("text_dim")
		for color_name in ["font_color", "font_focus_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
			toggle.add_theme_color_override(color_name, color)
	show_state.call(current)
	toggle.toggled.connect(func(on: bool) -> void:
		show_state.call(on)
		Settings.set_value(key, on)
		Audio.play("ui_select"))
	_wire_sounds(toggle, false)
	row.add_child(toggle)
	box.add_child(row)
	return toggle


## "stage 7", or "Endless 3" for stage 15.
static func _stage_name(number: int) -> String:
	if StageTable.is_endless(number):
		return "Endless %d" % (number - StageTable.count())
	return "stage %d" % number


static func _upgrade_names(run: Run) -> String:
	var names: Array[String] = []
	for upgrade in Upgrades.ALL:
		var count := run.stacks(upgrade["id"])
		if count > 0:
			names.append(upgrade["name"] + (" ×%d" % count if count > 1 else ""))
	return ", ".join(names)


func _unhandled_input(event: InputEvent) -> void:
	if not _root.visible:
		return
	if event.is_action_pressed("ui_cancel") and _back_action.is_valid():
		get_viewport().set_input_as_handled()
		_back_action.call()
		return
	if _cards.is_empty() or not (event is InputEventKey and event.pressed and not event.echo):
		return
	var index := -1
	match event.keycode:
		KEY_1: index = 0
		KEY_2: index = 1
		KEY_3: index = 2
		KEY_R:
			get_viewport().set_input_as_handled()
			Audio.play("ui_select")
			reroll_pressed.emit()
			return
	if index >= 0 and index < _cards.size():
		get_viewport().set_input_as_handled()
		pick_pressed.emit(index)


## Clears the screen and opens a centred panel; returns its content box.
func _open(width: float, dim := 0.7) -> VBoxContainer:
	hide_all()
	_root.visible = true
	_opened_at = Time.get_ticks_msec() / 1000.0
	var shade := ColorRect.new()
	shade.color = Color(Palette.c("background"), dim)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(width, 0)
	center.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	panel.add_child(box)
	return box


func _label(text: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	return label


func _spacer(height: float) -> Control:
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, height)
	return spacer


func _button(text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(220, 50)
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(action)
	_wire_sounds(button, true)
	return button


## A button for something hard to undo: the first press arms it, a second press within
## CONFIRM_TIME acts. Moving focus away disarms it.
func _confirm_button(text: String, confirm_text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(220, 50)
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var armed_at := [-100.0]
	var disarm := func() -> void:
		armed_at[0] = -100.0
		button.text = text
		button.remove_theme_color_override("font_color")
		button.remove_theme_color_override("font_focus_color")
		button.remove_theme_color_override("font_hover_color")
	button.pressed.connect(func() -> void:
		var now := Time.get_ticks_msec() / 1000.0
		if now - armed_at[0] <= CONFIRM_TIME:
			action.call()
			return
		armed_at[0] = now
		button.text = confirm_text
		for color_name in ["font_color", "font_focus_color", "font_hover_color"]:
			button.add_theme_color_override(color_name, Palette.c("bad"))
		Audio.play("ui_back"))
	button.focus_exited.connect(disarm)
	_wire_sounds(button, false)
	return button


## Focus follows the pointer; focus changes tick; presses (if `press_sound`) chime.
func _wire_sounds(control: Control, press_sound: bool) -> void:
	control.mouse_entered.connect(func() -> void:
		if control.focus_mode != Control.FOCUS_NONE and not control.has_focus():
			control.grab_focus())
	control.focus_entered.connect(func() -> void:
		if Time.get_ticks_msec() / 1000.0 - _opened_at > QUIET_AFTER_OPEN:
			Audio.play("ui_move"))
	if press_sound and control is BaseButton:
		(control as BaseButton).pressed.connect(func() -> void: Audio.play("ui_select"))


func _row(grid: GridContainer, title: String, value: int, color := Color.TRANSPARENT) -> void:
	if color == Color.TRANSPARENT:
		color = Palette.c("text_dim")
	var left := _label(title, 20, color)
	left.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	left.autowrap_mode = TextServer.AUTOWRAP_OFF
	var right := _label(Run.thousands(value), 20, color)
	right.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	right.autowrap_mode = TextServer.AUTOWRAP_OFF
	grid.add_child(left)
	grid.add_child(right)


func _card(upgrade: Dictionary, owned: int, index: int, replaces := "") -> Button:
	var card := Button.new()
	card.custom_minimum_size = Vector2(260, 230)
	card.pressed.connect(func() -> void: pick_pressed.emit(index))
	_wire_sounds(card, false)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	card.add_child(margin)
	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_theme_constant_override("separation", 10)
	margin.add_child(box)
	var rarity: int = upgrade["rarity"]
	var rarity_color := Palette.c(["common", "rare", "epic"][rarity])
	box.add_child(_label("%d   %s" % [index + 1, Upgrades.RARITY_NAMES[rarity]], 14, rarity_color))
	box.add_child(_label(upgrade["name"], 26, Palette.c("text")))
	box.add_child(_label(upgrade["text"], 17, Palette.c("text_dim")))
	if upgrade["max"] > 1 and upgrade["max"] < 99:
		box.add_child(_label("Owned %d / %d" % [owned, upgrade["max"]], 14, Palette.c("text_dim")))
	if replaces != "":
		box.add_child(_label("Replaces %s" % replaces, 14, Palette.c("bad")))
	for label in box.get_children():
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# A strip along the top in the rarity's colour (rarity is also named in text).
	var strip := ColorRect.new()
	strip.color = rarity_color
	strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	strip.set_anchors_preset(Control.PRESET_TOP_WIDE)
	strip.custom_minimum_size = Vector2(0, 4)
	card.add_child(strip)
	return card


func _focus_first(container: Control) -> void:
	for child in container.get_children():
		if child is Button and child.focus_mode != Control.FOCUS_NONE:
			_focus_later(child)
			return


## Focuses a control at the end of the frame, unless another screen replaced it by then.
static func _focus_later(control: Control) -> void:
	if control == null:
		return
	var grab := func() -> void:
		if is_instance_valid(control) and control.is_inside_tree():
			control.grab_focus()
	grab.call_deferred()


func _make_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font_size = 20
	var panel := StyleBoxFlat.new()
	panel.bg_color = Palette.c("panel")
	panel.border_color = Palette.c("panel_edge")
	panel.set_border_width_all(2)
	panel.set_corner_radius_all(12)
	panel.set_content_margin_all(32)
	theme.set_stylebox("panel", "PanelContainer", panel)
	var focus := StyleBoxFlat.new()
	focus.draw_center = false
	focus.border_color = Palette.c("focus")
	focus.set_border_width_all(3)
	focus.set_corner_radius_all(8)
	focus.set_expand_margin_all(3)
	var states := {"normal": Palette.c("button"), "hover": Palette.c("button_hover"), "pressed": Palette.c("panel"), "disabled": Palette.c("panel")}
	for state in states:
		var style := StyleBoxFlat.new()
		style.bg_color = states[state]
		style.set_corner_radius_all(8)
		style.set_content_margin_all(12)
		theme.set_stylebox(state, "Button", style)
	var pressed_on := StyleBoxFlat.new()
	pressed_on.bg_color = Palette.c("button")
	pressed_on.border_color = Palette.c("good")
	pressed_on.set_border_width_all(2)
	pressed_on.set_corner_radius_all(8)
	pressed_on.set_content_margin_all(12)
	theme.set_stylebox("pressed", "Button", pressed_on)
	theme.set_stylebox("hover_pressed", "Button", pressed_on)
	theme.set_stylebox("focus", "Button", focus)
	theme.set_stylebox("focus", "HSlider", focus)
	for color_name in ["font_color", "font_hover_color", "font_focus_color", "font_pressed_color", "font_hover_pressed_color"]:
		theme.set_color(color_name, "Button", Palette.c("text"))
	theme.set_color("font_disabled_color", "Button", Palette.c("text_dim"))
	var track := StyleBoxFlat.new()
	track.bg_color = Palette.c("grid_line")
	track.set_corner_radius_all(4)
	track.content_margin_top = 4
	track.content_margin_bottom = 4
	theme.set_stylebox("slider", "HSlider", track)
	var fill := StyleBoxFlat.new()
	fill.bg_color = Palette.c("focus")
	fill.set_corner_radius_all(4)
	fill.content_margin_top = 4
	fill.content_margin_bottom = 4
	theme.set_stylebox("grabber_area", "HSlider", fill)
	theme.set_stylebox("grabber_area_highlight", "HSlider", fill)
	return theme
