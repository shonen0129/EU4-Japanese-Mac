function pinnedModReceipt(pin,url) {
    return {tag:pin.release,published:pin.published,url:url||pin.dist_url,md5:pin.download_md5,download_sha256:pin.download_sha256,mod_sha256:pin.descriptor_sha256,zip_sha256:pin.archive_sha256};
}
function pinnedModPresent(m) {
    var pin=DEPENDENCY_LOCK.mods[m.id],z=modDir+'/'+m.id+'.zip',f=modDir+'/'+m.id+'.mod';
    if(!pin||pin.repository!==m.repo)fail('承認済みMOD定義がありません: '+m.id);
    noLink(z);noLink(f);
    return exists(z)&&exists(f)&&sha(z)===pin.archive_sha256&&sha(f)===pin.descriptor_sha256;
}
function prepareMod(m) {
    var pin=DEPENDENCY_LOCK.mods[m.id],dir=scratch+'/'+m.id;
    if(!pin||pin.repository!==m.repo)fail('承認済みMOD定義がありません: '+m.id);
    if(pinnedModPresent(m)) {
        descriptor(read(modDir+'/'+m.id+'.mod'),m);
        log(m.name+': 承認済み版 '+pin.release+'・固定SHA256確認済み（本体の再ダウンロード省略）');
        var old=state.mods[m.id];
        if(old&&old.tag===pin.release&&old.zip_sha256===pin.archive_sha256&&old.mod_sha256===pin.descriptor_sha256)return null;
        return {mod:m,dir:modDir,receipt:pinnedModReceipt(pin)};
    }
    var p=scratch+'/'+m.id+'.dist.json';download(pin.dist_url,p,1024*1024);
    if(sha(p)!==pin.dist_sha256)fail('承認済みdist.v2.jsonのSHA256不一致。未知の変更は採用しません: '+m.name);
    var d=json(p);https(d.url,['d3fxmsw7mhzbqi.cloudfront.net','www.googleapis.com']);
    if(d.file_size!==pin.download_size||String(d.file_md5).toLowerCase()!==pin.download_md5)fail('承認済み配布情報のchecksum/size不一致: '+m.name);
    var zip=scratch+'/'+m.id+'.download.zip';download(d.url,zip,pin.download_size);
    if(size(zip)!==pin.download_size||sha(zip)!==pin.download_sha256||md5(zip)!==pin.download_md5)fail('MOD固定SHA256/checksum/size不一致: '+m.name);
    log(m.repo+' 承認済み版='+pin.release+' SHA256='+pin.download_sha256+' published='+pin.published);
    extract(zip,[m.id+'.mod',m.id+'.zip'],dir);descriptor(read(dir+'/'+m.id+'.mod'),m);
    if(sha(dir+'/'+m.id+'.mod')!==pin.descriptor_sha256||sha(dir+'/'+m.id+'.zip')!==pin.archive_sha256)fail('展開したMODの固定SHA256不一致: '+m.name);
    checkZip(dir+'/'+m.id+'.zip');return {mod:m,dir:dir,receipt:pinnedModReceipt(pin,d.url)};
}
function checkUpdates() {
    log('更新候補の確認のみ。取得した最新版を自動適用しません。');
    [{repo:PROJECT_REPOSITORY,current:'v'+INSTALLER_VERSION}].concat(MODS.map(function(m){return {repo:m.repo,current:DEPENDENCY_LOCK.mods[m.id].release};})).forEach(function(item,index){
        try {
            var release=latest(item.repo,'update-'+index),tag=String(release.tag_name);
            if(!/^[A-Za-z0-9._-]{1,80}$/.test(tag))fail('リリース名が不正です');
            log(item.repo+': 導入対象='+item.current+' / 公開最新版='+tag+(tag===item.current?'（同じ版）':'（候補あり・検証後に採用）'));
        }catch(e){log('更新確認できません: '+item.repo+' / '+e.message);}
    });
    log('管理リポジトリの検証済みインストーラ: https://github.com/'+PROJECT_REPOSITORY+'/releases/latest');
}
