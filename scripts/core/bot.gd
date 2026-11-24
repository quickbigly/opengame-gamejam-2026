class_name Bot
extends RefCounted
## A simulated player, for balancing. It plays a Board the way a person might: it watches the
## balls, guesses where they'll go, looks for a wall that cuts away the most space without being
## hit, and clicks after a human reaction time. Pure logic, seeded, so a run replays exactly.
##
## Skill tiers differ in how far ahead they read the balls, how much room they leave, how quickly
## and precisely they click, how many walls they consider and how long they wait for a safe gap.
## The "random" tier clicks anywhere, as a check that mashing doesn't win.
##
## Call begin() with each stage's board, then update() after every Board.step().
## With Crossbeam it weighs + walls too. It fires Freeze or Repel before a long wall, or when it
## has had no safe wall for a while.

## Board steps per prediction sample, and the sample spacing in seconds.
const SAMPLE_STEPS := 4
const SAMPLE_DT := Board.STEP * SAMPLE_STEPS
## A wall that puts balls into one more separate space is worth this many cells.
const SEPARATE_BONUS := 12.0
## A wall that locks a pen is worth this many cells per ball it boxes in.
const LOCK_BONUS := 60.0
## Each captured cell is worth a little on its own, to break ties toward bigger captures.
const CELL_VALUE := 0.05
## Cells of value given up per second a wall takes to finish (shorter walls are safer).
const TIME_COST := 3.0
## Seconds without a safe wall before the bot reaches for its active.
const ACTIVE_AFTER := 1.0
## It also fires a ready active just before any wall that takes longer than this to set.
const ACTIVE_WALL_TIME := 0.8

## think: seconds between looks. decide: seconds a person spends choosing the next wall after
## clicking one (and at the start of a stage). delay: reaction time from deciding to clicking.
## anticipate: how much of its own reaction time it allows for. horizon: seconds of ball motion
## it reads ahead. bounces: how many bounces of each ball it foresees; past those it doesn't
## know where the ball goes and ignores it, as people do. margin: extra room, in cells, it
## wants between a ball and a growing wall.
## misclick: chance the click lands one cell off. segments: walls it considers per layout.
## tries: best walls it checks for safety each look. noise: how far its sense of a wall's worth
## wobbles (0.5 = ±50%). patience: seconds without a safe wall before it gambles on the best one.
##
## Persona profiles (docs/persona-playtest.md) add, all optional: fixed_walls: walls it builds in
## the starting direction before it discovers turning; picks: how it chooses upgrades in the
## balance report ("random", or "stack": what it already holds first, then the strongest).
const TIERS := {
	"novice": {"think": 0.35, "decide": [0.8, 2.0], "delay": [0.4, 0.9], "anticipate": 0.0, "horizon": 1.0, "bounces": 0,
		"margin": 0.2, "misclick": 0.15, "segments": 12, "tries": 5, "noise": 0.5, "patience": 4.0},
	"average": {"think": 0.25, "decide": [0.5, 1.2], "delay": [0.3, 0.6], "anticipate": 0.5, "horizon": 1.5, "bounces": 1,
		"margin": 0.2, "misclick": 0.06, "segments": 24, "tries": 10, "noise": 0.25, "patience": 8.0},
	"expert": {"think": 0.15, "decide": [0.25, 0.6], "delay": [0.2, 0.35], "anticipate": 0.8, "horizon": 2.5, "bounces": 2,
		"margin": 0.35, "misclick": 0.02, "segments": 48, "tries": 16, "noise": 0.05, "patience": 20.0},
	# P2, new to the genre: a novice's reads, and only horizontal walls until its fifth.
	"newcomer": {"think": 0.4, "decide": [1.0, 2.5], "delay": [0.45, 1.0], "anticipate": 0.0, "horizon": 1.0, "bounces": 0,
		"margin": 0.1, "misclick": 0.15, "segments": 12, "tries": 4, "noise": 0.6, "patience": 3.0, "fixed_walls": 4},
	# P1, a judge in a hurry: average reads, but it barely waits for a safe gap.
	"hurried": {"think": 0.25, "decide": [0.15, 0.5], "delay": [0.25, 0.5], "anticipate": 0.3, "horizon": 0.8, "bounces": 0,
		"margin": 0.0, "misclick": 0.08, "segments": 24, "tries": 4, "noise": 0.3, "patience": 0.6},
	# P3, a genre veteran: an expert's reads, and it stacks upgrades it already holds.
	"minmaxer": {"think": 0.15, "decide": [0.25, 0.6], "delay": [0.2, 0.35], "anticipate": 0.8, "horizon": 2.5, "bounces": 2,
		"margin": 0.35, "misclick": 0.02, "segments": 48, "tries": 16, "noise": 0.05, "patience": 20.0, "picks": "stack"},
	"random": {"think": 0.6, "decide": [0.0, 0.0], "delay": [0.0, 0.0], "anticipate": 0.0, "horizon": 0.0, "bounces": 0,
		"margin": 0.0, "misclick": 0.0, "segments": 0, "tries": 0, "noise": 0.0, "patience": 0.0},
}


## A straight run of open cells: every wall started on it fills the same cells. Or, with
## Crossbeam, a + wall: the vertical and horizontal runs through one centre cell.
class Segment extends RefCounted:
	var vertical: bool
	var cross := false
	## Grid indices: a run's from top or left; a cross's two runs, its centre once.
	var cells := PackedInt32Array()
	## A cross's centre cell, and its arms' lengths (up, down, left, right) to where they set.
	var centre := Vector2i.ZERO
	var arms := PackedFloat32Array()
	var region: int
	## Piece id per grid index once the run is filled; -1 elsewhere.
	var labels := PackedInt32Array()
	var areas := PackedInt32Array()


var tier_name: String
var tier: Dictionary
var rng := RandomNumberGenerator.new()
var board: Board

## Advise only (persona playtests): instead of acting on the board, the bot queues what it would
## do in `advice`, and a browser test does it with real mouse clicks and keys. Each entry:
## {id, kind: "wall", cell, vertical, cross} or {id, kind: "active", at}.
var advise_only := false
var advice: Array[Dictionary] = []
var _advice_id := 0
var _active_advised_at := -INF

## Looks taken, walls clicked, actives used and gambles taken, for the report.
var looks := 0
var clicks := 0
var actives_used := 0
var gambles := 0

var _next_look := 0.0
var _stuck_since := -1.0
var _plan := {}

# Layout cache, rebuilt when the grid changes.
var _layout_version := -1
var _segments: Array[Segment] = []
var _region_cells := {}

# Ball prediction: _pred[k] holds every ball's position SAMPLE_DT × k after _pred_time.
var _pred: Array[PackedVector2Array] = []
var _pred_vel: Array[PackedVector2Array] = []
var _pred_time := 0.0
var _pred_version := -1
var _clones: Array[Ball] = []
var _clone_freeze := 0.0
## Per ball, the last prediction sample this player can foresee.
var _foreseen := PackedInt32Array()


func _init(name: String, seed_value: int) -> void:
	assert(TIERS.has(name), "unknown bot tier " + name)
	tier_name = name
	tier = TIERS[name]
	rng.seed = seed_value


func begin(new_board: Board) -> void:
	board = new_board
	_plan = {}
	_stuck_since = -1.0
	_layout_version = -1
	_pred_version = -1
	_next_look = _range(tier["decide"])


func update() -> void:
	if board == null or board.state != Board.State.PLAYING:
		return
	var now := board.time
	if not _plan.is_empty():
		if now >= _plan["at"]:
			if advise_only:
				_advise({"kind": "wall", "cell": _plan["cell"], "vertical": _plan["vertical"], "cross": _plan["cross"]})
				clicks += 1
				_next_look = now + _range(tier["decide"])
			elif board.start_wall(_plan["cell"], _plan["vertical"], _plan["cross"]):
				clicks += 1
				_next_look = now + _range(tier["decide"])
			else:
				_next_look = now + tier["think"]
			_plan = {}
		return
	if now < _next_look:
		return
	_next_look = now + tier["think"]
	if board.walls_building() >= board.max_walls:
		_stuck_since = -1.0
		return
	looks += 1
	if tier_name == "random":
		_click_randomly()
	else:
		_look()


func _advise(entry: Dictionary) -> void:
	_advice_id += 1
	entry["id"] = _advice_id
	advice.append(entry)
	if advice.size() > 8:
		advice.pop_front()


## Fires the active at a cell, or advises it.
func _use_active(cell: Vector2i) -> void:
	var at := Vector2(cell) + Vector2(0.5, 0.5)
	if advise_only:
		if board.time - _active_advised_at < 1.0:
			return  # still waiting for the last one to be fired
		_active_advised_at = board.time
		_advise({"kind": "active", "at": at})
	else:
		board.use_active(at)
	actives_used += 1
	_pred_version = -1


func _range(bounds: Array) -> float:
	return rng.randf_range(bounds[0], bounds[1])


func _schedule(cell: Vector2i, vertical: bool, cross := false) -> void:
	if rng.randf() < tier["misclick"]:
		cell += [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN][rng.randi() % 4]
	_plan = {"at": board.time + _range(tier["delay"]), "cell": cell, "vertical": vertical, "cross": cross}


func _click_randomly() -> void:
	var cell := Vector2i(rng.randi_range(1, board.grid.width - 2), rng.randi_range(1, board.grid.height - 2))
	if board.grid.is_open(cell):
		_schedule(cell, rng.randf() < 0.5)


# --- Looking for a wall ------------------------------------------------------------------------

func _look() -> void:
	_refresh_layout()
	if _segments.is_empty():
		return
	var horizon: float = tier["horizon"]
	var lead := roundi(tier["anticipate"] * _mean_delay() / SAMPLE_DT)
	var horizon_samples := ceili(horizon / SAMPLE_DT)
	_ensure_prediction(lead + horizon_samples + 1)
	_find_foreseen()

	# Rank every known run of cells by what a wall on it would win, with this player's wobble.
	var ranked: Array = []
	# Past 15 s without a way through, even a newcomer tries the other button.
	var straight_only: bool = clicks < tier.get("fixed_walls", 0) and board.time < 15.0
	for segment in _segments:
		if straight_only and (segment.vertical or segment.cross):
			continue
		var timing := _completion_time(segment, _origins(segment)[0])
		var value := _value(segment, mini(lead + ceili(timing / SAMPLE_DT), _pred.size() - 1))
		if is_nan(value):
			continue
		value -= TIME_COST * timing
		value *= 1.0 + rng.randf_range(-1.0, 1.0) * tier["noise"]
		if value > 0.0:
			ranked.append([value, segment])
	if ranked.is_empty():
		return
	ranked.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])

	# Click the best one that looks safe, trying a few start cells along it.
	for i in mini(tier["tries"], ranked.size()):
		var segment: Segment = ranked[i][1]
		for origin in _origins(segment):
			var cell := _origin_cell(segment, origin)
			if board.can_start_wall(cell) and _safe(segment, origin, lead, horizon_samples):
				_stuck_since = -1.0
				if board.active_ready() and _completion_time(segment, origin) > ACTIVE_WALL_TIME:
					_use_active(cell)
				_schedule(cell, segment.vertical, segment.cross)
				return

	# Nothing safe right now.
	if _stuck_since < 0.0:
		_stuck_since = board.time
	var stuck := board.time - _stuck_since
	var best: Segment = ranked[0][1]
	var best_cell := _origin_cell(best, _origins(best)[0])
	if stuck >= ACTIVE_AFTER and board.active_ready():
		_use_active(best_cell)
		_next_look = board.time  # look again straight away
		return
	if stuck >= tier["patience"] and board.can_start_wall(best_cell):
		gambles += 1
		_stuck_since = -1.0
		_schedule(best_cell, best.vertical, best.cross)


func _mean_delay() -> float:
	var delay: Array = tier["delay"]
	return (delay[0] + delay[1]) * 0.5


## Start cells to try along a run: the middle (quickest to finish), then two random ones.
## A cross has only its centre.
func _origins(segment: Segment) -> PackedInt32Array:
	var n := segment.cells.size()
	var result := PackedInt32Array([n / 2])
	if n > 2 and not segment.cross:
		result.append(rng.randi_range(0, n - 1))
		result.append(rng.randi_range(0, n - 1))
	return result


func _origin_cell(segment: Segment, origin: int) -> Vector2i:
	return segment.centre if segment.cross else board.grid.cell_of(segment.cells[origin])


## The wall's halves when started at cells[origin]: [direction, length to where it sets] each.
func _halves(segment: Segment, origin: int) -> Array:
	if segment.cross:
		return [[Vector2i.UP, segment.arms[0]], [Vector2i.DOWN, segment.arms[1]],
			[Vector2i.LEFT, segment.arms[2]], [Vector2i.RIGHT, segment.arms[3]]]
	var axis := Vector2i.DOWN if segment.vertical else Vector2i.RIGHT
	return [[-axis, origin + 0.5], [axis, segment.cells.size() - origin - 0.5]]


## Seconds until the slowest half of a wall started at cells[origin] sets.
func _completion_time(segment: Segment, origin: int) -> float:
	var longest := 0.0
	for half in _halves(segment, origin):
		longest = maxf(longest, half[1])
	return maxf(0.0, longest - board.last_stretch) / _wall_speed(segment)


func _wall_speed(segment: Segment) -> float:
	return board.wall_speed * (Board.CROSS_SPEED if segment.cross else 1.0)


## What a wall on this run would win, in cells: the drop in space still to cut, plus a bonus
## for separating balls. NAN if a ball is predicted to sit on the wall when it sets.
func _value(segment: Segment, sample: int) -> float:
	var positions := _pred[sample]
	var region_area := 0
	for area in segment.areas:
		region_area += area
	region_area += segment.cells.size()
	var limit := board.pen_limit_cells() * (1.0 + board.auto_lock)
	var weight := 0.0
	var piece_weight := {}
	for j in board.balls.size():
		var ball := board.balls[j]
		if board.regions.region_at(ball.cell()) != segment.region:
			continue
		weight += ball.weight
		var at := Vector2i(positions[j].floor())
		if not board.grid.in_bounds(at):
			return NAN
		var piece := segment.labels[board.grid.index_of(at)]
		if piece < 0:
			return NAN
		piece_weight[piece] = piece_weight.get(piece, 0.0) + ball.weight
	var before := maxf(0.0, region_area - weight * limit)
	var after := 0.0
	var kept := 0
	var locked_weight := 0.0
	for piece in piece_weight:
		var room: float = piece_weight[piece] * limit
		after += maxf(0.0, segment.areas[piece] - room)
		kept += segment.areas[piece]
		if segment.areas[piece] <= room:
			locked_weight += piece_weight[piece]
	var captured := region_area - segment.cells.size() - kept
	var separated := SEPARATE_BONUS * (piece_weight.size() - 1)
	return before - after + LOCK_BONUS * locked_weight + CELL_VALUE * captured + separated


## Whether no ball (with the tier's margin) touches either half while it grows, as far ahead
## as the player reads. `lead` is how many samples later than now the wall is expected to start.
func _safe(segment: Segment, origin: int, lead: int, horizon_samples: int) -> bool:
	var cell := _origin_cell(segment, origin)
	var near := PackedInt32Array()
	for j in board.balls.size():
		if board.regions.region_at(board.balls[j].cell()) == segment.region:
			near.append(j)
	var margin: float = tier["margin"]
	var centre := Vector2(cell) + Vector2(0.5, 0.5)
	var origin_rect := Rect2(cell, Vector2.ONE)
	for half in _halves(segment, origin):
		var direction: Vector2i = half[0]
		var target: float = half[1]
		var side := Vector2(absi(direction.y), absi(direction.x)) * 0.5
		var finish := maxf(0.0, target - board.last_stretch) / _wall_speed(segment)
		var samples := mini(ceili(finish / SAMPLE_DT), horizon_samples)
		for k in samples + 1:
			var length := minf(k * SAMPLE_DT * _wall_speed(segment), target)
			if target - length <= board.last_stretch:
				length = target
			var rect := origin_rect.expand(centre + Vector2(direction) * length + side).expand(centre + Vector2(direction) * length - side)
			var sample := mini(lead + k, _pred.size() - 1)
			var positions := _pred[sample]
			for j in near:
				if sample <= _foreseen[j] and Ball.circle_overlaps_rect(positions[j], board.balls[j].radius + margin, rect):
					return false
	return true


## For each ball, the last sample whose position this player can foresee: the one before the
## bounce after the `bounces` bounces they can follow.
func _find_foreseen() -> void:
	var bounces: int = tier["bounces"]
	_foreseen.resize(board.balls.size())
	for j in board.balls.size():
		_foreseen[j] = _pred.size() - 1
		var seen := 0
		for k in range(1, _pred.size()):
			var before := _pred_vel[k - 1][j]
			var after := _pred_vel[k][j]
			if signf(before.x) != signf(after.x) or signf(before.y) != signf(after.y):
				seen += 1
				if seen > bounces:
					_foreseen[j] = k - 1
					break


# --- Layout: runs of open cells and the pieces a wall on each leaves --------------------------

func _refresh_layout() -> void:
	var version := board.grid.open_count() * 64 + board.pens.size()
	if version == _layout_version:
		return
	_layout_version = version
	_segments.clear()
	_region_cells.clear()
	var grid := board.grid
	var regions := board.regions
	var targets := {}
	for pen in board.pens:
		if not pen.locked:
			targets[pen.region] = true
			_region_cells[pen.region] = []
	if targets.is_empty():
		return
	for index in regions.labels.size():
		var region := regions.labels[index]
		if targets.has(region):
			_region_cells[region].append(index)

	# Every maximal vertical and horizontal run in a region that still needs cutting.
	var found: Array[Segment] = []
	for region in _region_cells:
		for index in _region_cells[region]:
			var cell := grid.cell_of(index)
			for vertical in [true, false]:
				var back := Vector2i.UP if vertical else Vector2i.LEFT
				if grid.is_open(cell + back):
					continue  # not the start of a run
				var segment := Segment.new()
				segment.vertical = vertical
				segment.region = region
				var at := cell
				while grid.is_open(at):
					segment.cells.append(grid.index_of(at))
					at -= back
				found.append(segment)

	# With Crossbeam, + walls on a third as many centre cells.
	if board.crossbeam:
		var all_cells: Array = []
		for region in _region_cells:
			all_cells.append_array(_region_cells[region])
		for i in tier["segments"] / 3:
			found.append(_cross_at(grid.cell_of(all_cells[rng.randi() % all_cells.size()])))

	# Each player only weighs some of them; shuffle with the bot's seed and keep that many.
	for i in range(found.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var swap := found[i]
		found[i] = found[j]
		found[j] = swap
	found.resize(mini(found.size(), tier["segments"]))
	for segment in found:
		_partition(segment)
		_segments.append(segment)


## A + wall centred on an open cell.
func _cross_at(centre: Vector2i) -> Segment:
	var grid := board.grid
	var segment := Segment.new()
	segment.cross = true
	segment.centre = centre
	segment.region = board.regions.region_at(centre)
	segment.cells.append(grid.index_of(centre))
	for direction in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
		var n := 1
		while grid.is_open(centre + direction * n):
			segment.cells.append(grid.index_of(centre + direction * n))
			n += 1
		segment.arms.append(n - 0.5)
	return segment


## Labels the pieces the segment's region falls into once the segment is filled.

func _partition(segment: Segment) -> void:
	var width := board.grid.width
	var region_labels := board.regions.labels
	var labels := PackedInt32Array()
	labels.resize(region_labels.size())
	labels.fill(-1)
	for index in segment.cells:
		labels[index] = -2
	var stack := PackedInt32Array()
	for start in _region_cells[segment.region]:
		if labels[start] != -1:
			continue
		var piece := segment.areas.size()
		var area := 0
		labels[start] = piece
		stack.append(start)
		while not stack.is_empty():
			var index := stack[stack.size() - 1]
			stack.resize(stack.size() - 1)
			area += 1
			# The border is always filled, so neighbours never leave the grid. Unrolled: this is
			# the bot's hottest loop.
			var next := index + 1
			if labels[next] == -1 and region_labels[next] == segment.region:
				labels[next] = piece
				stack.append(next)
			next = index - 1
			if labels[next] == -1 and region_labels[next] == segment.region:
				labels[next] = piece
				stack.append(next)
			next = index + width
			if labels[next] == -1 and region_labels[next] == segment.region:
				labels[next] = piece
				stack.append(next)
			next = index - width
			if labels[next] == -1 and region_labels[next] == segment.region:
				labels[next] = piece
				stack.append(next)
		segment.areas.append(area)
	for index in segment.cells:
		labels[index] = -1
	segment.labels = labels


# --- Prediction ---------------------------------------------------------------------------------

## Makes sure _pred[0] is now and the prediction runs at least `count` samples ahead. Balls don't
## bounce off growing walls, so their paths only change when the grid does, or when something
## pushes them (a hardened half, Repel); either throws the prediction away.
func _ensure_prediction(count: int) -> void:
	var valid := _pred_version == board.grid.open_count() and _clones.size() == board.balls.size()
	if valid:
		var offset := roundi((board.time - _pred_time) / SAMPLE_DT)
		_extend(offset + 1)
		_pred = _pred.slice(offset)
		_pred_vel = _pred_vel.slice(offset)
		_pred_time += offset * SAMPLE_DT
		for j in board.balls.size():
			# A drifter turns a little between samples; a push flips its heading.
			if board.balls[j].velocity.normalized().dot(_pred_vel[0][j].normalized()) < 0.98:
				valid = false
				break
	if not valid:
		_pred_version = board.grid.open_count()
		_pred_time = board.time
		_clones.clear()
		for ball in board.balls:
			_clones.append(ball.copy())
		_clone_freeze = board.freeze_left()
		_pred.clear()
		_pred_vel.clear()
		_record_sample()
	_extend(count)


func _extend(count: int) -> void:
	while _pred.size() < count:
		for i in SAMPLE_STEPS:
			if _clone_freeze > 0.0:
				_clone_freeze = maxf(0.0, _clone_freeze - Board.STEP)
				continue
			for clone in _clones:
				clone.step(board.grid, Board.STEP)
		_record_sample()


func _record_sample() -> void:
	var positions := PackedVector2Array()
	var velocities := PackedVector2Array()
	for clone in _clones:
		positions.append(clone.position)
		velocities.append(clone.velocity)
	_pred.append(positions)
	_pred_vel.append(velocities)
