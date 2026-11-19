class_name Grid
extends RefCounted
## The field as a grid of open and filled cells. Pure logic: no nodes, so it tests headless.
##
## Cells are addressed by Vector2i(x, y), with (0, 0) at the top left. The outermost ring of
## cells is the border and starts filled. Regions are 4-connected groups of open cells, so two
## filled cells that touch only at a corner still separate the open cells beside them.

const OPEN := 0
const FILLED := 1

const DEFAULT_WIDTH := 48
const DEFAULT_HEIGHT := 32

const _NEIGHBOURS: Array[Vector2i] = [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]

var width: int
var height: int
## Open cells when the grid was made: the area that pen limits are a percent of.
var playable_area: int

var _cells := PackedByteArray()
var _open_count: int


func _init(grid_width := DEFAULT_WIDTH, grid_height := DEFAULT_HEIGHT) -> void:
	assert(grid_width >= 3 and grid_height >= 3, "a grid needs room for a border and one open cell")
	width = grid_width
	height = grid_height
	_cells.resize(width * height)
	for y in height:
		for x in width:
			var border := x == 0 or y == 0 or x == width - 1 or y == height - 1
			_cells[y * width + x] = FILLED if border else OPEN
	_open_count = (width - 2) * (height - 2)
	playable_area = _open_count


func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < width and cell.y < height


## Out-of-bounds cells count as filled, so callers can probe past the border safely.
func is_filled(cell: Vector2i) -> bool:
	return not in_bounds(cell) or _cells[index_of(cell)] == FILLED


func is_open(cell: Vector2i) -> bool:
	return not is_filled(cell)


## Fills one cell. Returns true if it was open.
func fill(cell: Vector2i) -> bool:
	if is_filled(cell):
		return false
	_cells[index_of(cell)] = FILLED
	_open_count -= 1
	return true


## Fills every open cell in the list. Returns how many were open.
func fill_cells(cells: PackedVector2Array) -> int:
	var filled := 0
	for cell in cells:
		if fill(Vector2i(cell)):
			filled += 1
	return filled


func open_count() -> int:
	return _open_count


func filled_fraction() -> float:
	return 1.0 - float(_open_count) / float(playable_area)


func index_of(cell: Vector2i) -> int:
	return cell.y * width + cell.x


func cell_of(index: int) -> Vector2i:
	return Vector2i(index % width, index / width)


## Labels every open cell with the id of its region (4-connected flood fill).
func find_regions() -> Regions:
	var regions := Regions.new(self)
	var stack := PackedInt32Array()
	for start in _cells.size():
		if _cells[start] == FILLED or regions.labels[start] != Regions.NONE:
			continue
		var id := regions.areas.size()
		var area := 0
		regions.labels[start] = id
		stack.append(start)
		while not stack.is_empty():
			var index := stack[stack.size() - 1]
			stack.resize(stack.size() - 1)
			area += 1
			var cell := cell_of(index)
			for step in _NEIGHBOURS:
				var next := cell + step
				if is_filled(next):
					continue
				var next_index := index_of(next)
				if regions.labels[next_index] == Regions.NONE:
					regions.labels[next_index] = id
					stack.append(next_index)
		regions.areas.append(area)
	return regions


## A snapshot of the grid's regions. It goes stale as soon as the grid changes.
class Regions extends RefCounted:
	const NONE := -1

	## Region id per cell, by Grid.index_of(); NONE for filled cells.
	var labels := PackedInt32Array()
	## Open cells per region, by region id.
	var areas := PackedInt32Array()

	var _grid: Grid

	func _init(grid: Grid) -> void:
		_grid = grid
		labels.resize(grid.width * grid.height)
		labels.fill(NONE)

	func count() -> int:
		return areas.size()

	## The region holding this cell, or NONE if it's filled or out of bounds.
	func region_at(cell: Vector2i) -> int:
		if not _grid.in_bounds(cell):
			return NONE
		return labels[_grid.index_of(cell)]

	func area(id: int) -> int:
		return areas[id]

	func cells(id: int) -> PackedVector2Array:
		var result := PackedVector2Array()
		for index in labels.size():
			if labels[index] == id:
				result.append(Vector2(_grid.cell_of(index)))
		return result
