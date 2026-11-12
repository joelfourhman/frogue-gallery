@echo off
title Frogue Gallery
rem Run synchronously in this console; never detach or reuse a background server.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch.ps1" %*
if errorlevel 1 (
  echo.
  echo Could not launch Frogue Gallery. See the message above.
  pause
)
