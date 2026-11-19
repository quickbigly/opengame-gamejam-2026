extends TestSuite
## Grid model: cells, border, flood fill and region areas.


func _wall_column(grid: Grid, x: int) -> void:
	for y in range(1, grid.height - 1):
		grid.fill(Vector2i(x, y))


func test_new_grid_has_a_filled_border_and_open_inside() -> void:
	var grid := Grid.new()
	check_equal(grid.width, 48, "default width")
	check_equal(grid.height, 32, "default height")
	check(grid.is_filled(Vector2i(0, 0)), "corner is filled")
	check(grid.is_filled(Vector2i(47, 15)), "right border is filled")
	check(grid.is_filled(Vector2i(20, 31)), "bottom border is filled")
	check(grid.is_open(Vector2i(1, 1)), "first inside cell is open")
	check(grid.is_open(Vector2i(46, 30)), "last inside cell is open")
	check_equal(grid.open_count(), 46 * 30, "open cells")
	check_equal(grid.playable_area, 46 * 30, "playable area")
	check_near(grid.filled_fraction(), 0.0, "filled fraction")


func test_out_of_bounds_counts_as_filled() -> void:
	var grid := Grid.new(5, 5)
	check(grid.is_filled(Vector2i(-1, 2)), "left of the grid")
	check(grid.is_filled(Vector2i(2, 5)), "below the grid")
	check(not grid.fill(Vector2i(9, 9)), "filling out of bounds does nothing")
	check_equal(grid.open_count(), 9, "open cells unchanged")


func test_fill_counts_only_open_cells() -> void:
	var grid := Grid.new(6, 6)
	check(grid.fill(Vector2i(2, 2)), "open cell fills")
	check(not grid.fill(Vector2i(2, 2)), "a filled cell doesn't fill again")
	check(not grid.fill(Vector2i(0, 0)), "the border doesn't fill again")
	check_equal(grid.open_count(), 15, "open cells")
	var filled := grid.fill_cells(PackedVector2Array([Vector2(1, 1), Vector2(2, 2), Vector2(3, 3)]))
	check_equal(filled, 2, "fill_cells skips the filled cell")
	check_equal(grid.open_count(), 13, "open cells after fill_cells")
	check_near(grid.filled_fraction(), 3.0 / 16.0, "filled fraction")


func test_cell_index_round_trips() -> void:
	var grid := Grid.new()
	for cell in [Vector2i(0, 0), Vector2i(47, 0), Vector2i(0, 31), Vector2i(13, 22)]:
		check_equal(grid.cell_of(grid.index_of(cell)), cell, "round trip of %s" % str(cell))


func test_empty_field_is_one_region() -> void:
	var grid := Grid.new()
	var regions := grid.find_regions()
	check_equal(regions.count(), 1, "regions")
	check_equal(regions.area(0), 46 * 30, "area")
	check_equal(regions.region_at(Vector2i(10, 10)), 0, "inside cell's region")
	check_equal(regions.region_at(Vector2i(0, 0)), Grid.Regions.NONE, "border has no region")
	check_equal(regions.region_at(Vector2i(-3, 4)), Grid.Regions.NONE, "out of bounds has no region")


func test_a_full_wall_splits_the_field() -> void:
	var grid := Grid.new()
	_wall_column(grid, 10)
	var regions := grid.find_regions()
	check_equal(regions.count(), 2, "regions")
	var left := regions.region_at(Vector2i(5, 5))
	var right := regions.region_at(Vector2i(20, 5))
	check(left != right, "the two sides are different regions")
	check_equal(regions.area(left), 9 * 30, "left area")
	check_equal(regions.area(right), 36 * 30, "right area")
	check_equal(regions.region_at(Vector2i(10, 5)), Grid.Regions.NONE, "the wall has no region")


func test_a_wall_with_a_gap_does_not_split() -> void:
	var grid := Grid.new()
	for y in range(1, grid.height - 2):  # stops one cell short of the bottom border
		grid.fill(Vector2i(10, y))
	var regions := grid.find_regions()
	check_equal(regions.count(), 1, "regions")
	check_equal(regions.area(0), 46 * 30 - 29, "area")


func test_a_corner_touch_separates_regions() -> void:
	# 4x4 open inside; filling two diagonal cells pinches the corners apart.
	#   . # . .        (1,1) and (3,1) are open; (2,1) filled.
	#   # . . .        (1,2) filled. So (1,1) is boxed in on its own.
	var grid := Grid.new(6, 6)
	grid.fill(Vector2i(2, 1))
	grid.fill(Vector2i(1, 2))
	var regions := grid.find_regions()
	check_equal(regions.count(), 2, "regions")
	check_equal(regions.area(regions.region_at(Vector2i(1, 1))), 1, "the pinched corner is its own region")
	check_equal(regions.area(regions.region_at(Vector2i(3, 3))), 13, "the rest")


func test_region_areas_sum_to_open_cells() -> void:
	var grid := Grid.new()
	_wall_column(grid, 12)
	_wall_column(grid, 30)
	for x in range(13, 30):
		grid.fill(Vector2i(x, 16))
	var regions := grid.find_regions()
	check_equal(regions.count(), 4, "regions")
	var total := 0
	for id in regions.count():
		total += regions.area(id)
	check_equal(total, grid.open_count(), "areas sum to the open cells")


func test_region_cells_lists_every_cell_once() -> void:
	var grid := Grid.new(8, 6)
	_wall_column(grid, 3)
	var regions := grid.find_regions()
	var left := regions.region_at(Vector2i(1, 1))
	var cells := regions.cells(left)
	check_equal(cells.size(), regions.area(left), "cell list matches area")
	for cell in cells:
		check(cell.x >= 1 and cell.x <= 2, "cell %s is left of the wall" % str(cell))


func test_filling_a_region_removes_it() -> void:
	var grid := Grid.new()
	_wall_column(grid, 10)
	var regions := grid.find_regions()
	var left := regions.region_at(Vector2i(5, 5))
	check_equal(grid.fill_cells(regions.cells(left)), 9 * 30, "cells captured")
	var after := grid.find_regions()
	check_equal(after.count(), 1, "one region left")
	check_equal(after.area(0), grid.open_count(), "it holds every open cell")
