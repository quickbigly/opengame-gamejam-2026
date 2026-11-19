extends TestSuite
## Project settings the web build depends on.


func test_uses_the_compatibility_renderer() -> void:
	check_equal(ProjectSettings.get_setting("rendering/renderer/rendering_method"), "gl_compatibility", "renderer (the web build needs WebGL 2)")


func test_main_scene_loads() -> void:
	var path: String = ProjectSettings.get_setting("application/run/main_scene")
	check(path != "", "a main scene is set")
	var scene := load(path) as PackedScene
	check(scene != null, "the main scene loads")
	if scene:
		scene.instantiate().free()
