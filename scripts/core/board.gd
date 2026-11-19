class_name Board
extends RefCounted
## One stage in play: the grid, balls, walls, lives and pens. Pure logic, stepped at a fixed
## rate by whoever owns it. Things that happen are queued as events; drain them with
## take_events() to drive sound, effects and score.
##
## Events are dictionaries with a "type" key:
##   wall_started   {wall_id, cell, vertical}
##   half_broken    {wall_id, rect}        a ball hit a growing half; a life is lost
##   half_completed {wall_id, cells}       a half turned solid
##   captured       {wall_id, cells, regions}  empty regions were filled
##   pen_locked     {region, area, limit}
##   cleared        {}                     every ball is in a locked pen
##   game_over      {}

enum State { PLAYING, CLEARED, GAME_OVER }

const STEP := 1.0 / 120.0
const WALL_SPEED := 14.0  # cells per second, per half
const START_LIVES := 3
## Balls spawn at least this far apart, in cells, when there's room.
const SPAWN_SPACING := 6.0


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
var max_walls := 1
var wall_speed := WALL_SPEED

var _next_wall_id := 0
var _events: Array[Dictionary] = []


func _init(limit_fraction: float, start_lives := START_LIVES, board_grid: Grid = null) -> void:
	pen_limit = limit_fraction
	lives = start_lives
	grid = board_grid if board_grid else Grid.new()
	_update_pens()


## Places balls at random open cell centres, moving diagonally in random directions.
func spawn_balls(count: int, rng: RandomNumberGenerator, speed := Ball.DEFAULT_SPEED) -> void:
	for i in count:
		var best := Vector2.ZERO
		var best_gap := -1.0
		for attempt in 40:
			var cell := Vector2i(rng.randi_range(1, grid.width - 2), rng.randi_range(1, grid.height - 2))
			if grid.is_filled(cell):
				continue
			var at := Vector2(cell) + Vector2(0.5, 0.5)
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
		balls.append(Ball.new(best, Ball.diagonal(speed, x_sign, y_sign)))
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


func pen_for_region(region: int) -> Pen:
	for pen in pens:
		if pen.region == region:
			return pen
	return null


func can_start_wall(cell: Vector2i) -> bool:
	if state != State.PLAYING or grid.is_filled(cell) or walls_building() >= max_walls:
		return false
	var rect := Rect2(cell, Vector2.ONE)
	for ball in balls:
		if ball.overlaps_rect(rect):
			return false
	return true


## Starts a wall at an open cell. Returns false if it can't be built there right now.
func start_wall(cell: Vector2i, vertical: bool) -> bool:
	if not can_start_wall(cell):
		return false
	var id := _next_wall_id
	_next_wall_id += 1
	var axis := Vector2i.DOWN if vertical else Vector2i.RIGHT
	halves.append(WallHalf.new(id, cell, -axis))
	halves.append(WallHalf.new(id, cell, axis))
	_events.append({"type": "wall_started", "wall_id": id, "cell": cell, "vertical": vertical})
	return true


## Advances the stage by dt seconds (normally STEP).
func step(dt := STEP) -> void:
	if state == State.GAME_OVER:
		return
	for ball in balls:
		ball.step(grid, dt)
	if state != State.PLAYING:
		return

	var completed: Array[WallHalf] = []
	for half in halves:
		var done := half.grow(grid, wall_speed * dt)
		if _ball_touches(half.rect()):
			half.state = WallHalf.State.BROKEN
			lives -= 1
			_events.append({"type": "half_broken", "wall_id": half.wall_id, "rect": half.rect()})
		elif done:
			completed.append(half)

	if lives <= 0:
		lives = 0
		halves.clear()
		state = State.GAME_OVER
		_events.append({"type": "game_over"})
		return

	for half in completed:
		if half.is_growing():  # an earlier capture this step may have finished it already
			_solidify(half)
	halves = halves.filter(func(h: WallHalf) -> bool: return h.is_growing())


func _ball_touches(rect: Rect2) -> bool:
	for ball in balls:
		if ball.overlaps_rect(rect):
			return true
	return false


func _solidify(half: WallHalf) -> void:
	var cells := half.cells(grid)
	half.state = WallHalf.State.SOLID
	grid.fill_cells(cells)
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
		_events.append({"type": "captured", "wall_id": wall_id, "cells": captured, "regions": region_count})

	# A growing half whose path was captured has nothing left to fill.
	for half in halves:
		if half.is_growing() and grid.is_filled(half.origin) and grid.is_filled(half.origin + half.direction):
			half.state = WallHalf.State.SOLID
	_update_pens()


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
		pen.locked = pen.area <= pen.limit
		pen.centroid = sums[pen.region] / pen.area
		var newly_locked := false
		for ball in pen.balls:
			if pen.locked and not ball.locked:
				newly_locked = true
			ball.locked = pen.locked
		if newly_locked:
			_events.append({"type": "pen_locked", "region": pen.region, "area": pen.area, "limit": pen.limit})

	if state == State.PLAYING and not balls.is_empty() and locked_count() == balls.size():
		state = State.CLEARED
		halves.clear()
		_events.append({"type": "cleared"})
