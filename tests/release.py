"""Exercise publishing decisions with a fake API; never access a token/network."""
import importlib.util,unittest,urllib.error,hashlib
from unittest.mock import patch
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('publisher',ROOT/'tools/publish_release.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SHA='a'*40
class ReleaseTests(unittest.TestCase):
 def run_publish(self,old=None,env=None):
  self.calls=[]
  def api(method,path,data=None,content_type='application/json'):
   self.calls.append((method,path,data))
   if method=='GET':
    if old is None:raise urllib.error.HTTPError(path,404,'missing',{},None)
    return old
   if method=='POST' and path=='/releases':return {'id':1,'upload_url':'https://uploads.github.com/repos/shonen0129/EU4-Japanese-Mac/releases/1/assets{?name}','assets':[]}
   if method=='PATCH':return {'html_url':'https://github.com/shonen0129/EU4-Japanese-Mac/releases/tag/v2.2.0','immutable':True}
   return {'id':2}
  values={'GITHUB_REPOSITORY':m.REPO,'GITHUB_REF':'refs/heads/main','GITHUB_SHA':SHA}
  if env:values.update(env)
  with patch.dict(m.os.environ,values,clear=True),patch.object(m.subprocess,'check_output',return_value=SHA+'\n'),patch.object(m,'api',side_effect=api):m.main()
 def draft(self,assets=None):return {'id':1,'draft':True,'target_commitish':SHA,'upload_url':'https://uploads.github.com/repos/shonen0129/EU4-Japanese-Mac/releases/1/assets{?name}','assets':assets or []}
 def test_new_release(self):
  self.run_publish();self.assertEqual(len([x for x in self.calls if x[0]=='POST']),4);self.assertEqual(self.calls[-1][0],'PATCH')
 def test_published_is_never_overwritten(self):
  self.run_publish({'draft':False,'html_url':'https://github.com/example'});self.assertEqual(len(self.calls),1)
 def test_foreign_draft(self):
  d=self.draft();d['target_commitish']='b'*40
  with self.assertRaises(SystemExit):self.run_publish(d)
 def test_unknown_asset(self):
  with self.assertRaises(SystemExit):self.run_publish(self.draft([{'name':'unexpected.exe'}]))
 def test_asset_mismatch(self):
  with self.assertRaises(SystemExit):self.run_publish(self.draft([{'name':'EU4-Japanese-Mac.zip','digest':'sha256:'+'0'*64,'size':1}]))
 def test_resume_identical_asset(self):
  p=ROOT/'dist/EU4-Japanese-Mac.zip';a={'name':p.name,'digest':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size}
  self.run_publish(self.draft([a]));self.assertEqual(len([x for x in self.calls if x[0]=='POST']),2)
 def test_wrong_repository(self):
  with self.assertRaises(SystemExit):self.run_publish(env={'GITHUB_REPOSITORY':'someone/else'})
 def test_wrong_branch(self):
  with self.assertRaises(SystemExit):self.run_publish(env={'GITHUB_REF':'refs/heads/other'})
if __name__=='__main__':unittest.main()
