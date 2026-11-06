@echo off
rem Keep both entry points on the same launcher and runtime checks.
call "%~dp0Run JHCIS Queue.cmd"
exit /b %errorlevel%
