#!/usr/bin/env python3
from pathlib import Path
import subprocess,platform,os
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
def run(args):subprocess.run(args,check=True)
run(['python3','tools/build.py'])
run(['node','tests/unit.cjs']);run(['node','tests/security.cjs'])
run(['python3','tests/release.py'])
run(['/bin/bash','-n','dist/EU4 Japanese for Mac.command'])
run(['/bin/bash','dist/EU4 Japanese for Mac.command','--help'])
if platform.system()!='Darwin':raise SystemExit('Native checks require macOS')
include='native/eu4dll_mac/src'
arches=['x86_64'] if platform.machine()=='x86_64' else ['arm64','x86_64']
for arch in arches:
 out='build/map-guard-'+arch
 run(['xcrun','clang++','-arch',arch,'-std=c++17','-O1','-g','-fsanitize=address,undefined','-I'+include,'tests/map_guard.cpp','-o',out])
 run(['/usr/bin/arch','-'+arch,'./'+out])
run(['xcrun','clang++','-arch','x86_64','-std=c++17','-O3','-I'+include,'tests/map_capacity.cpp','-o','build/map-capacity'])
run(['/usr/bin/arch','-x86_64','./build/map-capacity'])
run(['python3','tests/injector.py'])
