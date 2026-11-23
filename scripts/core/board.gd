class_name Board
extends RefCounted
## One stage in play: the grid, balls, walls, lives and pens. Pure logic, stepped at a fixed
## rate by whoever owns it. Things that happen are queued as events; drain them with
## take_events() to drive sound, effects and score.
##
## Events are dictionaries with a "type" key:
##   wall_started   {wall_id, cell, vertical}
##   half_broken    {wall_id, rect, spared, costs_life}  a ball hit a growing half. It costs a
##                  life unless spared (Close Call) or the same ball just broke another half of it
##   half_shielded  {wall_id, rect}         a ball hit a growing half, which a shield saved
##   half_completed {wall_id, cells}         a half turned solid
##   captured       {wall_id, cells, regions}  empty regions were filled
##   wall_finished  {wall_id, cells, regions}  no half of the wall is still growing; totals for it
##   pen_locked     {region, area, limit, cell}  cell: one cell inside the pen
##   ball_split     {position}              a Splitter became two balls
##   active_used    {id, at}                the active ability fired (at: cell position)
##   cleared        {}                       every ball is in a locked pen
##   game_over      {}

enum State { PLAYING, CLEARED, GAME_OVER }

const STEP := 1.0 / 120.0
const WALL_SPEED := 14.0  # cells per second, per half
const START_LIVES := 3
## Balls spawn at least this far apart, in cells, when there's room.
const SPAWN_SPACING := 6.0
## A Splitter splits once its region is smaller than this fraction of the playable area.
const SPLIT_FRACTION := 0.5
## After a shield saves a half, the half ignores balls this long so the ball can get clear.
const SHIELD_GRACE := 0.3
const FREEZE_TIME := 3.0
## A + wall's halves (Crossbeam) grow this much faster than a plain wall's.
const CROSS_SPEED := 1.3
## For this long after a ball breaks or is shielded by a half, its touching the same wall's other
## halves costs nothing more (a ball passing through the origin touches every half).
const REPEAT_HIT_TIME := 0.5


## A region with balls in it, measured against its limit.
class Pen extends RefCounted:
	var region: int
	var area: int
	## Sum of the weights of its balls.
	var weight := 0.0
	var limit := 0.0
	var locked := false
	var balls: Array[Ball] = []
	## The middle of its cells, in cell units.
	var centroid := Vector2.ZERO


var grid: Grid
var balls: Array[Ball] = []
## Halves that are still growing. Solid halves live on as filled cells; broken ones are gone.
var halves: Array[WallHalf] = []
var lives: int
## Each pen may hold up to this fraction of the playable area per ball.
var pen_limit: float
var state := State.PLAYING
var regions: Grid.Regions
var pens: Array[Pen] = []
var captured_cells := 0

# Modifiers, set by upgrades before play starts.
var max_walls := 1
var wall_speed := WALL_SPEED
## A half this many cells or fewer from finishing completes at once.
var last_stretch := 0.0
## Balls freeze this long whenever a wall finishes with no other wall still building, so a
## frozen ball can never sit in a growing half's path.
var stun_time := 0.0
## Ball hits on growing halves that don't cost a life.
var close_calls := 0
## A pen locks when its area is within this fraction over its limit.
var auto_lock := 0.0
## Ball hits on growing halves left to shrug off this stage (Hardened Tip): the ball bounces off
## and the half keeps growing.
var shield_hits := 0
## Walls can be built as a + (four halves).
var crossbeam := false
## The active ability ("freeze", "repel" or ""), and how many walls it takes to recharge.
var active := ""
var active_cost := 0
## Walls completed since the active was last used; it's ready at active_cost.
var active_charge := 0

## Seconds of play so far, and walls started (for run stats and the balance bot).
var time := 0.0
var walls_started := 0

var _next_wall_id := 0
var _events: Array[Dictionary] = []
var _freeze := 0.0
## Per wall still in progress: {cells, regions} captured so far.
var _wall_stats := {}
## Per wall: the last ball that hit it, until when that counts as the same hit, and what it did.
var _wall_hits := {}


func _init(limit_fraction: float, start_lives := START_LIVES, board_grid: Grid = null) -> void:
	pen_limit = limit_fraction
	lives = start_lives
	grid = board_grid if board_grid else Grid.new()
	_update_pens()


## Places balls at random open cell centres, moving diagonally in random directions. The first
## balls take their kinds from `kinds` (Ball.Kind values); the rest are Basic.
func spawn_balls(count: int, rng: RandomNumberGenerator, speed := Ball.DEFAULT_SPEED, radius := Ball.DEFAULT_RADIUS, kinds: Array = []) -> void:
	for i in count:
		var kind: Ball.Kind = kinds[i] if i < kinds.size() else Ball.Kind.BASIC
		var kind_radius := radius * (Ball.BIG_RADIUS if kind == Ball.Kind.BIG else 1.0)
		var best := Vector2.ZERO
		var best_gap := -1.0
		for attempt in 40:
			var cell := Vector2i(rng.randi_range(1, grid.width - 2), rng.randi_range(1, grid.height - 2))
			var at := Vector2(cell) + Vector2(0.5, 0.5)
			if grid.is_filled(cell) or Ball.new(at, Vector2.ZERO, kind_radius).overlaps_filled(grid, at):
				continue
			var gap := INF
			for other in balls:
				gap = minf(gap, at.distance_to(other.position))
			if gap > best_gap:
				best = at
				best_gap = gap
			if gap >= SPAWN_SPACING:
				break
		var x_sign := 1 if rng.randi() % 2 == 0 else -1
		var y_sign := 1 if rng.randi() % 2 == 0 else -1
		var turn_sign := 1 if rng.randi() % 2 == 0 else -1
		balls.append(Ball.of_kind(kind, best, Vector2(x_sign, y_sign), speed, radius, turn_sign))
	_update_pens()


func add_ball(ball: Ball) -> void:
	balls.append(ball)
	_update_pens()


func take_events() -> Array[Dictionary]:
	var events := _events
	_events = []
	return events


## The pen limit for one ball, in cells.
func pen_limit_cells() -> float:
	return pen_limit * grid.playable_area


func walls_building() -> int:
	var ids := {}
	for half in halves:
		ids[half.wall_id] = true
	return ids.size()


func locked_count() -> int:
	var count := 0
	for ball in balls:
		if ball.locked:
			count += 1
	return count


func is_frozen() -> bool:
	return _freeze > 0.0


func freeze_left() -> float:
	return _freeze


func active_ready() -> bool:
	return active != "" and state == State.PLAYING and active_charge >= active_cost


## Fires the active ability. `at` is the cursor, in cells. Returns false if it isn't ready.
func use_active(at: Vector2) -> bool:
	if not active_ready():
		return false
	match active:
		"freeze":
			_freeze = maxf(_freeze, FREEZE_TIME)
		"repel":
			for ball in balls:
				var away := ball.position - at
				if absf(away.x) > 0.01:
					ball.velocity.x = absf(ball.velocity.x) * signf(away.x)
				if absf(away.y) > 0.01:
					ball.velocity.y = absf(ball.velocity.y) * signf(away.y)
	active_charge = 0
	_events.append({"type": "active_used", "id": active, "at": at})
	return true


func pen_for_region(region: int) -> Pen:
	for pen in pens:
		if pen.region == region:
			return pen
	return null


func can_start_wall(cell: Vector2i) -> bool:
	if state != State.PLAYING or grid.is_filled(cell) or walls_building() >= max_walls:
		return false
	var rect := Rect2(cell, Vector2.ONE)
	for half in halves:
		if half.rect().intersects(rect):
			return false
	for ball in balls:
		if ball.overlaps_rect(rect):
			return false
	return true


## The directions a wall's halves grow in. A cross (Crossbeam) grows all four ways.
static func wall_directions(vertical: bool, cross := false) -> Array[Vector2i]:
	if cross:
		return [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]
	if vertical:
		return [Vector2i.UP, Vector2i.DOWN]
	return [Vector2i.LEFT, Vector2i.RIGHT]


## Starts a wall at an open cell. Returns false if it can't be built there right now.
## `cross` builds a + wall, if Crossbeam allows it.
func start_wall(cell: Vector2i, vertical: bool, cross := false) -> bool:
	if not can_start_wall(cell):
		return false
	cross = cross and crossbeam
	var id := _next_wall_id
	_next_wall_id += 1
	walls_started += 1
	for direction in wall_directions(vertical, cross):
		var half := WallHalf.new(id, cell, direction)
		if cross:
			half.speed = CROSS_SPEED
		halves.append(half)
	_wall_stats[id] = {"cells": 0, "regions": 0, "solid": 0}
	_events.append({"type": "wall_started", "wall_id": id, "cell": cell, "vertical": vertical, "cross": cross})
	return true


## Advances the stage by dt seconds (normally STEP).
func step(dt := STEP) -> void:
	if state == State.GAME_OVER:
		return
	if state == State.PLAYING:
		time += dt
	if _freeze > 0.0:
		_freeze = maxf(0.0, _freeze - dt)
	else:
		for ball in balls:
			ball.step(grid, dt)
	if state != State.PLAYING:
		return

	var completed: Array[WallHalf] = []
	for half in halves:
		var done := half.grow(grid, wall_speed * half.speed * dt, last_stretch)
		var ball := _touching_ball(half.rect())
		var touched := ball != null
		if half.grace > 0.0:
			half.grace = maxf(0.0, half.grace - dt)
			if touched:
				continue  # the deflected ball is still getting clear; don't set over it
		# One ball costs a wall at most one shield or one life, however many of its halves it
		# touches on one pass (they all cover the origin cell).
		var previous: Dictionary = _wall_hits.get(half.wall_id, {})
		var repeat: bool = touched and previous.get("ball") == ball and time < previous.get("until", 0.0)
		if repeat and previous["kind"] == "shielded":
			half.grace = SHIELD_GRACE
		elif touched and not repeat and shield_hits > 0:
			shield_hits -= 1
			half.grace = SHIELD_GRACE
			_wall_hits[half.wall_id] = {"ball": ball, "until": time + REPEAT_HIT_TIME, "kind": "shielded"}
			_deflect_from(half.rect())
			_events.append({"type": "half_shielded", "wall_id": half.wall_id, "rect": half.rect()})
		elif touched:
			half.state = WallHalf.State.BROKEN
			var spared := not repeat and close_calls > 0
			if spared:
				close_calls -= 1
			elif not repeat:
				lives -= 1
			if not repeat:
				_wall_hits[half.wall_id] = {"ball": ball, "until": time + REPEAT_HIT_TIME, "kind": "broken"}
			_events.append({"type": "half_broken", "wall_id": half.wall_id, "rect": half.rect(), "spared": spared, "costs_life": not repeat and not spared})
		elif done:
			completed.append(half)

	if lives <= 0:
		lives = 0
		halves.clear()
		state = State.GAME_OVER
		_finish_walls()
		_events.append({"type": "game_over"})
		return

	for half in completed:
		if half.is_growing():  # an earlier capture this step may have finished it already
			_solidify(half)
	halves = halves.filter(func(h: WallHalf) -> bool: return h.is_growing())
	_finish_walls()


func _touching_ball(rect: Rect2) -> Ball:
	for ball in balls:
		if ball.overlaps_rect(rect):
			return ball
	return null


## Bounces every ball touching the rect away from it, as if it were solid.
func _deflect_from(rect: Rect2) -> void:
	for ball in balls:
		if not ball.overlaps_rect(rect):
			continue
		var away := ball.position - ball.position.clamp(rect.position, rect.end)
		if away.length_squared() < 0.000001:
			# The centre is inside the half: leave across its short side.
			away = ball.position - rect.get_center()
			if rect.size.x > rect.size.y:
				away.x = 0.0
			else:
				away.y = 0.0
		if absf(away.x) > absf(away.y):
			ball.velocity.x = absf(ball.velocity.x) * signf(away.x)
		else:
			ball.velocity.y = absf(ball.velocity.y) * signf(away.y)


func _solidify(half: WallHalf) -> void:
	var cells := half.cells(grid)
	half.state = WallHalf.State.SOLID
	grid.fill_cells(cells)
	if _wall_stats.has(half.wall_id):
		_wall_stats[half.wall_id]["solid"] += 1
	_events.append({"type": "half_completed", "wall_id": half.wall_id, "cells": cells})
	_capture(half.wall_id)


## Fills every region that no ball touches, then re-measures the pens.
func _capture(wall_id: int) -> void:
	regions = grid.find_regions()
	var occupied := {}
	for ball in balls:
		var area := Ball.cells_under(ball.position, ball.radius)
		for y in range(area.position.y, area.end.y):
			for x in range(area.position.x, area.end.x):
				var region := regions.region_at(Vector2i(x, y))
				if region != Grid.Regions.NONE:
					occupied[region] = true

	var captured := PackedVector2Array()
	var region_count := 0
	for region in regions.count():
		if occupied.has(region):
			continue
		var cells := regions.cells(region)
		grid.fill_cells(cells)
		captured.append_array(cells)
		region_count += 1
	if region_count > 0:
		captured_cells += captured.size()
		if _wall_stats.has(wall_id):
			_wall_stats[wall_id]["cells"] += captured.size()
			_wall_stats[wall_id]["regions"] += region_count
		_events.append({"type": "captured", "wall_id": wall_id, "cells": captured, "regions": region_count})

	# A growing half whose path was captured has nothing left to fill.
	for half in halves:
		if half.is_growing() and grid.is_filled(half.origin) and grid.is_filled(half.origin + half.direction):
			half.state = WallHalf.State.SOLID
	_split_splitters()
	_update_pens()


## Splits each Splitter whose region has dropped below SPLIT_FRACTION of the field into two
## Basic balls heading apart.
func _split_splitters() -> void:
	for ball in balls.duplicate():
		if ball.kind != Ball.Kind.SPLITTER:
			continue
		var region := regions.region_at(ball.cell())
		if region == Grid.Regions.NONE or regions.area(region) >= grid.playable_area * SPLIT_FRACTION:
			continue
		balls.erase(ball)
		for x_flip in [1.0, -1.0]:
			var heading := Vector2(ball.velocity.x * x_flip, ball.velocity.y)
			balls.append(Ball.of_kind(Ball.Kind.BASIC, ball.position, heading, ball.velocity.length(), ball.radius))
		_events.append({"type": "ball_split", "position": ball.position})


## Reports each wall that has no half left growing.
func _finish_walls() -> void:
	var growing := {}
	for half in halves:
		if half.is_growing():
			growing[half.wall_id] = true
	for id in _wall_stats.keys():
		if growing.has(id):
			continue
		var stats: Dictionary = _wall_stats[id]
		_wall_stats.erase(id)
		_wall_hits.erase(id)
		if stats["solid"] > 0 and active != "":
			active_charge = mini(active_charge + 1, active_cost)
		if stats["solid"] > 0 and stun_time > 0.0 and growing.is_empty() and state == State.PLAYING:
			_freeze = maxf(_freeze, stun_time)

		_events.append({"type": "wall_finished", "wall_id": id, "cells": stats["cells"], "regions": stats["regions"]})


func _update_pens() -> void:
	regions = grid.find_regions()
	pens.clear()
	var by_region := {}
	for ball in balls:
		var region := regions.region_at(ball.cell())
		if region == Grid.Regions.NONE:
			continue
		var pen: Pen = by_region.get(region)
		if pen == null:
			pen = Pen.new()
			pen.region = region
			pen.area = regions.area(region)
			by_region[region] = pen
			pens.append(pen)
		pen.weight += ball.weight
		pen.balls.append(ball)

	var sums := {}
	for index in regions.labels.size():
		var region := regions.labels[index]
		if by_region.has(region):
			sums[region] = sums.get(region, Vector2.ZERO) + Vector2(grid.cell_of(index)) + Vector2(0.5, 0.5)

	for pen in pens:
		pen.limit = pen_limit_cells() * pen.weight
		pen.locked = pen.area <= pen.limit * (1.0 + auto_lock)
		pen.centroid = sums[pen.region] / pen.area
		var newly_locked := false
		for ball in pen.balls:
			if pen.locked and not ball.locked:
				newly_locked = true
			ball.locked = pen.locked
		if newly_locked:
			_events.append({"type": "pen_locked", "region": pen.region, "area": pen.area, "limit": pen.limit, "cell": pen.balls[0].cell()})

	if state == State.PLAYING and not balls.is_empty() and locked_count() == balls.size():
		state = State.CLEARED
		halves.clear()
		_events.append({"type": "cleared"})
