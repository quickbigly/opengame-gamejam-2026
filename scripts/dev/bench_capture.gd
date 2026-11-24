extends SceneTree
## Times the slowest board step (a wall setting: capture, regions, pens) on a busy field.
func _initialize() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var worst := 0
	var total := 0
	var steps := 0
	for trial in 20:
		var board := Board.new(0.06)
		board.spawn_balls(10, rng)
		var cell := Vector2i(rng.randi_range(5, 42), rng.randi_range(5, 26))
		board.start_wall(cell, trial % 2 == 0)
		for i in 600:
			var t := Time.get_ticks_usec()
			board.step()
			var dt := Time.get_ticks_usec() - t
			worst = maxi(worst, dt)
			total += dt
			steps += 1
			if board.walls_building() == 0:
				break
	print("steps %d, mean %.1f us, worst %d us" % [steps, float(total) / steps, worst])
	var g := Grid.new()
	var t2 := Time.get_ticks_usec()
	for i in 20:
		g.find_regions()
	print("find_regions: %.0f us" % ((Time.get_ticks_usec() - t2) / 20.0))
	quit()
