extends SceneTree
## Draws the project icon and the loading splash (the game's name in cells, like the title
## screen's wordmark) to res://art/. Rerun after changing the palette or the letters.
##   dev -Godot --headless --path . --script res://scripts/dev/make_art.gd

const LETTERS := {
	"B": ["####.", "#...#", "####.", "#...#", "####."],
	"O": [".###.", "#...#", "#...#", "#...#", ".###."],
	"X": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
	"E": ["#####", "#....", "####.", "#....", "#####"],
	"D": ["####.", "#...#", "#...#", "#...#", "####."],
	"I": ["###", ".#.", ".#.", ".#.", "###"],
	"N": ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
	" ": ["..", "..", "..", "..", ".."],
}


func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://art"))
	_icon().save_png("res://art/icon.png")
	_splash().save_png("res://art/splash.png")
	print("wrote art/icon.png and art/splash.png")
	quit()


## A dark tile with a walled pen holding one ball, split by a cyan and an orange wall half.
func _icon() -> Image:
	var size := 128
	var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
	image.fill(Palette.c("background"))
	var rim := Palette.c("filled_rim")
	image.fill_rect(Rect2i(12, 12, 104, 104), rim)
	image.fill_rect(Rect2i(20, 20, 88, 88), Palette.c("open"))
	image.fill_rect(Rect2i(20, 60, 44, 8), Palette.c("half_a"))
	image.fill_rect(Rect2i(64, 60, 44, 8), Palette.c("half_b"))
	image.fill_rect(Rect2i(20, 68, 88, 40), Palette.c("pen_locked"))
	image.fill_rect(Rect2i(20, 104, 88, 4), Palette.c("good"))
	_disc(image, Vector2(64, 88), 11.0, Palette.c("ball_locked"))
	_disc(image, Vector2(44, 38), 9.0, Palette.c("ball"))
	return image


func _splash() -> Image:
	var cell := 16
	var text := "BOXED IN"
	var columns := 0
	for ch in text:
		columns += LETTERS[ch][0].length() + 1
	columns -= 1
	var pad := 24
	var image := Image.create(columns * cell + pad * 2, 5 * cell + pad * 2, false, Image.FORMAT_RGBA8)
	image.fill(Palette.c("background"))
	var column := 0
	for ch in text:
		var rows: Array = LETTERS[ch]
		for r in rows.size():
			for c in rows[r].length():
				if rows[r][c] == "#":
					var x: int = column + c
					var color := Palette.c("half_a").lerp(Palette.c("half_b"), float(x) / columns)
					image.fill_rect(Rect2i(pad + x * cell + 1, pad + r * cell + 1, cell - 2, cell - 2), color)
		column += rows[0].length() + 1
	return image


func _disc(image: Image, centre: Vector2, radius: float, color: Color) -> void:
	for y in range(int(centre.y - radius - 1), int(centre.y + radius + 2)):
		for x in range(int(centre.x - radius - 1), int(centre.x + radius + 2)):
			var d := Vector2(x + 0.5, y + 0.5).distance_to(centre)
			var a := clampf(radius - d + 0.5, 0.0, 1.0)
			if a > 0.0:
				image.set_pixel(x, y, image.get_pixel(x, y).lerp(color, a))
