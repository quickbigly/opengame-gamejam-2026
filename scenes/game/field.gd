extends Node2D
## Shows a Board: steps it at a fixed rate, draws it and the HUD, and takes wall input.
## Every board event is re-emitted as board_event for the run and effects.
## Placeholder look; the art pass is M4.

signal board_event(event: Dictionary)

const CELL := 20.0
const FIELD_ORIGIN := Vector2(160, 64)
const MAX_STEPS_PER_FRAME := 12

const COLOR_BACKGROUND := Color("10131c")
const COLOR_GRID_LINE := Color("1b2131")
const COLOR_OPEN := Color("141925")
const COLOR_FILLED := Color("3a4560")
const COLOR_PEN_LOCKED := Color("173a33")
const COLOR_HALF_A := Color("4cc9f0")
const COLOR_HALF_B := Color("f7b267")
const COLOR_STRIPE := Color("10131c", 0.55)
const COLOR_BALL := Color("e8ecf4")
const COLOR_BALL_LOCKED := Color("7fd8be")
const COLOR_PREVIEW := Color(1, 1, 1, 0.16)
const COLOR_PREVIEW_BLOCKED := Color("ff5d73", 0.22)
const COLOR_TEXT := Color("e8ecf4")
const COLOR_TEXT_DIM := Color("7a8399")
const COLOR_GOOD := Color("7fd8be")
const COLOR_BAD := Color("ff5d73")
const COLOR_XP := Color("c792ea")

var board: Board
## The run the board belongs to, for the HUD. Null on the title screen.
var run: Run
## Whether the board is stepped.
var running := false
## Whether clicks and keys build walls.
var input_enabled := false
var vertical := false
var hover_cell := Vector2i(-1, -1)

var _accumulator := 0.0
var _flash := 0.0
var _font: Font


func _ready() -> void:
	_font = ThemeDB.fallback_font


func show_board(new_board: Board, new_run: Run) -> void:
	board = new_board
	run = new_run
	_accumulator = 0.0
	_flash = 0.0
	queue_redraw()


func _process(delta: float) -> void:
	if board and running:
		_accumulator = minf(_accumulator + delta, Board.STEP * MAX_STEPS_PER_FRAME)
		while _accumulator >= Board.STEP:
			board.step()
			_accumulator -= Board.STEP
			for event in board.take_events():
				if event["type"] == "half_broken":
					_flash = 0.4 if event["spared"] else 1.0
				board_event.emit(event)
	_flash = maxf(0.0, _flash - delta * 3.0)
	hover_cell = _cell_at(get_local_mouse_position())
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or board == null:
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			board.start_wall(_cell_at(get_local_mouse_position()), vertical)
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			vertical = not vertical
			get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_SPACE:
		vertical = not vertical
		get_viewport().set_input_as_handled()


func _cell_at(point: Vector2) -> Vector2i:
	var local := (point - FIELD_ORIGIN) / CELL
	return Vector2i(floori(local.x), floori(local.y))


func _to_screen(cells: Vector2) -> Vector2:
	return FIELD_ORIGIN + cells * CELL


func _rect_to_screen(rect: Rect2) -> Rect2:
	return Rect2(_to_screen(rect.position), rect.size * CELL)


func _draw() -> void:
	var view := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, view), COLOR_BACKGROUND)
	if board == null:
		return
	_draw_cells()
	if input_enabled:
		_draw_preview()
	_draw_halves()
	_draw_balls()
	if run:
		_draw_pen_meters()
		_draw_hud()
	if _flash > 0.0:
		draw_rect(Rect2(Vector2.ZERO, view), Color(COLOR_BAD, 0.25 * _flash))


func _draw_cells() -> void:
	var grid := board.grid
	var regions := board.regions
	draw_rect(_rect_to_screen(Rect2(0, 0, grid.width, grid.height)), COLOR_GRID_LINE)
	var locked := {}
	for pen in board.pens:
		if pen.locked:
			locked[pen.region] = true
	for y in grid.height:
		for x in grid.width:
			var cell := Vector2i(x, y)
			var rect := _rect_to_screen(Rect2(cell, Vector2.ONE))
			if grid.is_filled(cell):
				draw_rect(rect, COLOR_FILLED)
			else:
				var color := COLOR_PEN_LOCKED if locked.has(regions.region_at(cell)) else COLOR_OPEN
				draw_rect(rect.grow(-1.0), color)


func _draw_preview() -> void:
	if board.state != Board.State.PLAYING or board.grid.is_filled(hover_cell):
		return
	var axis := Vector2i.DOWN if vertical else Vector2i.RIGHT
	var back := WallHalf.new(0, hover_cell, -axis)
	var front := WallHalf.new(0, hover_cell, axis)
	back.length = back.target_length(board.grid)
	front.length = front.target_length(board.grid)
	var color := COLOR_PREVIEW if board.can_start_wall(hover_cell) else COLOR_PREVIEW_BLOCKED
	draw_rect(_rect_to_screen(back.rect().merge(front.rect())), color)
	draw_rect(_rect_to_screen(Rect2(hover_cell, Vector2.ONE)), Color(color, color.a * 2.0), false, 2.0)


func _draw_halves() -> void:
	for half in board.halves:
		var color := COLOR_HALF_A if half.direction.x + half.direction.y < 0 else COLOR_HALF_B
		var rect := _rect_to_screen(half.rect())
		draw_rect(rect, color)
		# Stripes across the half, so a growing wall never reads by colour alone.
		var along := Vector2(half.direction).abs()
		var span := rect.size.dot(along)
		var stripe := 6.0
		var offset := 0.0
		while offset < span:
			var piece_size := along * minf(stripe * 0.5, span - offset) + (Vector2.ONE - along) * rect.size
			draw_rect(Rect2(rect.position + along * offset, piece_size), COLOR_STRIPE)
			offset += stripe


func _draw_balls() -> void:
	for ball in board.balls:
		var color := COLOR_BALL_LOCKED if ball.locked else COLOR_BALL
		if board.is_frozen():
			color = color.lerp(COLOR_HALF_A, 0.5)
		draw_circle(_to_screen(ball.position), ball.radius * CELL, color, true, -1.0, true)


func _draw_pen_meters() -> void:
	for pen in board.pens:
		var text := "%d / %d" % [pen.area, floori(pen.limit)]
		var color := COLOR_GOOD if pen.locked else COLOR_TEXT
		var at := _to_screen(pen.centroid)
		var width := 120.0
		draw_string_outline(_font, at + Vector2(-width * 0.5, 6), text, HORIZONTAL_ALIGNMENT_CENTER, width, 16, 4, COLOR_BACKGROUND)
		draw_string(_font, at + Vector2(-width * 0.5, 6), text, HORIZONTAL_ALIGNMENT_CENTER, width, 16, color)


func _draw_hud() -> void:
	var left := FIELD_ORIGIN.x
	var width := board.grid.width * CELL
	var top := 28.0
	var bottom := 52.0

	draw_string(_font, Vector2(left, top), "Stage %d / %d" % [run.stage, run.stage_count()], HORIZONTAL_ALIGNMENT_LEFT, -1, 22, COLOR_TEXT)
	draw_string(_font, Vector2(left, top), Run.thousands(run.score), HORIZONTAL_ALIGNMENT_CENTER, width, 24, COLOR_TEXT)
	var lives_color := COLOR_BAD if board.lives <= 1 else COLOR_TEXT
	draw_string(_font, Vector2(left, top), "Lives  %d" % board.lives, HORIZONTAL_ALIGNMENT_RIGHT, width, 22, lives_color)

	var limit_text := "Limit %s per ball" % Run.percent(board.pen_limit)
	draw_string(_font, Vector2(left, bottom), limit_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, COLOR_TEXT_DIM)
	var boxed_text := "Boxed  %d / %d" % [board.locked_count(), board.balls.size()]
	draw_string(_font, Vector2(left, bottom), boxed_text, HORIZONTAL_ALIGNMENT_RIGHT, width, 16, COLOR_TEXT_DIM)

	# XP bar, centred under the score.
	var bar := Rect2(left + width * 0.5 - 120, bottom - 10, 240, 8)
	draw_rect(bar, COLOR_GRID_LINE)
	var fill := clampf(run.xp / run.xp_needed(), 0.0, 1.0)
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * fill, bar.size.y)), COLOR_XP)
	draw_string(_font, Vector2(bar.position.x - 70, bottom), "Lv %d" % run.level, HORIZONTAL_ALIGNMENT_RIGHT, 62, 16, COLOR_XP)
	if run.pending_levels > 0:
		draw_string(_font, Vector2(bar.end.x + 8, bottom), "+%d upgrade%s" % [run.pending_levels, "s" if run.pending_levels > 1 else ""], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, COLOR_XP)
