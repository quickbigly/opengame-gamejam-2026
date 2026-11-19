class_name TestSuite
extends RefCounted
## Base class for test suites. Methods named test_* are run by tests/run_tests.gd.

var failures: Array[String] = []


func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)


func check_equal(actual: Variant, expected: Variant, message: String) -> void:
	if actual != expected:
		failures.append("%s: expected %s, got %s" % [message, str(expected), str(actual)])


func check_near(actual: Variant, expected: Variant, message: String, tolerance := 0.001) -> void:
	var close: bool
	if actual is Vector2:
		close = (actual as Vector2).distance_to(expected) <= tolerance
	else:
		close = absf(float(actual) - float(expected)) <= tolerance
	if not close:
		failures.append("%s: expected %s, got %s" % [message, str(expected), str(actual)])
