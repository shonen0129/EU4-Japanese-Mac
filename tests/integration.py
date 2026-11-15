"""Native macOS installation tests in a synthetic app and isolated user home."""
from pathlib import Path
import subprocess,tempfile,json,hashlib,plistlib,os
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
core=(ROOT/'build/installer.js').read_text().replace('function run(args)','function installerRun(args)')
lock=json.loads((ROOT/'dependencies.lock.json').read_text());results=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(p):
 h=hashlib.sha256()
 for f in sorted(p.rglob('*')):
  if f.is_file():h.update(str(f.relative_to(p)).encode());h.update(f.read_bytes())
 return h.hexdigest()
with tempfile.TemporaryDirectory(prefix='eu4jp-integration-') as tmp:
 base=Path(tmp).resolve();home=base/'home';app=home/'外付け " Library'/'steamapps/common/Europa Universalis IV/eu4.app';(app/'Contents/MacOS').mkdir(parents=True);(app/'Contents/Resources').mkdir()
 c=base/'fake.c';c.write_text('#include <stdio.h>\nconst unsigned char pattern[] __attribute__((used))={0x43,0x8d,0x44,0x2d,0,0x8d,4,0x40,0x4c,0x63,0xf8,0x49,0xc1,0xe7,2};\nint main(void){puts("EU4 v1.37.5.0");return 0;}\n')
 subprocess.run(['xcrun','clang','-arch','x86_64','-Wl,-headerpad,0x1000',str(c),'-o',str(app/'Contents/MacOS/eu4')],check=True)
 (app/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleName':'eu4','CFBundleExecutable':'eu4','CFBundleIdentifier':'org.example.eu4-jp.fixture','CFBundlePackageType':'APPL','CFBundleVersion':'1'}))
 subprocess.run(['/usr/bin/codesign','--force','--deep','--sign','-',str(app)],check=True,capture_output=True)
 root=home/'Library/Application Support/EU4-Japanese-Mac';mods=home/'Documents/Paradox Interactive/Europa Universalis IV/mod';history=app/'Contents/MacOS/console_history.txt';flag=app/'Contents/Resources/eu4jp-disable-map-names'
 payloads=os.environ.get('EU4JP_TEST_PAYLOADS','')
 extra=r'''
var fixtureHome=__HOME__,fault=__FAULT__,payloads=__PAYLOADS__,faultUsed=false;
userHome=function(){return fixtureHome;};
var systemTask=task;
task=function(exe,args,allow,working){
 if(exe==='/usr/bin/pgrep')return {status:1,text:''};
 if(fault==='placement'&&!faultUsed&&exe==='/bin/mv'&&String(args[args.length-1]).indexOf('eu4jp_mac_supplement.zip')>=0){faultUsed=true;throw new Error('Injected post-switch placement failure');}
 return systemTask(exe,args,allow,working);
};
if(payloads){
 download=function(url,dest,maxBytes){
  var matched=false;
  MODS.forEach(function(m){
   if(matched)return;
   var pin=DEPENDENCY_LOCK.mods[m.id],repo=m.repo.split('/')[1];
   if(url===pin.dist_url){copy(payloads+'/'+repo+'.dist.v2.json',dest);matched=true;}
   else {var d=json(payloads+'/'+repo+'.dist.v2.json');if(url===d.url){copy(payloads+'/'+repo+'.zip',dest);matched=true;}}
  });
  if(!matched)fail('Unexpected fixture download URL');
  if(size(dest)>maxBytes)fail('Fixture exceeds declared size');
 };
}
function run(){return installerRun(__ARGS__);}
'''
 def run(action,fault='',ok=True):
  script=extra.replace('__HOME__',json.dumps(str(home))).replace('__FAULT__',json.dumps(fault)).replace('__PAYLOADS__',json.dumps(payloads)).replace('__ARGS__',json.dumps(['--'+action,'--app',str(app)]))
  runner=base/'runner.jxa';runner.write_text(core+script)
  r=subprocess.run(['/usr/bin/osascript','-l','JavaScript',str(runner)],capture_output=True,text=True)
  log=r.stdout+r.stderr;(ROOT/'build'/('integration-'+action+('-'+fault if fault else '')+'.log')).write_text(log)
  assert (r.returncode==0)==ok,log[-5000:]
  assert not (root/'pending.json').exists()
  return log
 def record(s):results.append('PASS: '+s);print(results[-1],flush=True)
 def snap():return tree(app),tree(mods),(root/'state.json').read_bytes()
 def archived(h):return root/'preserved-runtime-files/console-history'/(h+'.txt')
 history.write_text('synthetic console history\n');h=sha(history)
 log=run('install');assert not history.exists() and sha(archived(h))==h
 dll=app/'Contents/Frameworks/libeu4dll_mac.dylib';assert b'EU4JP_MAP_SAFE_V1' in dll.read_bytes()
 for mid,pin in lock['mods'].items():
  if mid=='jpmod_ap2_mod':assert not (mods/(mid+'.zip')).exists();continue
  assert sha(mods/(mid+'.zip'))==pin['archive_sha256'] and sha(mods/(mid+'.mod'))==pin['descriptor_sha256']
 state=json.loads((root/'state.json').read_text());receipt=next(iter(state['apps'].values()));assert receipt['japanese']['source_repository']=='shonen0129/EU4-Japanese-Mac'
 assert 'codeload.github.com' not in log and 'eu4dll_mac_build_5.zip' not in log
 record('own embedded native source compiled; pinned Main 1/Main 2 installed; history preserved; injection and codesign verified')
 log=run('diagnose');assert '国名描画の安全化: installed (v1)' in log and 'codesign verify result: 0' in log;record('diagnostics verify native marker and signature')
 history.write_text('new history before failed update\n');h2=sha(history);before=snap();run('install','placement',False);assert snap()==before and sha(history)==h2 and sha(archived(h2))==h2;record('failure after app swap restores app, MODs, state and original history')
 run('install-no-map-names');assert flag.is_file() and not history.exists();record('update reuses approved MODs and enables no-map-name diagnostic mode')
 log=run('diagnose');assert '停止（診断モード）' in log and 'codesign verify result: 0' in log;record('diagnostic mode remains correctly signed')
 history.write_text('history before uninstall\n');h3=sha(history);run('uninstall-patch');assert not dll.exists() and not flag.exists() and not history.exists() and sha(archived(h3))==h3;record('patch uninstall restores executable, preserves history and removes diagnostic flag')
 run('uninstall-all');assert not list(mods.glob('jpmod_ap*_mod.*')) and not (mods/'eu4jp_mac_supplement.zip').exists();record('full uninstall removes managed MODs and passes signature verification')
 (ROOT/'build/integration-results.txt').write_text('\n'.join(results)+'\n')
