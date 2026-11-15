#!/usr/bin/env python3
"""Generate the standalone command from reviewed repository source; no network."""
from pathlib import Path
import hashlib,json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
def digest(data):return hashlib.sha256(data).hexdigest()
def main():
 version=(ROOT/'VERSION').read_text().strip()
 if not re.fullmatch(r'\d+\.\d+\.\d+',version):raise ValueError('Invalid VERSION')
 lock=json.loads((ROOT/'dependencies.lock.json').read_text())
 assert lock['format']==1 and set(lock['mods'])=={'jpmod_ap0_mod','jpmod_ap1_mod','jpmod_ap2_mod'}
 for pin in lock['mods'].values():
  for key in ['dist_sha256','download_sha256','archive_sha256','descriptor_sha256']:assert re.fullmatch('[a-f0-9]{64}',pin[key])
  assert pin['dist_url'].startswith('https://github.com/'+pin['repository']+'/releases/download/'+pin['release']+'/')
 bundle={}
 for p in sorted((ROOT/'native/eu4dll_mac').rglob('*')):
  if p.is_file() and (p.suffix in ['.h','.cpp'] or p.name=='LICENSE'):bundle[str(p.relative_to(ROOT/'native'))]=p.read_text()
 bundle['tools/insert_dylib.cpp']=(ROOT/'native/tools/insert_dylib.cpp').read_text()
 hashes={name:digest(text.encode()) for name,text in bundle.items()}
 native_id=digest(''.join(name+'\0'+hashes[name]+'\n' for name in sorted(bundle)).encode())
 upstream=json.loads((ROOT/'native/eu4dll_mac/UPSTREAM.json').read_text())
 cpp=['eu4dll_mac/library.cpp']+sorted(n for n in bundle if n.startswith('eu4dll_mac/src/') and n.endswith('.cpp'))
 support={'revision':3,'commit':upstream['commit'],'source_bundle':bundle,'source_hashes':hashes,'native_id':native_id,'cpp_files':cpp,'font_helper':(ROOT/'native/font-helper.mm').read_text(),'characters':(ROOT/'native/characters.txt').read_text()}
 assert len(set(support['characters']))==2337
 supplement=json.loads((ROOT/'installer/supplement.json').read_text());supplement['version']=version
 runtime=(ROOT/'installer/runtime.template.js').read_text()
 runtime=re.sub(r'2\.2\.0',version,runtime)
 for token,value in [('__NATIVE_RUNTIME__',(ROOT/'installer/native_runtime.js').read_text()),('__PINNED_MOD_RUNTIME__',(ROOT/'installer/pinned_mods.js').read_text()),('__JP_SUPPORT__',json.dumps(support,ensure_ascii=False,separators=(',',':'))),('__SUPPLEMENT_DATA__',json.dumps(supplement,ensure_ascii=False,separators=(',',':'))),('__DEPENDENCY_LOCK__',json.dumps(lock,separators=(',',':')))]:
  assert runtime.count(token)==1,token
  runtime=runtime.replace(token,value)
 assert '__NATIVE_RUNTIME__' not in runtime
 build=ROOT/'build';dist=ROOT/'dist';build.mkdir(exist_ok=True);dist.mkdir(exist_ok=True)
 (build/'installer.js').write_text(runtime)
 header=f'''#!/bin/bash
# EU4 Japanese for Mac {version}
# https://github.com/shonen0129/EU4-Japanese-Mac
# Native tools are compiled from included source. No downloaded native binaries run.
'''
 notices=(ROOT/'LICENSE').read_text()+'\n'+(ROOT/'native/eu4dll_mac/LICENSE').read_text()+'\n'+(ROOT/'UNICODE-LICENSE.txt').read_text()
 header+=''.join('# '+line+'\n' for line in notices.splitlines())
 header+='''set -u
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
unset ENV BASH_ENV CDPATH
umask 077
if [[ "$(/usr/bin/uname -s)" != Darwin ]]; then
    echo 'このインストーラはmacOS専用です。' >&2
    exit 1
fi
EU4JP_TMP="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/eu4-japanese-mac.XXXXXXXX")" || exit 1
trap '/bin/rm -rf "$EU4JP_TMP"' EXIT
cat > "$EU4JP_TMP/installer.js" <<'EU4JP_JXA_RUNTIME'
'''
 footer='''EU4JP_JXA_RUNTIME
/usr/bin/osascript -l JavaScript "$EU4JP_TMP/installer.js" "$@"
EU4JP_RESULT=$?
if [[ "$#" -eq 0 && -t 0 ]]; then
    printf '\\nEnterキーで終了します。'
    IFS= read -r EU4JP_UNUSED || true
fi
exit "$EU4JP_RESULT"
'''
 command=dist/'EU4 Japanese for Mac.command';command.write_text(header+runtime+footer);command.chmod(0o755)
 files={'EU4 Japanese for Mac.command':command,'README.md':ROOT/'README.md','LICENSE':ROOT/'LICENSE','THIRD_PARTY_NOTICES.md':ROOT/'THIRD_PARTY_NOTICES.md','UNICODE-LICENSE.txt':ROOT/'UNICODE-LICENSE.txt','dependencies.lock.json':ROOT/'dependencies.lock.json','SECURITY.md':ROOT/'SECURITY.md'}
 for p in sorted((ROOT/'docs').glob('*')):
  if p.is_file() and p.name!='README.md':files['docs/'+p.name]=p
 archive=dist/'EU4-Japanese-Mac.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,p in sorted(files.items()):
   info=zipfile.ZipInfo('EU4-Japanese-Mac/'+name,date_time=(2026,11,15,0,0,0));info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o100755 if name.endswith('.command') else 0o100644)<<16;z.writestr(info,p.read_bytes())
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None and z.read('EU4-Japanese-Mac/EU4 Japanese for Mac.command')==command.read_bytes()
 (dist/'SHA256SUMS.txt').write_text(''.join(digest(p.read_bytes())+'  '+p.name+'\n' for p in [archive,command]))
 (build/'native-bundle.json').write_text(json.dumps({'sha256':native_id,'files':hashes},indent=2)+'\n')
 (build/'support-codepoints.txt').write_text(''.join(f'{ord(c):X}\n' for c in support['characters']))
 print(f'Built {version}; native source bundle {native_id}; ZIP {digest(archive.read_bytes())}')
if __name__=='__main__':main()
