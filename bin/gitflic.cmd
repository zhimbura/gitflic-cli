@echo off
rem gitflic - Windows launcher (mirrors bin/gitflic on Unix/macOS).
rem Resolves the repo root relative to this script, then forwards every
rem argument to the Node ESM entrypoint. Works from a git checkout, the
rem portable tarball, or a copy/symlink placed on PATH.
node "%~dp0..\lib\gitflic.mjs" %*
