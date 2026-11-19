extends Node2D
## Placeholder main scene, so the build pipeline has something to export. Replaced in M1.


func _draw() -> void:
	var size := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, size), Color("10131c"))
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(0, size.y * 0.5), "Boxed In", HORIZONTAL_ALIGNMENT_CENTER, size.x, 64, Color("e8ecf4"))
	draw_string(font, Vector2(0, size.y * 0.5 + 48), "build pipeline placeholder", HORIZONTAL_ALIGNMENT_CENTER, size.x, 20, Color("7a8399"))
