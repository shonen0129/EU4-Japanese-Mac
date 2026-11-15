from pathlib import Path
import hashlib,struct,subprocess,tempfile,shutil
ROOT=Path(__file__).resolve().parents[1];BUILD=ROOT/'build';BUILD.mkdir(exist_ok=True)
tool=BUILD/'insert_dylib'
subprocess.run(['xcrun','clang++','-std=c++17','-O2','-Wall','-Wextra',str(ROOT/'native/tools/insert_dylib.cpp'),'-o',str(tool)],check=True)
load='@executable_path/../Frameworks/libeu4dll_mac.dylib';count=0
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(p,ok=True,lib=load):
 r=subprocess.run([str(tool),'--inplace','--all-yes',lib,str(p)],capture_output=True,text=True)
 assert (r.returncode==0)==ok,r.stdout+r.stderr
 return r
def reject(p,lib=load):
 before=sha(p);run(p,False,lib);assert sha(p)==before
 global count;count+=1
def minimal(p,padding=0):
 header=struct.pack('<IiiIIIII',0xfeedfacf,0x1000007,3,2,1,152,0,0)
 offset=32+152+padding
 seg=struct.pack('<II16sQQQQiiII',0x19,152,b'__TEXT',0x100000000,4096,0,offset+1,7,5,1,0)
 section=struct.pack('<16s16sQQIIIIIIII',b'__text',b'__TEXT',0x100000000+offset,1,offset,0,0,0,0,0,0,0)
 p.write_bytes(header+seg+section+bytes(padding)+b'\xc3')
with tempfile.TemporaryDirectory(prefix='eu4jp-injector-') as t:
 d=Path(t);src=d/'fake.c';src.write_text('int main(void){return 0;}\n')
 intel=d/'引用 " 空白 eu4';arm=d/'arm64';fat=d/'universal'
 for arch,p in [('x86_64',intel),('arm64',arm)]:subprocess.run(['xcrun','clang','-arch',arch,'-Wl,-headerpad,0x1000',str(src),'-o',str(p)],check=True)
 run(intel);assert subprocess.check_output(['/usr/bin/otool','-L',str(intel)],text=True).count(load)==1;count+=1
 before=sha(intel);run(intel);assert sha(intel)==before;count+=1
 subprocess.run(['/usr/bin/codesign','--force','--sign','-',str(intel)],check=True,capture_output=True)
 subprocess.run(['/usr/bin/codesign','--verify','--strict',str(intel)],check=True,capture_output=True);count+=1
 reject(arm)
 subprocess.run(['/usr/bin/lipo','-create',str(intel),str(arm),'-output',str(fat)],check=True);reject(fat)
 p=d/'truncated';p.write_bytes(bytes(31));reject(p)
 p=d/'no-padding';minimal(p);reject(p)
 p=d/'nonzero-padding';minimal(p,256);b=bytearray(p.read_bytes());b[184]=0xaa;p.write_bytes(b);reject(p)
 p=d/'bad-command';minimal(p,256);b=bytearray(p.read_bytes());struct.pack_into('<I',b,36,0);p.write_bytes(b);reject(p)
 p=d/'too-many-commands';minimal(p,256);b=bytearray(p.read_bytes());struct.pack_into('<I',b,16,4097);p.write_bytes(b);reject(p)
 p=d/'wrong-path';shutil.copy2(intel,p);reject(p,'/tmp/not-approved.dylib')
 link=d/'link';link.symlink_to(intel);before=sha(intel);run(link,False);assert sha(intel)==before and link.is_symlink();count+=1
 p=d/'minimal';minimal(p,256);run(p);assert subprocess.check_output(['/usr/bin/otool','-L',str(p)],text=True).count(load)==1;count+=1
 print(f'PASS: {count} injector checks; thin x86_64, signing, duplicate prevention, malformed/padding/architecture/path/symlink rejection.')
