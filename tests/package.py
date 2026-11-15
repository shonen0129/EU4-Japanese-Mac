from pathlib import Path
import hashlib,zipfile,re
ROOT=Path(__file__).resolve().parents[1];dist=ROOT/'dist';names=[]
for line in (dist/'SHA256SUMS.txt').read_text().splitlines():
 h,name=line.split('  ',1);assert re.fullmatch('[A-Za-z0-9._-]+',name)
 assert (dist/name).is_file() and hashlib.sha256((dist/name).read_bytes()).hexdigest()==h;names.append(name)
assert set(names)=={'EU4-Japanese-Mac.zip','EU4-Japanese-Mac.command'}
with zipfile.ZipFile(dist/'EU4-Japanese-Mac.zip') as z:
 name='EU4-Japanese-Mac/EU4 Japanese for Mac.command'
 assert z.read(name)==(dist/'EU4-Japanese-Mac.command').read_bytes()
 assert ((z.getinfo(name).external_attr>>16)&0o777)==0o755
 assert z.testzip() is None
print('PASS: release filenames match SHA256SUMS; standalone command equals executable ZIP payload.')
