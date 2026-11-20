extends CanvasLayer
## The run's menu screens, built in code: title, stage intro, stage clear, upgrade pick and the
## end of a run. One screen shows at a time over the field. Mouse or arrows and Enter.
## Placeholder look; the menu pass is M4.

signal start_pressed
signal begin_pressed
signal continue_pressed
signal pick_pressed(index: int)
signal reroll_pressed
signal again_pressed
signal title_pressed
signal endless_pressed

const COLOR_PANEL := Color("181d2b")
const COLOR_PANEL_EDGE := Color("2c3550")
const COLOR_BUTTON := Color("232a3d")
const COLOR_BUTTON_HOVER := Color("2f3852")
const COLOR_FOCUS := Color("4cc9f0")
const COLOR_TEXT := Color("e8ecf4")
const COLOR_TEXT_DIM := Color("7a8399")
const COLOR_GOOD := Color("7fd8be")
const COLOR_BAD := Color("ff5d73")
const COLOR_XP := Color("c792ea")
const RARITY_COLORS := [Color("a9b4c8"), Color("4cc9f0"), Color("f7b267")]

var _root: Control
var _cards: Array[Button] = []


func _ready() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.theme = _make_theme()
	add_child(_root)
	hide_all()


func hide_all() -> void:
	for child in _root.get_children():
		_root.remove_child(child)
		child.queue_free()
	_cards.clear()
	_root.visible = false


func show_title(best_score: int, best_stage: int) -> void:
	var box := _open(560, 0.35)
	box.add_child(_label("Boxed In", 64, COLOR_TEXT))
	box.add_child(_label("Box every ball into a pen small enough.\nNo clock. Just nerve.", 20, COLOR_TEXT_DIM))
	box.add_child(_spacer(8))
	if best_score > 0:
		box.add_child(_label("Best  %s   ·   furthest  %s" % [Run.thousands(best_score), _stage_name(best_stage)], 18, COLOR_XP))
	box.add_child(_button("Start run", start_pressed.emit))
	_focus_first(box)


func show_intro(run: Run) -> void:
	var box := _open(600)
	var title := _stage_name(run.stage) if run.is_endless_stage() else "Stage %d / %d" % [run.stage, run.stage_count()]
	box.add_child(_label(title, 44, COLOR_TEXT))
	var balls := run.ball_count()
	var limit_cells := floori(run.pen_limit() * Grid.new().playable_area)
	box.add_child(_label("%d ball%s   ·   pen limit %s per ball (%d cells)" % [balls, "s" if balls > 1 else "", Run.percent(run.pen_limit()), limit_cells], 20, COLOR_TEXT))
	var fresh := StageTable.new_kinds(run.stage)
	var shown := {}
	for kind in run.ball_kinds():
		if shown.has(kind):
			continue
		shown[kind] = true
		var is_new: bool = fresh.has(kind)
		var line := "%s%s: %s" % ["New!  " if is_new else "", Ball.KIND_NAMES[kind], Ball.KIND_TEXT[kind]]
		box.add_child(_label(line, 17, COLOR_XP if is_new else COLOR_TEXT_DIM))
	box.add_child(_label("Lives  %d" % run.lives, 20, COLOR_TEXT_DIM))
	if run.stage <= 2:
		box.add_child(_spacer(4))
		box.add_child(_label("Click to build a wall. Right-click or Space turns it.\nA ball that touches a growing wall breaks it and costs a life.\nBox every ball into a pen no bigger than its limit.", 16, COLOR_TEXT_DIM))
	box.add_child(_button("Start stage", begin_pressed.emit))
	_focus_first(box)


func show_clear(run: Run, breakdown: Dictionary) -> void:
	var box := _open(520)
	box.add_child(_label("Stage %d clear" % run.stage, 44, COLOR_GOOD))
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
	_row(rows, "Stage total", breakdown["total"], COLOR_TEXT)
	_row(rows, "Score", run.score, COLOR_TEXT)
	box.add_child(rows)
	box.add_child(_label("+%d life   ·   Lives  %d" % [breakdown["lives_gained"], run.lives], 18, COLOR_TEXT_DIM))
	if run.pending_levels > 0:
		box.add_child(_label("Level %d!  %d upgrade%s to pick" % [run.level, run.pending_levels, "s" if run.pending_levels > 1 else ""], 20, COLOR_XP))
		box.add_child(_button("Pick upgrade", continue_pressed.emit))
	else:
		box.add_child(_button("Next stage", continue_pressed.emit))
	_focus_first(box)


func show_pick(run: Run) -> void:
	var box := _open(900)
	box.add_child(_label("Pick an upgrade", 40, COLOR_XP))
	if run.pending_levels > 1:
		box.add_child(_label("%d more after this one" % (run.pending_levels - 1), 16, COLOR_TEXT_DIM))
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
	reroll.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	box.add_child(reroll)
	box.add_child(_label("1 / 2 / 3 to pick   ·   R to reroll", 14, COLOR_TEXT_DIM))
	if not _cards.is_empty():
		_focus_later(_cards[0])


func show_end(run: Run, victory: bool, best_score: int, new_best: bool) -> void:
	var box := _open(560)
	if victory:
		box.add_child(_label("Victory!", 56, COLOR_GOOD))
		box.add_child(_label("All %d stages boxed in." % run.stage_count(), 20, COLOR_TEXT))
	else:
		box.add_child(_label("Out of lives", 56, COLOR_BAD))
		if run.is_endless_stage():
			box.add_child(_label("Reached %s" % _stage_name(run.stage), 20, COLOR_TEXT))
		else:
			box.add_child(_label("Reached stage %d of %d" % [run.stage, run.stage_count()], 20, COLOR_TEXT))
	box.add_child(_label("Score  %s" % Run.thousands(run.score), 32, COLOR_TEXT))
	if new_best:
		box.add_child(_label("New best!", 20, COLOR_XP))
	else:
		box.add_child(_label("Best  %s" % Run.thousands(best_score), 18, COLOR_TEXT_DIM))
	box.add_child(_label("Level %d" % run.level, 18, COLOR_TEXT_DIM))
	if not run.upgrades.is_empty():
		var names: Array[String] = []
		for upgrade in Upgrades.ALL:
			var count := run.stacks(upgrade["id"])
			if count > 0:
				names.append(upgrade["name"] + (" ×%d" % count if count > 1 else ""))
		box.add_child(_label(", ".join(names), 16, COLOR_TEXT_DIM))
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	if victory:
		box.add_child(_label("Keep going in Endless: more balls, tighter pens, score is all that counts.", 16, COLOR_TEXT_DIM))
		buttons.add_child(_button("Endless", endless_pressed.emit))
	buttons.add_child(_button("Play again", again_pressed.emit))
	buttons.add_child(_button("Title", title_pressed.emit))
	box.add_child(buttons)
	_focus_first(buttons)


## "stage 7", or "Endless 3" for stage 15.
static func _stage_name(number: int) -> String:
	if StageTable.is_endless(number):
		return "Endless %d" % (number - StageTable.count())
	return "stage %d" % number


func _unhandled_input(event: InputEvent) -> void:
	if _cards.is_empty() or not (event is InputEventKey and event.pressed and not event.echo):
		return
	var index := -1
	match event.keycode:
		KEY_1: index = 0
		KEY_2: index = 1
		KEY_3: index = 2
		KEY_R:
			reroll_pressed.emit()
			get_viewport().set_input_as_handled()
			return
	if index >= 0 and index < _cards.size():
		get_viewport().set_input_as_handled()
		pick_pressed.emit(index)


## Clears the screen and opens a centred panel; returns its content box.
func _open(width: float, dim := 0.7) -> VBoxContainer:
	hide_all()
	_root.visible = true
	var shade := ColorRect.new()
	shade.color = Color(0.03, 0.04, 0.07, dim)
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
	button.custom_minimum_size = Vector2(220, 52)
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(action)
	return button


func _row(grid: GridContainer, title: String, value: int, color := COLOR_TEXT_DIM) -> void:
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
	card.custom_minimum_size = Vector2(260, 220)
	card.pressed.connect(func() -> void: pick_pressed.emit(index))
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
	box.add_child(_label("%d   %s" % [index + 1, Upgrades.RARITY_NAMES[rarity]], 14, RARITY_COLORS[rarity]))
	box.add_child(_label(upgrade["name"], 26, COLOR_TEXT))
	box.add_child(_label(upgrade["text"], 17, COLOR_TEXT_DIM))
	if upgrade["max"] > 1 and upgrade["max"] < 99:
		box.add_child(_label("Owned %d / %d" % [owned, upgrade["max"]], 14, COLOR_TEXT_DIM))
	if replaces != "":
		box.add_child(_label("Replaces %s" % replaces, 14, COLOR_BAD))

	for label in box.get_children():
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return card


func _focus_first(container: Control) -> void:
	for child in container.get_children():
		if child is Button:
			_focus_later(child)
			return


## Focuses a control at the end of the frame, unless another screen replaced it by then.
static func _focus_later(control: Control) -> void:
	var grab := func() -> void:
		if is_instance_valid(control) and control.is_inside_tree():
			control.grab_focus()
	grab.call_deferred()


func _make_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font_size = 20
	var panel := StyleBoxFlat.new()
	panel.bg_color = COLOR_PANEL
	panel.border_color = COLOR_PANEL_EDGE
	panel.set_border_width_all(2)
	panel.set_corner_radius_all(12)
	panel.set_content_margin_all(32)
	theme.set_stylebox("panel", "PanelContainer", panel)
	var states := {"normal": COLOR_BUTTON, "hover": COLOR_BUTTON_HOVER, "pressed": COLOR_PANEL, "disabled": COLOR_PANEL, "focus": Color.TRANSPARENT}
	for state in states:
		var style := StyleBoxFlat.new()
		style.bg_color = states[state]
		style.set_corner_radius_all(8)
		style.set_content_margin_all(12)
		if state == "focus":
			style.draw_center = false
			style.border_color = COLOR_FOCUS
			style.set_border_width_all(3)
		theme.set_stylebox(state, "Button", style)
	theme.set_color("font_color", "Button", COLOR_TEXT)
	theme.set_color("font_hover_color", "Button", COLOR_TEXT)
	theme.set_color("font_focus_color", "Button", COLOR_TEXT)
	theme.set_color("font_disabled_color", "Button", COLOR_TEXT_DIM)
	return theme
