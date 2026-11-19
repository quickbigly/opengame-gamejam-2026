extends SceneTree
## Headless test runner. Runs every test_* method in every tests/test_*.gd suite.
## Exits with code 1 if any test fails or raises an engine error.
##   dev -Test   (or: godot --headless --path . --script res://tests/run_tests.gd)

const TESTS_DIR := "res://tests"


## Collects engine and script errors so a test that crashes counts as failed.
class ErrorCollector extends Logger:
	var errors: Array[String] = []
	var _mutex := Mutex.new()

	func _log_error(function: String, file: String, line: int, code: String, rationale: String, _editor_notify: bool, _error_type: int, _script_backtraces: Array[ScriptBacktrace]) -> void:
		_mutex.lock()
		errors.append("%s (%s:%d in %s)" % [rationale if rationale != "" else code, file, line, function])
		_mutex.unlock()

	func _log_message(_message: String, _error: bool) -> void:
		pass

	func take() -> Array[String]:
		_mutex.lock()
		var result := errors.duplicate()
		errors.clear()
		_mutex.unlock()
		return result


func _suite_paths() -> Array[String]:
	var paths: Array[String] = []
	for file in DirAccess.get_files_at(TESTS_DIR):
		if file.begins_with("test_") and file.ends_with(".gd") and file != "test_suite.gd":
			paths.append(TESTS_DIR.path_join(file))
	paths.sort()
	return paths


func _initialize() -> void:
	var collector := ErrorCollector.new()
	OS.add_logger(collector)
	var passed := 0
	var failed := 0
	for path in _suite_paths():
		var suite: TestSuite = load(path).new()
		for method in suite.get_method_list():
			var test_name: String = method["name"]
			if not test_name.begins_with("test_"):
				continue
			suite.failures.clear()
			collector.take()
			suite.call(test_name)
			var problems: Array[String] = suite.failures.duplicate()
			problems.append_array(collector.take())
			if problems.is_empty():
				passed += 1
				print("  ok   %s :: %s" % [path.get_file(), test_name])
			else:
				failed += 1
				print("  FAIL %s :: %s" % [path.get_file(), test_name])
				for problem in problems:
					print("         " + problem)
	OS.remove_logger(collector)
	print("\n%d passed, %d failed" % [passed, failed])
	quit(1 if failed > 0 or passed == 0 else 0)
