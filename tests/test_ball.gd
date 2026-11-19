extends TestSuite
## Ball movement and bouncing, and wall half geometry.


func _wall_column(grid: Grid, x: int) -> void:
	for y in range(1, grid.height - 1):
		grid.fill(Vector2i(x, y))


func test_diagonal_velocity_has_the_given_speed() -> void:
	var v := Ball.diagonal(10.0, -1, 1)
	check_near(v.length(), 10.0, "speed")
	check(v.x < 0 and v.y > 0, "direction signs")


func test_circle_rect_overlap() -> void:
	var rect := Rect2(2, 2, 1, 1)
	check(Ball.circle_overlaps_rect(Vector2(2.5, 2.5), 0.3, rect), "centre inside")
	check(Ball.circle_overlaps_rect(Vector2(1.8, 2.5), 0.3, rect), "edge overlap")
	check(not Ball.circle_overlaps_rect(Vector2(1.65, 2.5), 0.3, rect), "just clear of an edge")
	check(not Ball.circle_overlaps_rect(Vector2(1.75, 1.75), 0.3, rect), "near a corner but clear")


func test_moves_in_open_space() -> void:
	var grid := Grid.new()
	var ball := Ball.new(Vector2(20.5, 15.5), Vector2(10, 0))
	ball.step(grid, 0.5)
	check_near(ball.position, Vector2(25.5, 15.5), "position after half a second")


func test_bounces_off_the_border() -> void:
	var grid := Grid.new()
	var ball := Ball.new(Vector2(1.5, 15.5), Ball.diagonal(10.0, -1, -1))
	for i in 24:
		ball.step(grid, Board.STEP)
	check(ball.velocity.x > 0, "x velocity flipped")
	check(ball.velocity.y < 0, "y velocity unchanged")
	check(ball.position.x - ball.radius >= 1.0, "ball stays out of the border")


func test_fast_ball_does_not_tunnel_through_a_one_cell_wall() -> void:
	var grid := Grid.new()
	_wall_column(grid, 10)
	var ball := Ball.new(Vector2(8.5, 15.5), Ball.diagonal(400.0, 1, 1))
	for i in 240:
		ball.step(grid, Board.STEP)
		check(ball.position.x < 10.0, "step %d: ball left of the wall" % i)
		if ball.position.x >= 10.0:
			return


func test_balls_never_overlap_filled_cells() -> void:
	var grid := Grid.new()
	_wall_column(grid, 17)
	for x in range(1, 17):
		grid.fill(Vector2i(x, 12))
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var balls: Array[Ball] = []
	for i in 6:
		balls.append(Ball.new(Vector2(rng.randi_range(20, 45) + 0.5, rng.randi_range(2, 29) + 0.5),
				Ball.diagonal(rng.randf_range(5.0, 30.0), 1 if i % 2 else -1, -1 if i % 3 else 1)))
	for step in 2400:
		for ball in balls:
			ball.step(grid, Board.STEP)
			if ball.overlaps_filled(grid, ball.position):
				check(false, "step %d: ball at %s overlaps a filled cell" % [step, str(ball.position)])
				return


func test_half_rect_grows_from_the_origin_centre() -> void:
	var right := WallHalf.new(0, Vector2i(10, 5), Vector2i.RIGHT)
	check_equal(right.rect(), Rect2(10, 5, 1, 1), "right half at length 0 covers its origin cell")
	right.length = 2.0
	check_equal(right.rect(), Rect2(10, 5, 2.5, 1), "right half at length 2")
	var left := WallHalf.new(0, Vector2i(10, 5), Vector2i.LEFT)
	left.length = 2.0
	check_equal(left.rect(), Rect2(8.5, 5, 2.5, 1), "left half at length 2")
	var down := WallHalf.new(0, Vector2i(10, 5), Vector2i.DOWN)
	down.length = 2.0
	check_equal(down.rect(), Rect2(10, 5, 1, 2.5), "down half at length 2")


func test_half_reach_and_cells() -> void:
	var grid := Grid.new()
	grid.fill(Vector2i(14, 5))
	var right := WallHalf.new(0, Vector2i(10, 5), Vector2i.RIGHT)
	check_equal(right.reach(grid), 4, "reach to the filled cell")
	check_near(right.target_length(grid), 3.5, "target length")
	check_equal(right.cells(grid), PackedVector2Array([Vector2(10, 5), Vector2(11, 5), Vector2(12, 5), Vector2(13, 5)]), "cells")
	var up := WallHalf.new(0, Vector2i(10, 1), Vector2i.UP)
	check_equal(up.reach(grid), 1, "a half next to the border reaches only its origin")


func test_half_grows_until_it_meets_a_filled_cell() -> void:
	var grid := Grid.new()
	var left := WallHalf.new(0, Vector2i(4, 5), Vector2i.LEFT)
	check(not left.grow(grid, 2.0), "not there yet")
	check(left.grow(grid, 2.0), "reaches the border")
	check_near(left.length, 3.5, "stops at the border")
	check_equal(left.rect(), Rect2(1, 5, 4, 1), "covers cells 1 to 4")
