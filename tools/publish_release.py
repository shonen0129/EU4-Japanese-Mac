#!/usr/bin/env python3
"""Publish a tested source-only installer from CI; never replace a published asset."""
from pathlib import Path
import os,json,re,hashlib,urllib.request,urllib.error,urllib.parse,subprocess
ROOT=Path(__file__).resolve().parents[1];REPO='shonen0129/EU4-Japanese-Mac'
def api(method,path,data=None,content_type='application/json'):
 url=path if path.startswith('https://') else 'https://api.github.com/repos/'+REPO+path
 if urllib.parse.urlsplit(url).hostname not in {'api.github.com','uploads.github.com'}:raise ValueError('Unexpected GitHub API host')
 payload=None if data is None else (json.dumps(data).encode() if isinstance(data,dict) else data)
 req=urllib.request.Request(url,data=payload,method=method,headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':content_type,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'EU4-Japanese-Mac-release'})
 with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
def main():
 if os.environ.get('GITHUB_REPOSITORY')!=REPO or os.environ.get('GITHUB_REF')!='refs/heads/main':raise SystemExit('Release only permitted from managed main')
 commit=os.environ['GITHUB_SHA'];assert re.fullmatch('[0-9a-f]{40}',commit)
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==commit
 version=(ROOT/'VERSION').read_text().strip();assert re.fullmatch(r'\d+\.\d+\.\d+',version);tag='v'+version
 try:old=api('GET','/releases/tags/'+tag)
 except urllib.error.HTTPError as e:
  if e.code!=404:raise
  old=None
 if old and not old['draft']:
  print('Published release exists; nothing replaced: '+old['html_url']);return
 if old:
  if old['target_commitish']!=commit:raise SystemExit('Existing draft belongs to another commit; refusing overwrite')
  release=old
 else:
  notes='管理リポジトリのソースから生成したインストーラです。ネイティブ部分は利用者のMacでビルドし、日本語MODは固定SHA256で検証します。\n\n単独・サニタイザ・注入・模擬appの導入/更新/署名/復元/削除テストを通過。実ゲームの全クラッシュ解消を保証するものではありません。\n\nZIPを展開し .command を実行してください。SHA256SUMS.txtを添付しています。\n\nSource commit: '+commit
  release=api('POST','/releases',{'tag_name':tag,'target_commitish':commit,'name':'EU4 Japanese for Mac '+version,'body':notes,'draft':True,'prerelease':False})
 existing={a['name']:a for a in release.get('assets',[])}
 allowed={'EU4-Japanese-Mac.zip','EU4 Japanese for Mac.command','SHA256SUMS.txt'}
 if not set(existing)<=allowed:raise SystemExit('Draft contains unexpected assets; refusing publication')
 url=release['upload_url'].split('{')[0]
 for name,kind in [('EU4-Japanese-Mac.zip','application/zip'),('EU4 Japanese for Mac.command','application/octet-stream'),('SHA256SUMS.txt','text/plain')]:
  p=ROOT/'dist'/name;assert p.is_file()
  if name in existing:
   a=existing[name]
   if a.get('digest')!='sha256:'+hashlib.sha256(p.read_bytes()).hexdigest() or a.get('size')!=p.stat().st_size:raise SystemExit('Existing draft asset differs; refusing replacement')
   continue
  api('POST',url+'?name='+urllib.parse.quote(name,safe=''),p.read_bytes(),kind)
 published=api('PATCH','/releases/'+str(release['id']),{'draft':False,'make_latest':'true'})
 print('Published '+published['html_url']+' / immutable='+str(published.get('immutable','unknown')))
if __name__=='__main__':main()
