extends Node2D
## Shows a Board: steps it at a fixed rate, draws it, the HUD and the effects, plays the board's
## sounds and takes wall input. Every board event is re-emitted as board_event for the run.
##
## Effects run on wall-clock time, so they keep fading while the board is held by a hit-stop or
## a pause. Reduced motion (Settings) turns off shake, particles, rings, the capture sweep's
## stagger and the moving stripes; fades stay.

signal board_event(event: Dictionary)
## The player switched the wall direction.
signal turned
## The board advanced one step (for a test autoplayer; see TestHooks).
signal stepped_once

const CELL := 20.0
const FIELD_ORIGIN := Vector2(160, 64)
const MAX_STEPS_PER_FRAME := 12
## Under the stepped clock (TestHooks), the most board steps run in one frame.
const STEPPED_MAX_PER_FRAME := 240

## Seconds the board holds still after a wall breaks.
const HIT_STOP := 0.09
const SHAKE_BREAK := 7.0
const SHAKE_DECAY := 30.0
## The capture sweep: each cell lights this long after the one before it, by distance from
## where the wall started, up to SWEEP_MAX, then fades into the wall colour over SWEEP_FADE.
const SWEEP_PER_CELL := 0.014
const SWEEP_MAX := 0.45
const SWEEP_FADE := 0.35
const SNAP_TIME := 0.32
const LOCK_PULSE := 0.9
const FLASH_MAX := 0.14
const STRIPE := 8.0
const STRIPE_SPEED := 18.0
## Pitch steps (semitones) for each pen that locks in a stage: a rising pentatonic run.
const LOCK_STEPS := [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
const COLUMN_LEFT := 16.0
const COLUMN_WIDTH := 128.0
## A growing half warns (a pulsing outline) while a free ball is this close, in cells.
const DANGER_CELLS := 2.0

var board: Board
## The run the board belongs to, for the HUD. Null on the title screen.
var run: Run
## Whether the board is stepped.
var running := false
## Whether clicks and keys build walls.
var input_enabled := false
var vertical := false
var hover_cell := Vector2i(-1, -1)
## The tutorial tip to show over the field, or "".
var tip := ""
## Seconds of board time run this frame under the stepped clock (0 otherwise).
var stepped_seconds := 0.0

var _accumulator := 0.0
var _now := 0.0
var _hit_stop := 0.0
var _shake := 0.0
var _flash := 0.0
var _font: Font
var _glow_texture: Texture2D
var _glow: Node2D
var _wall_origins := {}
## Captured cells still sweeping in: Vector2i -> the time each lights up.
var _sweep := {}
var _snaps: Array[Dictionary] = []
## Pens that just locked: {cell, t0}.
var _pulses: Array[Dictionary] = []
var _rings: Array[Dictionary] = []
var _particles: Array[Dictionary] = []
var _floaters: Array[Dictionary] = []
var _locks_this_stage := 0
var _tip_shown := ""
var _tip_since := 0.0
## The tip sits at the bottom of the field, or the top when the bottom is busy (see _place_tip).
var _tip_top := false
var _tip_busy := 0.0
## 0 to 1: how far the tip has faded to let the play under it show, when it can't move away.
var _tip_fade := 0.0
var _rng := RandomNumberGenerator.new()
var _cells: Node2D
var _cells_drawn := ""
## What the hover preview showed last frame: "none", "ok", "busy", "blocked" or "filled".
var _preview_mode := "none"
## Growing halves drawn with the danger outline last frame.
var _danger_count := 0
## Where each pen's meter sits (region id -> canvas point), and the layout it was placed for.
var _meter_at := {}
var _meter_key := ""
var _last_refusal := -10.0


## Draws the background and the cells, behind everything else. It redraws only when what it
## shows changes (see _cells_signature), so a quiet frame costs nothing here.
class CellLayer extends Node2D:
	var field: Node2D

	func _draw() -> void:
		field._draw_background(self)
		if field.board:
			field._draw_cells(self)


## Draws the field's glow with additive blending, on top of the field.
class GlowLayer extends Node2D:
	var field: Node2D

	func _draw() -> void:
		field._draw_glow(self)


func _ready() -> void:
	_font = ThemeDB.fallback_font
	_rng.randomize()
	var gradient := Gradient.new()
	gradient.set_color(0, Color(1, 1, 1, 1))
	gradient.set_color(1, Color(1, 1, 1, 0))
	gradient.add_point(0.35, Color(1, 1, 1, 0.45))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 64
	texture.height = 64
	_glow_texture = texture
	_cells = CellLayer.new()
	_cells.field = self
	_cells.z_index = -1
	add_child(_cells)
	_glow = GlowLayer.new()
	_glow.field = self
	var material := CanvasItemMaterial.new()
	material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_glow.material = material
	add_child(_glow)


func show_board(new_board: Board, new_run: Run) -> void:
	board = new_board
	run = new_run
	_accumulator = 0.0
	_hit_stop = 0.0
	_flash = 0.0
	_shake = 0.0
	_wall_origins.clear()
	_sweep.clear()
	_snaps.clear()
	_pulses.clear()
	_rings.clear()
	_particles.clear()
	_floaters.clear()
	_locks_this_stage = 0
	queue_redraw()


func _reduced() -> bool:
	return Settings.reduced_motion()


func _process(delta: float) -> void:
	stepped_seconds = 0.0
	var stepped: bool = board and running and run and TestHooks.stepped
	if stepped:
		# Test builds only: the page decides how far the board moves (TestHooks).
		# Steps keep counting after the board ends, so the end-of-stage delay waits for them too.
		for i in TestHooks.take_steps(STEPPED_MAX_PER_FRAME):
			stepped_seconds += Board.STEP
			if board.state != Board.State.PLAYING:
				continue
			board.step()
			for event in board.take_events():
				_emit(event)
			stepped_once.emit()
	elif board and running:
		if _hit_stop > 0.0:
			_hit_stop -= delta
		else:
			_accumulator = minf(_accumulator + delta, Board.STEP * MAX_STEPS_PER_FRAME)
			while _accumulator >= Board.STEP and _hit_stop <= 0.0:
				board.step()
				_accumulator -= Board.STEP
				for event in board.take_events():
					_emit(event)
				stepped_once.emit()
	# Under the stepped clock the effects wait for the steps too, so a capture shows the moment
	# it was taken at, however long the test took to look.
	var effect_delta := stepped_seconds if stepped else delta
	_now += effect_delta
	_flash = maxf(0.0, _flash - effect_delta * 2.5)
	_shake = maxf(0.0, _shake - effect_delta * SHAKE_DECAY)
	if _shake > 0.0 and (not _reduced() or TestHooks.planted("shake_ignores_reduced")):
		position = Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1)) * _shake
	else:
		position = Vector2.ZERO
	_update_particles(effect_delta)
	if tip != _tip_shown:
		_tip_shown = tip
		_tip_since = _now
	_place_tip(effect_delta)
	hover_cell = _cell_at(get_local_mouse_position())
	queue_redraw()
	_glow.queue_redraw()
	var signature := _cells_signature()
	if signature != _cells_drawn:
		_cells_drawn = signature
		_cells.queue_redraw()


## What the cell layer shows; it redraws when this changes. Sweeps and lock pulses animate, so
## while either runs it redraws every frame.
func _cells_signature() -> String:
	if not _sweep.is_empty() or not _pulses.is_empty():
		return "animating %f" % _now
	if board == null:
		return "none %s" % get_viewport_rect().size
	return "%d %d %d %s %s %s %s" % [board.get_instance_id(), board.grid.open_count(), board.locked_count(),
		board.pens.size(), Settings.value("show_grid"), Palette.colorblind, get_viewport_rect().size]


## Plays an event's sound and effects, passes it on, then shows what it scored.
func _emit(event: Dictionary) -> void:
	var score_before := run.score if run else 0
	var level_before := run.level if run else 0
	_on_event(event)
	board_event.emit(event)
	if run == null:
		return
	if event["type"] == "wall_finished" and run.score > score_before:
		var at := _wall_point(event["wall_id"])
		var text := "+" + Run.thousands(run.score - score_before)
		if event["regions"] >= 2:
			text += "   Combo ×%d" % run.combo_multiplier(event["regions"])
		_float(text, at, Palette.c("text"), 18)
	if run.level > level_before:
		Audio.play("level_up")
		var bar := _xp_bar_rect()
		_float("Level up!", bar.get_center() + Vector2(0, 44), Palette.c("xp"), 20)
		_burst(bar.get_center(), Palette.c("xp"), 24, 160.0)
		_ring(bar.get_center(), 10.0, 90.0, 0.6, Palette.c("xp"))


func _on_event(event: Dictionary) -> void:
	match event["type"]:
		"wall_started":
			_wall_origins[event["wall_id"]] = event["cell"]
			Audio.play("wall_start")
			_ring(_cell_center(event["cell"]), 4.0, 26.0, 0.25, Palette.c("text"))
		"half_completed":
			var rect := _cells_rect(event["cells"])
			_snaps.append({"rect": rect, "t0": _now})
			Audio.play("snap", _rng.randf_range(0.97, 1.05))
		"captured":
			_start_sweep(event["wall_id"], event["cells"])
			var size: int = event["cells"].size()
			Audio.play("capture", clampf(1.25 - size / 1200.0, 0.8, 1.25))
		"half_broken":
			var rect := _rect_to_screen(event["rect"])
			if not event["spared"] and not event["costs_life"]:
				_shards(rect)  # another half of a wall that already cost a life this step
			elif event["spared"]:
				_flash = maxf(_flash, 0.4)
				Audio.play("break", 1.3, -6.0)
				_float("Close call!", rect.get_center(), Palette.c("xp"), 18)
			else:
				_flash = 1.0
				_shake = SHAKE_BREAK
				_hit_stop = HIT_STOP
				Audio.play("break")
				_float("-1 life", rect.get_center(), Palette.c("bad"), 20)
				_shards(rect)
		"half_shielded":
			var at := _rect_to_screen(event["rect"]).get_center()
			_ring(at, 6.0, 40.0, 0.35, Palette.c("text"))
			Audio.play("shield")
			_float("Shielded", at, Palette.c("text"), 16)
		"pen_locked":
			_pulses.append({"cell": event["cell"], "t0": _now})
			var step: int = LOCK_STEPS[mini(_locks_this_stage, LOCK_STEPS.size() - 1)]
			_locks_this_stage += 1
			Audio.play("lock", pow(2.0, step / 12.0))
			_ring(_cell_center(event["cell"]), 8.0, 70.0, 0.7, Palette.c("good"))
		"ball_split":
			Audio.play("split")
			_ring(_to_screen(event["position"]), 4.0, 36.0, 0.35, Palette.c("ball"))
		"active_used":
			var at := _to_screen(event["at"])
			if event["id"] == "freeze":
				Audio.play("freeze")
				_ring(at, 10.0, 260.0, 0.7, Palette.c("frozen"), 4.0)
			else:
				Audio.play("repel")
				_ring(at, 10.0, 320.0, 0.6, Palette.c("text"), 4.0)
		"cleared":
			Audio.play("clear")
			for pen in board.pens:
				_burst(_to_screen(pen.centroid), Palette.c("good"), 16, 140.0)
		"game_over":
			Audio.play("game_over")


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or board == null:
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			_try_wall(_cell_at(get_local_mouse_position()), event.shift_pressed)
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_RIGHT and not TestHooks.planted("no_right_turn"):
			_turn()
			get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_SPACE:
			_turn()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_Q:
			var at := (get_local_mouse_position() - FIELD_ORIGIN) / CELL
			if not board.use_active(at) and board.active != "":
				Audio.play("blocked")
			get_viewport().set_input_as_handled()


func _turn() -> void:
	vertical = not vertical
	Audio.play("turn", 1.12 if vertical else 1.0)
	turned.emit()


func _try_wall(cell: Vector2i, cross: bool) -> void:
	var blocker := board.start_blocker(cell)
	if board.start_wall(cell, vertical, cross):
		return
	if board.grid.in_bounds(cell) and board.state == Board.State.PLAYING:
		Audio.play("blocked")
		_ring(_cell_center(cell), 4.0, 18.0, 0.25, Palette.c("bad"))
		# Say why, at most twice a second: a refused click otherwise does nothing a player can read.
		var why: String = {"busy": "Wall still building", "ball": "A ball is in the way", "wall": "A wall is in the way"}.get(blocker, "")
		if why != "" and _now - _last_refusal > 0.5:
			_last_refusal = _now
			_float(why, _cell_center(cell) + Vector2(0, -14), Palette.c("text"), 15)


# --- Effects ----------------------------------------------------------------------------------


func _start_sweep(wall_id: int, cells: PackedVector2Array) -> void:
	var from: Vector2 = Vector2(_wall_origins.get(wall_id, Vector2i(cells[0])))
	var stagger := not _reduced()
	for c in cells:
		var delay := minf(c.distance_to(from) * SWEEP_PER_CELL, SWEEP_MAX) if stagger else 0.0
		_sweep[Vector2i(c)] = _now + delay


func _ring(at: Vector2, r0: float, r1: float, life: float, color: Color, width := 2.0) -> void:
	if _reduced():
		return
	_rings.append({"at": at, "r0": r0, "r1": r1, "t0": _now, "life": life, "color": color, "width": width})


func _burst(at: Vector2, color: Color, count: int, speed: float) -> void:
	if _reduced():
		return
	for i in count:
		var angle := _rng.randf() * TAU
		var velocity := Vector2.from_angle(angle) * speed * _rng.randf_range(0.4, 1.0)
		_particles.append({"pos": at, "vel": velocity, "t0": _now, "life": _rng.randf_range(0.4, 0.8), "color": color, "size": _rng.randf_range(2.0, 4.0)})


## Bits of a broken half flying apart.
func _shards(rect: Rect2) -> void:
	if _reduced():
		return
	var color := Palette.c("bad")
	for i in 14:
		var at := rect.position + Vector2(_rng.randf() * rect.size.x, _rng.randf() * rect.size.y)
		var velocity := (at - rect.get_center()).normalized() * _rng.randf_range(60.0, 220.0) + Vector2(_rng.randf_range(-40, 40), _rng.randf_range(-40, 40))
		_particles.append({"pos": at, "vel": velocity, "t0": _now, "life": _rng.randf_range(0.35, 0.7), "color": color, "size": _rng.randf_range(3.0, 6.0)})


func _float(text: String, at: Vector2, color: Color, size: int) -> void:
	_floaters.append({"text": text, "at": at, "t0": _now, "color": color, "size": size})


func _update_particles(delta: float) -> void:
	for p in _particles:
		p["pos"] += p["vel"] * delta
		p["vel"] *= exp(-3.0 * delta)
	_particles = _particles.filter(func(p: Dictionary) -> bool: return _now - p["t0"] < p["life"])
	_rings = _rings.filter(func(r: Dictionary) -> bool: return _now - r["t0"] < r["life"])
	_floaters = _floaters.filter(func(f: Dictionary) -> bool: return _now - f["t0"] < 1.2)
	_snaps = _snaps.filter(func(s: Dictionary) -> bool: return _now - s["t0"] < SNAP_TIME)
	_pulses = _pulses.filter(func(p: Dictionary) -> bool: return _now - p["t0"] < LOCK_PULSE)


# --- Geometry ---------------------------------------------------------------------------------


func _cell_at(point: Vector2) -> Vector2i:
	var local := (point - FIELD_ORIGIN) / CELL
	return Vector2i(floori(local.x), floori(local.y))


func _to_screen(cells: Vector2) -> Vector2:
	return FIELD_ORIGIN + cells * CELL


func _cell_center(cell: Vector2i) -> Vector2:
	return _to_screen(Vector2(cell) + Vector2(0.5, 0.5))


func _rect_to_screen(rect: Rect2) -> Rect2:
	return Rect2(_to_screen(rect.position), rect.size * CELL)


func _cells_rect(cells: PackedVector2Array) -> Rect2:
	var rect := Rect2(cells[0], Vector2.ONE)
	for c in cells:
		rect = rect.expand(c).expand(c + Vector2.ONE)
	return _rect_to_screen(rect)


func _wall_point(wall_id: int) -> Vector2:
	if _wall_origins.has(wall_id):
		return _cell_center(_wall_origins[wall_id])
	return _field_rect().get_center()


func _field_rect() -> Rect2:
	return Rect2(FIELD_ORIGIN, Vector2(board.grid.width, board.grid.height) * CELL)


func _xp_bar_rect() -> Rect2:
	return Rect2(FIELD_ORIGIN.x + board.grid.width * CELL * 0.5 - 120, 42, 240, 8)


# --- Drawing ----------------------------------------------------------------------------------


func _draw() -> void:
	if board == null:
		return
	if input_enabled:
		_draw_preview()
	_draw_halves()
	_draw_snaps()
	_draw_balls()
	_draw_rings_and_particles()
	if run:
		if not TestHooks.planted("no_meter"):
			_draw_pen_meters()
		_draw_hud()
	_draw_floaters()
	_draw_tip()
	if _flash > 0.0:
		var view := get_viewport_rect().size
		var red := Palette.c("bad")
		draw_rect(Rect2(-position, view), Color(red, FLASH_MAX * _flash))
		draw_rect(_field_rect().grow(3.0), Color(red, _flash), false, 4.0)


func _draw_background(ci: CanvasItem) -> void:
	var view := get_viewport_rect().size
	var top := Palette.c("background")
	var glow := Palette.c("background_glow")
	var area := Rect2(-Vector2(16, 16), view + Vector2(32, 32))
	ci.draw_rect(area, top)
	var centre := view * 0.5
	ci.draw_texture_rect(_glow_texture, Rect2(centre - view * 0.75, view * 1.5), false, Color(glow, 0.55))


func _draw_cells(ci: CanvasItem) -> void:
	var grid := board.grid
	var regions := board.regions
	var show_grid: bool = Settings.value("show_grid")
	var field := _field_rect()
	ci.draw_rect(field, Palette.c("grid_line") if show_grid else Palette.c("open"))

	var locked := {}
	for pen in board.pens:
		if _shows_locked(pen.locked):
			locked[pen.region] = true
	var pulse := {}
	for p in _pulses:
		var region := regions.region_at(p["cell"])
		if region != Grid.Regions.NONE:
			pulse[region] = maxf(pulse.get(region, 0.0), 1.0 - (_now - p["t0"]) / LOCK_PULSE)

	var c_open := Palette.c("open")
	var c_filled := Palette.c("filled")
	var c_rim := Palette.c("filled_rim")
	var c_pen := Palette.c("pen_locked")
	var c_good := Palette.c("good")
	var c_sweep := Palette.c("filled_rim").lightened(0.2)
	var inset := 0.5 if show_grid else 0.0
	var done: Array[Vector2i] = []
	for y in grid.height:
		for x in grid.width:
			var cell := Vector2i(x, y)
			var rect := Rect2(FIELD_ORIGIN + Vector2(x, y) * CELL, Vector2(CELL, CELL))
			if grid.is_filled(cell):
				var color := c_filled
				if _sweep.has(cell):
					var t: float = _now - _sweep[cell]
					if t < 0.0:
						ci.draw_rect(rect.grow(-inset), c_open)
						continue
					var k := t / SWEEP_FADE
					if k >= 1.0:
						done.append(cell)
					else:
						color = c_sweep.lerp(c_filled, k)
				ci.draw_rect(rect, color)
				continue
			var region := regions.region_at(cell)
			var is_locked := locked.has(region)
			var color := c_open
			if is_locked:
				# The pulse brightens the pen's own colour, never toward the boxed ball's colour.
				color = c_pen.lerp(c_pen.lightened(0.45), pulse.get(region, 0.0))
			ci.draw_rect(rect.grow(-inset), color)
			# Rims where open space meets a wall; green around a locked pen.
			var rim := c_good if is_locked else c_rim
			if grid.is_filled(cell + Vector2i.LEFT):
				ci.draw_rect(Rect2(rect.position, Vector2(2, CELL)), rim)
			if grid.is_filled(cell + Vector2i.RIGHT):
				ci.draw_rect(Rect2(rect.position + Vector2(CELL - 2, 0), Vector2(2, CELL)), rim)
			if grid.is_filled(cell + Vector2i.UP):
				ci.draw_rect(Rect2(rect.position, Vector2(CELL, 2)), rim)
			if grid.is_filled(cell + Vector2i.DOWN):
				ci.draw_rect(Rect2(rect.position + Vector2(0, CELL - 2), Vector2(CELL, 2)), rim)
	for cell in done:
		_sweep.erase(cell)
	ci.draw_rect(field.grow(1.0), Color(c_rim, 0.6), false, 2.0)


## The wall a click would build. Its path shows only when the click would work, so a coloured
## band never reads as "where a wall will end". While every crew is busy it shows a grey outline
## and says so; on a ball or a growing wall, just the cell in red. Over a filled cell, a small
## mark beside the cursor still shows which way the next wall will grow.
func _draw_preview() -> void:
	_preview_mode = "none"
	if board.state != Board.State.PLAYING or not board.grid.in_bounds(hover_cell):
		return
	var dim := Palette.c("text_dim")
	var origin := _rect_to_screen(Rect2(hover_cell, Vector2.ONE))
	if board.grid.is_filled(hover_cell):
		_preview_mode = "filled"
		if _shows_direction():
			_draw_direction_icon(get_local_mouse_position() + Vector2(20, 18), dim)
		return
	var blocker := board.start_blocker(hover_cell)
	var old_red := blocker == "busy" and TestHooks.planted("red_busy_preview")
	if blocker == "busy" and not old_red:
		_preview_mode = "busy"
		draw_rect(origin, Color(dim, 0.7), false, 1.5)
		_draw_direction_icon(origin.get_center() + Vector2(20, 18), dim)
		draw_string(_font, origin.position + Vector2(CELL + 6, -2), "wall building", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, dim)
		return
	var color := Palette.c("preview") if blocker == "" else Palette.c("preview_blocked")
	_preview_mode = "ok" if blocker == "" else "blocked"
	if blocker != "" and not old_red:
		draw_rect(origin, color)
		draw_rect(origin, Color(color, color.a * 2.5), false, 2.0)
		return
	var cross := board.crossbeam and Input.is_key_pressed(KEY_SHIFT)
	for direction in Board.wall_directions(vertical, cross):
		var half := WallHalf.new(0, hover_cell, direction)
		half.length = half.target_length(board.grid)
		# Each half without its origin cell, which is painted once below.
		var back_side: Side = {Vector2i.RIGHT: SIDE_LEFT, Vector2i.LEFT: SIDE_RIGHT, Vector2i.DOWN: SIDE_TOP, Vector2i.UP: SIDE_BOTTOM}[direction]
		draw_rect(_rect_to_screen(half.rect().grow_side(back_side, -1.0)), color)
	draw_rect(origin, color)
	draw_rect(origin, Color(color, color.a * 2.5), false, 2.0)


## Whether the next wall's direction is shown off the field (off under its plant).
func _shows_direction() -> bool:
	return not TestHooks.planted("no_direction_icon")


## A small bar the way the next wall will grow: across for horizontal, upright for vertical.
func _draw_direction_icon(centre: Vector2, color: Color) -> void:
	var long := Vector2(0, 9) if vertical else Vector2(9, 0)
	var short := Vector2(3, 0) if vertical else Vector2(0, 3)
	draw_line(centre - long, centre + long, color, 3.0)
	draw_line(centre - long - short, centre - long + short, color, 2.0)
	draw_line(centre + long - short, centre + long + short, color, 2.0)


func _half_color(half: WallHalf) -> Color:
	return Palette.c("half_a") if half.direction.x + half.direction.y < 0 else Palette.c("half_b")


func _draw_halves() -> void:
	var stripe_color := Palette.c("stripe")
	var scroll := 0.0 if _reduced() else fmod(_now * STRIPE_SPEED, STRIPE)
	_danger_count = 0
	for half in board.halves:
		var color := _half_color(half)
		var rect := _rect_to_screen(half.rect())
		draw_rect(rect, color)
		if _in_danger(half) and not TestHooks.planted("no_danger_cue"):
			# A ball is close: a thick outline that pulses (steady under reduced motion).
			_danger_count += 1
			var beat := 1.0 if _reduced() else 0.55 + 0.45 * sin(_now * 18.0)
			draw_rect(rect.grow(4.0), Color(Palette.c("bad"), beat), false, 3.0)
		if board.shield_hits > 0:
			draw_rect(rect.grow(2.0), Palette.c("text"), false, 2.0)  # shielded (Hardened Tip): outlined
		# Stripes across the half, moving outward, so a growing wall never reads by colour alone.
		var along := Vector2(half.direction).abs()
		var span := rect.size.dot(along)
		var outward := half.direction.x + half.direction.y > 0
		var offset := -STRIPE + (scroll if outward else STRIPE - scroll)
		while offset < span:
			var from := maxf(offset, 0.0)
			var to := minf(offset + STRIPE * 0.5, span)
			if to > from:
				draw_rect(Rect2(rect.position + along * from, along * (to - from) + (Vector2.ONE - along) * rect.size), stripe_color)
			offset += STRIPE
		# The growing tip.
		var tip_size := along * 4.0 + (Vector2.ONE - along) * rect.size
		var tip_at := rect.end - tip_size if outward else rect.position
		draw_rect(Rect2(tip_at, tip_size), color.lightened(0.6))


## Whether a free ball is within DANGER_CELLS of a growing half (its edge, not its centre).
func _in_danger(half: WallHalf) -> bool:
	var rect := half.rect()
	for ball in board.balls:
		if ball.locked:
			continue
		var nearest := ball.position.clamp(rect.position, rect.end)
		if ball.position.distance_to(nearest) - ball.radius < DANGER_CELLS:
			return true
	return false


func _draw_snaps() -> void:
	for snap in _snaps:
		var k: float = (_now - snap["t0"]) / SNAP_TIME
		var rect: Rect2 = snap["rect"]
		draw_rect(rect.grow(2.0 * (1.0 - k)), Color(1, 1, 1, 0.85 * (1.0 - k) * (1.0 - k)))


## Each special ball has its own mark, so kinds never read by colour alone.
func _draw_balls() -> void:
	var frozen := board.is_frozen()
	for ball in board.balls:
		var color := Palette.c("ball_locked") if _shows_locked(ball.locked) else Palette.c("ball")
		if frozen:
			color = color.lerp(Palette.c("frozen"), 0.6)
		var at := _to_screen(ball.position)
		var r := ball.radius * CELL
		var heading := ball.velocity.normalized()
		match ball.kind:
			Ball.Kind.SWIFT:
				for i in 3:
					draw_circle(at - heading * r * (1.2 + i * 0.9), r * (0.55 - i * 0.15), Color(color, 0.45 - i * 0.12), true, -1.0, true)
			Ball.Kind.BIG:
				draw_circle(at, r + 3.0, Color(color, 0.3), false, 2.0, true)
		draw_circle(at, r, color, true, -1.0, true)
		if _shows_locked(ball.locked):
			draw_circle(at, r + 1.0, Palette.c("background"), false, 2.0, true)  # stands out on its pen
		match ball.kind:
			Ball.Kind.SWIFT:
				_draw_chevron(at, heading, r, Palette.c("background"))
			Ball.Kind.SPLITTER:
				var across := heading.orthogonal() * r
				draw_line(at - across, at + across, Palette.c("background"), 2.0, true)
			Ball.Kind.DRIFTER:
				draw_circle(at, r * 0.45, Palette.c("background"), true, -1.0, true)
		if frozen:
			draw_circle(at, r + 2.0, Color(Palette.c("frozen"), 0.8), false, 1.5, true)


## Swift's mark: an arrowhead inside the ball, pointing the way it's going.
func _draw_chevron(at: Vector2, heading: Vector2, r: float, color: Color) -> void:
	var side := heading.orthogonal()
	var points := PackedVector2Array([at - heading * r * 0.25 + side * r * 0.6, at + heading * r * 0.55, at - heading * r * 0.25 - side * r * 0.6])
	draw_polyline(points, color, 2.0, true)


func _draw_rings_and_particles() -> void:
	for ring in _rings:
		var k: float = (_now - ring["t0"]) / ring["life"]
		var eased := 1.0 - pow(1.0 - k, 3.0)
		var radius: float = lerpf(ring["r0"], ring["r1"], eased)
		draw_arc(ring["at"], radius, 0.0, TAU, 48, Color(ring["color"], 0.8 * (1.0 - k)), ring["width"], true)
	for p in _particles:
		var k: float = (_now - p["t0"]) / p["life"]
		var size: float = p["size"] * (1.0 - k * 0.5)
		draw_rect(Rect2(p["pos"] - Vector2(size, size) * 0.5, Vector2(size, size)), Color(p["color"], 1.0 - k))


func _draw_glow(layer: CanvasItem) -> void:
	if board == null:
		return
	for ball in board.balls:
		var shown_locked := _shows_locked(ball.locked)
		var color := Palette.c("ball_locked") if shown_locked else Palette.c("ball")
		var r := ball.radius * CELL * 4.0
		layer.draw_texture_rect(_glow_texture, Rect2(_to_screen(ball.position) - Vector2(r, r), Vector2(r, r) * 2.0), false, Color(color, 0.22 if shown_locked else 0.32))
	for half in board.halves:
		var rect := _rect_to_screen(half.rect()).grow(10.0)
		layer.draw_texture_rect(_glow_texture, rect, false, Color(_half_color(half), 0.35))
	for snap in _snaps:
		var k: float = (_now - snap["t0"]) / SNAP_TIME
		layer.draw_texture_rect(_glow_texture, (snap["rect"] as Rect2).grow(16.0), false, Color(1, 1, 1, 0.5 * (1.0 - k)))
	for pen in board.pens:
		if _shows_locked(pen.locked):
			var r := sqrt(float(pen.area)) * CELL * 0.7
			layer.draw_texture_rect(_glow_texture, Rect2(_to_screen(pen.centroid) - Vector2(r, r), Vector2(r, r) * 2.0), false, Color(Palette.c("good"), 0.12))


## Whether to draw something as locked: false for everything under the hide_locks plant.
func _shows_locked(locked: bool) -> bool:
	return locked and not TestHooks.planted("hide_locks")


func _draw_pen_meters() -> void:
	_place_meters()
	for pen in board.pens:
		var limit := floori(pen.limit)
		var shown_locked := _shows_locked(pen.locked)
		var color := Palette.c("good") if shown_locked else Palette.c("text")
		var at: Vector2 = _meter_at.get(pen.region, _to_screen(pen.centroid))
		var text := "%d / %d" % [pen.area, limit]
		var width := 120.0
		var text_at := at + Vector2(-width * 0.5, 2)
		draw_string_outline(_font, text_at, text, HORIZONTAL_ALIGNMENT_CENTER, width, 16, 5, Palette.c("background"))
		draw_string(_font, text_at, text, HORIZONTAL_ALIGNMENT_CENTER, width, 16, color)
		# How close it is to fitting: full when area <= limit.
		var bar := Rect2(at + Vector2(-28, 8), Vector2(56, 4))
		var fill := clampf(pen.limit / maxf(1.0, pen.area), 0.0, 1.0)
		draw_rect(bar.grow(1.0), Palette.c("background"))
		draw_rect(Rect2(bar.position, Vector2(bar.size.x * fill, bar.size.y)), color if shown_locked else Color(color, 0.7))
		if shown_locked:
			_draw_lock_icon(at + Vector2(0, -22), Palette.c("good"))


## Puts each pen's meter at the open cell nearest its centre that has room around it (5 by 3
## cells) and isn't on any growing wall's path. Worked out again only when walls start or set.
func _place_meters() -> void:
	var paths: Array[Rect2] = []
	var key := "%d %d %d" % [board.get_instance_id(), board.grid.open_count(), board.pens.size()]
	for half in board.halves:
		key += " %d%s" % [half.wall_id, half.direction]
		var path := WallHalf.new(half.wall_id, half.origin, half.direction)
		path.length = path.target_length(board.grid)
		paths.append(path.rect())
	if key == _meter_key:
		return
	_meter_key = key
	_meter_at.clear()
	if TestHooks.planted("meter_at_centre"):
		return
	var labels := board.regions.labels
	var w := board.grid.width
	for pen in board.pens:
		var best := Vector2i(-1, -1)
		var best_distance := INF
		for index in labels.size():
			if labels[index] != pen.region:
				continue
			var cell := Vector2i(index % w, index / w)
			var distance := (Vector2(cell) + Vector2(0.5, 0.5)).distance_squared_to(pen.centroid)
			if distance >= best_distance or not _meter_fits(cell, pen.region, paths):
				continue
			best = cell
			best_distance = distance
		if best.x >= 0:
			_meter_at[pen.region] = _cell_center(best)


func _meter_fits(cell: Vector2i, region: int, paths: Array[Rect2]) -> bool:
	var box := Rect2(Vector2(cell - Vector2i(2, 1)), Vector2(5, 3))
	for path in paths:
		if path.intersects(box):
			return false
	for y in range(cell.y - 1, cell.y + 2):
		for x in range(cell.x - 2, cell.x + 3):
			if board.regions.region_at(Vector2i(x, y)) != region:
				return false
	return true


## A small padlock, the mark of a locked pen.
func _draw_lock_icon(centre: Vector2, color: Color) -> void:
	draw_rect(Rect2(centre + Vector2(-6, -1), Vector2(12, 9)), Palette.c("background"))
	draw_rect(Rect2(centre + Vector2(-5, 0), Vector2(10, 7)), color)
	draw_arc(centre + Vector2(0, -1), 3.5, PI, TAU, 10, color, 2.0, true)


func _draw_hud() -> void:
	var left := FIELD_ORIGIN.x
	var width := board.grid.width * CELL
	var top := 28.0
	var bottom := 54.0
	var c_text := Palette.c("text")
	var c_dim := Palette.c("text_dim")

	var stage_text := "Endless  %d" % (run.stage - run.stage_count()) if run.is_endless_stage() else "Stage %d / %d" % [run.stage, run.stage_count()]
	draw_string(_font, Vector2(left, top), stage_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, c_text)
	draw_string(_font, Vector2(left, top), Run.thousands(run.score), HORIZONTAL_ALIGNMENT_CENTER, width, 26, c_text)

	# Lives: a filled pip per life, hollow up to the cap.
	var lives_color := Palette.c("bad") if board.lives <= 1 else c_text
	var pips := maxi(run.max_lives(), board.lives)
	var pip_x := left + width - 8.0
	for i in pips:
		var centre := Vector2(pip_x - i * 18.0, top - 7.0)
		if pips - 1 - i < board.lives:
			draw_circle(centre, 6.0, lives_color, true, -1.0, true)
		else:
			draw_circle(centre, 6.0, c_dim, false, 1.5, true)
	draw_string(_font, Vector2(left, top), "Lives  %d" % board.lives, HORIZONTAL_ALIGNMENT_RIGHT, width - pips * 18.0 - 8.0, 18, lives_color)

	var limit_text := "Limit %s per ball  (%d cells)" % [Run.percent(board.pen_limit), floori(board.pen_limit_cells())]
	draw_string(_font, Vector2(left, bottom), limit_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, c_dim)
	var boxed_text := "Boxed  %d / %d" % [board.locked_count(), board.balls.size()]
	draw_string(_font, Vector2(left, bottom), boxed_text, HORIZONTAL_ALIGNMENT_RIGHT, width, 16, Palette.c("good") if board.locked_count() == board.balls.size() else c_dim)

	# XP bar, centred under the score.
	var bar := _xp_bar_rect()
	var c_xp := Palette.c("xp")
	draw_rect(bar, Palette.c("grid_line"))
	var fill := clampf(run.xp / run.xp_needed(), 0.0, 1.0)
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * fill, bar.size.y)), c_xp)
	draw_string(_font, Vector2(bar.position.x - 70, bottom - 2), "Lv %d" % run.level, HORIZONTAL_ALIGNMENT_RIGHT, 62, 16, c_xp)
	if run.pending_levels > 0:
		draw_string(_font, Vector2(bar.end.x + 8, bottom - 2), "+%d upgrade%s" % [run.pending_levels, "s" if run.pending_levels > 1 else ""], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, c_xp)

	_draw_left_column()
	_draw_right_column()


## Left of the field: the controls, and the active ability with its charge.
func _draw_left_column() -> void:
	var c_dim := Palette.c("text_dim")
	var y := FIELD_ORIGIN.y + 24.0
	for line in [["Click", "build"], ["Right / Space", "turn"], ["Esc / P", "pause"]]:
		draw_string(_font, Vector2(COLUMN_LEFT, y), line[0], HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, Palette.c("text"))
		draw_string(_font, Vector2(COLUMN_LEFT, y + 17), line[1], HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, c_dim)
		if line[1] == "turn" and _shows_direction():
			# Which way the next wall grows, always in view.
			draw_string(_font, Vector2(COLUMN_LEFT + 34, y + 17), "now", HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, c_dim)
			_draw_direction_icon(Vector2(COLUMN_LEFT + 80, y + 12), Palette.c("text"))
		y += 42.0
	if board.crossbeam:
		draw_string(_font, Vector2(COLUMN_LEFT, y), "Shift + click", HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, Palette.c("text"))
		draw_string(_font, Vector2(COLUMN_LEFT, y + 17), "+ wall (Crossbeam)", HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, c_dim)
		y += 42.0
	# Hits the walls can still take this stage (Hardened Tip, Close Call).
	for guard in [[board.shield_hits, "Shield", "absorbs a hit"], [board.close_calls, "Close call", "a life is spared"]]:
		if guard[0] > 0:
			draw_string(_font, Vector2(COLUMN_LEFT, y), "%s  ×%d" % [guard[1], guard[0]], HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, Palette.c("text"))
			draw_string(_font, Vector2(COLUMN_LEFT, y + 17), guard[2], HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, c_dim)
			y += 42.0
	if board.active == "":
		return
	var box := Rect2(COLUMN_LEFT, FIELD_ORIGIN.y + board.grid.height * CELL - 92.0, COLUMN_WIDTH, 92.0)
	var ready := board.active_ready()
	var accent := Palette.c("good") if ready else c_dim
	draw_rect(box, Palette.c("panel"))
	draw_rect(box, accent, false, 2.0)
	var key := Rect2(box.position + Vector2(10, 10), Vector2(26, 26))
	draw_rect(key, Palette.c("button"))
	draw_rect(key, accent, false, 1.5)
	draw_string(_font, key.position + Vector2(0, 19), "Q", HORIZONTAL_ALIGNMENT_CENTER, key.size.x, 16, Palette.c("text"))
	var active_name: String = Upgrades.find(board.active)["name"]
	draw_string(_font, box.position + Vector2(44, 29), active_name, HORIZONTAL_ALIGNMENT_LEFT, box.size.x - 50, 16, Palette.c("text"))
	draw_string(_font, box.position + Vector2(10, 58), "Ready" if ready else "%d / %d walls" % [board.active_charge, board.active_cost], HORIZONTAL_ALIGNMENT_LEFT, box.size.x - 20, 14, accent)
	var segments := maxi(1, board.active_cost)
	var seg_width := (box.size.x - 20.0 - (segments - 1) * 3.0) / segments
	for i in segments:
		var seg := Rect2(box.position + Vector2(10 + i * (seg_width + 3.0), 70), Vector2(seg_width, 8))
		draw_rect(seg, accent if i < board.active_charge else Palette.c("grid_line"))


## Right of the field: the kinds of ball in play.
func _draw_right_column() -> void:
	var x := FIELD_ORIGIN.x + board.grid.width * CELL + 16.0
	var y := FIELD_ORIGIN.y + 24.0
	draw_string(_font, Vector2(x, y), "Balls", HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH, 14, Palette.c("text_dim"))
	var counts := {}
	for ball in board.balls:
		counts[ball.kind] = counts.get(ball.kind, 0) + 1
	var kinds := counts.keys()
	kinds.sort()
	for kind in kinds:
		y += 30.0
		var icon := Vector2(x + 8, y - 5)
		var color := Palette.c("ball")
		var r := 6.0
		if kind == Ball.Kind.BIG:
			draw_circle(icon, r + 2.5, Color(color, 0.3), false, 1.5, true)
		if kind == Ball.Kind.SWIFT:
			draw_circle(icon - Vector2(8, 0), 3.0, Color(color, 0.4), true, -1.0, true)
		draw_circle(icon, r, color, true, -1.0, true)
		if kind == Ball.Kind.SWIFT:
			_draw_chevron(icon, Vector2.RIGHT, r, Palette.c("background"))
		if kind == Ball.Kind.SPLITTER:
			draw_line(icon - Vector2(0, r), icon + Vector2(0, r), Palette.c("background"), 2.0)
		if kind == Ball.Kind.DRIFTER:
			draw_circle(icon, r * 0.45, Palette.c("background"), true, -1.0, true)
		draw_string(_font, Vector2(x + 22, y), "%s ×%d" % [Ball.KIND_NAMES[kind], counts[kind]], HORIZONTAL_ALIGNMENT_LEFT, COLUMN_WIDTH - 22, 14, Palette.c("text"))


func _draw_floaters() -> void:
	var reduced := _reduced()
	for f in _floaters:
		var k: float = (_now - f["t0"]) / 1.2
		var rise := 0.0 if reduced else 36.0 * (1.0 - pow(1.0 - k, 2.0))
		var alpha := minf(1.0, (1.0 - k) * 2.5)
		var at: Vector2 = f["at"] + Vector2(-150, -rise)
		draw_string_outline(_font, at, f["text"], HORIZONTAL_ALIGNMENT_CENTER, 300, f["size"], 5, Color(Palette.c("background"), alpha))
		draw_string(_font, at, f["text"], HORIZONTAL_ALIGNMENT_CENTER, 300, f["size"], Color(f["color"], alpha))


## The tutorial tip, in a panel at the bottom of the field. It never takes clicks.
const TIP_WIDTH := 720.0
## Seconds the tip's edge of the field must stay busy before the tip moves to the other edge.
const TIP_MOVE_AFTER := 0.4


func _tip_box(top: bool) -> Rect2:
	var field := _field_rect()
	var size := _font.get_multiline_string_size(tip, HORIZONTAL_ALIGNMENT_CENTER, TIP_WIDTH - 40.0, 18)
	var height := size.y + 46.0
	var y := field.position.y + 12.0 if top else field.end.y - height - 12.0
	return Rect2(field.get_center().x - TIP_WIDTH * 0.5, y, TIP_WIDTH, height)


## Whether play is going on under a tip box: a ball, a growing wall or a pen's meter.
func _tip_covers_play(box: Rect2) -> bool:
	var near := box.grow(CELL)
	for ball in board.balls:
		if near.has_point(_to_screen(ball.position)):
			return true
	for half in board.halves:
		if _rect_to_screen(half.rect()).intersects(near):
			return true
	for pen in board.pens:
		if near.has_point(_to_screen(pen.centroid)):
			return true
	return false


## Moves the tip to the other edge of the field once its edge has been busy for a moment and
## the other edge is clear, so it never sits over the play for long.
## If both edges are busy, it fades until its own edge clears.
func _place_tip(delta: float) -> void:
	var fade_to := 0.0
	if tip == "" or board == null:
		_tip_busy = 0.0
	elif not _tip_covers_play(_tip_box(_tip_top)):
		_tip_busy = 0.0
	else:
		_tip_busy += delta
		if _tip_busy >= TIP_MOVE_AFTER and not TestHooks.planted("tip_stays_put"):
			if not _tip_covers_play(_tip_box(not _tip_top)):
				_tip_top = not _tip_top
				_tip_busy = 0.0
				_tip_since = _now - 0.15  # a quick fade in at the new place
			else:
				fade_to = 1.0
	_tip_fade = move_toward(_tip_fade, fade_to, delta * 5.0)


func _draw_tip() -> void:
	if tip == "":
		return
	var alpha := clampf((_now - _tip_since) / 0.3, 0.0, 1.0) * (1.0 - 0.75 * _tip_fade)
	var width := TIP_WIDTH
	var box := _tip_box(_tip_top)
	draw_rect(box, Color(Palette.c("panel"), 0.88 * alpha))
	draw_rect(box, Color(Palette.c("xp"), 0.8 * alpha), false, 2.0)
	draw_multiline_string(_font, box.position + Vector2(20, 30), tip, HORIZONTAL_ALIGNMENT_CENTER, width - 40.0, 18, -1, Color(Palette.c("text"), alpha))
	draw_string(_font, Vector2(box.position.x, box.end.y - 10), "Tab hides tips", HORIZONTAL_ALIGNMENT_CENTER, width, 13, Color(Palette.c("text_dim"), alpha))

## Effects now on screen, for the test state (reduced-motion checks).
func effects_state() -> Dictionary:
	return {"offset": [snappedf(position.x, 0.01), snappedf(position.y, 0.01)], "shake": snappedf(_shake, 0.01),
		"flash": snappedf(_flash, 0.01), "particles": _particles.size(), "rings": _rings.size(),
		"sweeping": _sweep.size(), "tip_box": _tip_rect_state(), "preview": _preview_mode,
		"danger": _danger_count, "meters": _meter_state()}


## Each pen's meter as [x, y, width, height] in canvas pixels: its text, bar and padlock.
func _meter_state() -> Array:
	var found: Array = []
	if board == null or run == null:
		return found
	for pen in board.pens:
		var at: Vector2 = _meter_at.get(pen.region, _to_screen(pen.centroid))
		found.append([roundi(at.x - 36), roundi(at.y - 28), 72, 40])
	return found


func _tip_rect_state() -> Array:
	if tip == "" or board == null:
		return []
	var box := _tip_box(_tip_top)
	return [roundi(box.position.x), roundi(box.position.y), roundi(box.size.x), roundi(box.size.y), snappedf(_tip_fade, 0.01)]
