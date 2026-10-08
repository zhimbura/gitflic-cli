@echo off
rem gitflic - Windows launcher (mirrors bin/gitflic on Unix/macOS).
rem Resolves the repo root relative to this script, then forwards every
rem argument to the Node ESM entrypoint. Works from a git checkout or the
rem portable tarball: put this bin directory on PATH. Do not copy or symlink
rem this file elsewhere - %~dp0 would then point at the wrong directory.
node "%~dp0..\lib\gitflic.mjs" %*
