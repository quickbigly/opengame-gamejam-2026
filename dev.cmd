@echo off
rem Runs dev.ps1 without needing to change PowerShell's execution policy.
rem   dev            play the game
rem   dev -Setup     download Godot and the web export templates into .tools\
rem   dev -Test      run the test suite
rem   dev -Web       export the web build to build\web
rem   dev -Editor    open the project in the Godot editor
rem   dev -Godot ... run Godot's console binary with any arguments
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
exit /b %ERRORLEVEL%
