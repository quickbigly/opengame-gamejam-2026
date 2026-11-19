extends Node2D
## Plays one stage: steps the Board at a fixed rate, draws it and takes the player's input.
## M1 placeholder look; the art pass is M4.
##
## Command-line options (after --, e.g. `dev --balls=3 --limit=0.11 --seed=42`):
##   --balls=N   balls in the stage (default 1)
##   --limit=F   pen limit per ball, as a fraction of the field (default 0.2)
##   --seed=N    seed for ball placement

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

var board: Board
var vertical := false
var hover_cell := Vector2i(-1, -1)

var _ball_count := 1
var _limit := 0.2
var _rng := RandomNumberGenerator.new()
var _accumulator := 0.0
var _flash := 0.0
var _font: Font


func _ready() -> void:
	_font = ThemeDB.fallback_font
	_rng.randomize()
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=")
		if parts.size() != 2:
			continue
		match parts[0]:
			"balls": _ball_count = maxi(1, parts[1].to_int())
			"limit": _limit = clampf(parts[1].to_float(), 0.01, 1.0)
			"seed": _rng.seed = parts[1].to_int()
	_new_board()


func _new_board() -> void:
	board = Board.new(_limit)
	board.spawn_balls(_ball_count, _rng)
	_accumulator = 0.0
	_flash = 0.0


func _process(delta: float) -> void:
	_accumulator = minf(_accumulator + delta, Board.STEP * MAX_STEPS_PER_FRAME)
	while _accumulator >= Board.STEP:
		board.step()
		_accumulator -= Board.STEP
	for event in board.take_events():
		if event["type"] == "half_broken":
			_flash = 1.0
	_flash = maxf(0.0, _flash - delta * 3.0)
	hover_cell = _cell_at(get_local_mouse_position())
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if board.state == Board.State.PLAYING:
				board.start_wall(_cell_at(event.position), vertical)
			else:
				_new_board()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			vertical = not vertical
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE:
				vertical = not vertical
			KEY_R:
				_new_board()


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
	_draw_cells()
	_draw_preview()
	_draw_halves()
	_draw_balls()
	_draw_pen_meters()
	_draw_hud(view)
	if _flash > 0.0:
		draw_rect(Rect2(Vector2.ZERO, view), Color(COLOR_BAD, 0.25 * _flash))
	_draw_overlay(view)


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
		draw_circle(_to_screen(ball.position), ball.radius * CELL, color, true, -1.0, true)


func _draw_pen_meters() -> void:
	for pen in board.pens:
		var text := "%d / %d" % [pen.area, floori(pen.limit)]
		var color := COLOR_GOOD if pen.locked else COLOR_TEXT
		var at := _to_screen(pen.centroid)
		var width := 120.0
		draw_string_outline(_font, at + Vector2(-width * 0.5, 6), text, HORIZONTAL_ALIGNMENT_CENTER, width, 16, 4, COLOR_BACKGROUND)
		draw_string(_font, at + Vector2(-width * 0.5, 6), text, HORIZONTAL_ALIGNMENT_CENTER, width, 16, color)


func _draw_hud(view: Vector2) -> void:
	var y := 30.0
	var left := FIELD_ORIGIN.x
	var field_width := board.grid.width * CELL
	var lives_color := COLOR_BAD if board.lives <= 1 else COLOR_TEXT
	draw_string(_font, Vector2(left, y), "Lives  %d" % board.lives, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, lives_color)
	var limit_text := "Pen limit  %d%% per ball (%d cells)" % [roundi(board.pen_limit * 100.0), floori(board.pen_limit_cells())]
	draw_string(_font, Vector2(left, y), limit_text, HORIZONTAL_ALIGNMENT_CENTER, field_width, 20, COLOR_TEXT_DIM)
	var pens_text := "Boxed  %d / %d" % [board.locked_count(), board.balls.size()]
	draw_string(_font, Vector2(left, y), pens_text, HORIZONTAL_ALIGNMENT_RIGHT, field_width, 22, COLOR_TEXT)
	var direction := "Vertical" if vertical else "Horizontal"
	var help := "Click: build wall   Right-click / Space: turn (%s)   R: restart" % direction
	draw_string(_font, Vector2(0, 54), help, HORIZONTAL_ALIGNMENT_CENTER, view.x, 13, COLOR_TEXT_DIM)


func _draw_overlay(view: Vector2) -> void:
	var title := ""
	var color := COLOR_TEXT
	match board.state:
		Board.State.CLEARED:
			title = "Stage clear"
			color = COLOR_GOOD
		Board.State.GAME_OVER:
			title = "Out of lives"
			color = COLOR_BAD
		_:
			return
	draw_rect(Rect2(Vector2.ZERO, view), Color(COLOR_BACKGROUND, 0.6))
	draw_string(_font, Vector2(0, view.y * 0.5), title, HORIZONTAL_ALIGNMENT_CENTER, view.x, 56, color)
	draw_string(_font, Vector2(0, view.y * 0.5 + 44), "Click to play again", HORIZONTAL_ALIGNMENT_CENTER, view.x, 20, COLOR_TEXT_DIM)
