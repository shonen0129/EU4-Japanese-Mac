function materializeNativeSources() {
    var dir=scratch+'/native-source';mkdir(dir);
    Object.keys(JP_SUPPORT.source_bundle).forEach(function(name){
        if(!/^[A-Za-z0-9_./-]+$/.test(name)||name[0]==='/'||name.split('/').some(function(x){return x==='..'||x==='.';}))fail('内蔵ソースのパスが不正');
        var text=JP_SUPPORT.source_bundle[name];
        if(sha256Text(text)!==JP_SUPPORT.source_hashes[name])fail('内蔵ソースのSHA256不一致: '+name);
        var p=dir+'/'+name;mkdir(parent(p));write(p,text);
        if(sha(p)!==JP_SUPPORT.source_hashes[name])fail('内蔵ソースの書き出し検証失敗: '+name);
    });
    return dir;
}
function prepareJapaneseDylib(dest) {
    var compiler=nativeCompiler(),sdk=nativeSDK(),version=cmd(compiler,['--version']);
    var recipe=sha256Text(JP_SUPPORT.native_id+version+sdk+cmd('/usr/bin/sw_vers',['-productVersion']).trim()),dir=root+'/native-cache/jp-'+recipe.slice(0,24),cached=dir+'/libeu4dll_mac.dylib',meta=dir+'/receipt.json';
    noLink(dir);noLink(cached);noLink(meta);mkdir(dir);
    var receipt;
    if(exists(cached)&&exists(meta)) {
        receipt=json(meta);
        if(receipt.recipe===recipe&&receipt.source_bundle_sha256===JP_SUPPORT.native_id&&receipt.sha256===sha(cached)&&japaneseMarker(cached)&&mapSafetyMarker(cached)) {
            requireX86(cached);copy(cached,dest);log('日本語拡張: ソース照合済みローカルビルドを再利用');return receipt;
        }
    }
    var sourceDir=materializeNativeSources(),built=scratch+'/libeu4dll_mac-jp.dylib';
    var args=['-isysroot',sdk,'-arch','x86_64','-std=c++17','-O3','-DNDEBUG','-dynamiclib','-fPIC','-framework','CoreFoundation','-Wl,-install_name,@executable_path/../Frameworks/libeu4dll_mac.dylib','-o',built];
    JP_SUPPORT.cpp_files.forEach(function(f){args.push(sourceDir+'/'+f);});
    log('管理リポジトリの内蔵ソースから日本語拡張をビルド中…');cmd(compiler,args);requireX86(built);
    if(!japaneseMarker(built)||!mapSafetyMarker(built))fail('日本語拡張・国名安全化の識別情報がありません');
    cacheCopy(built,cached);
    receipt={format:2,recipe:recipe,sha256:sha(cached),source_repository:PROJECT_REPOSITORY,source_bundle_sha256:JP_SUPPORT.native_id,upstream_commit:JP_SUPPORT.commit,alias:'U+20B9F <-> U+E000',compiler:version.trim()};
    save(meta,receipt);copy(cached,dest);log('日本語拡張 dylib SHA256='+receipt.sha256+' / source bundle='+JP_SUPPORT.native_id);return receipt;
}
function prepareInjector(dest) {
    var compiler=nativeCompiler(),sdk=nativeSDK(),version=cmd(compiler,['--version']),source=JP_SUPPORT.source_bundle['tools/insert_dylib.cpp'];
    var hash=sha256Text(source);if(hash!==JP_SUPPORT.source_hashes['tools/insert_dylib.cpp'])fail('内蔵注入ツールのソースSHA256不一致');
    var recipe=sha256Text(source+version+sdk+hostCPU()+cmd('/usr/bin/sw_vers',['-productVersion']).trim()),dir=root+'/native-cache/inject-'+recipe.slice(0,24),cached=dir+'/insert_dylib',meta=dir+'/receipt.json';
    noLink(dir);noLink(cached);noLink(meta);mkdir(dir);
    if(exists(cached)&&exists(meta)) {
        var r=json(meta);
        if(r.recipe===recipe&&r.sha256===sha(cached)&&arch(cached).text.trim()===hostCPU()){copy(cached,dest);return;}
    }
    var src=scratch+'/insert_dylib.cpp',built=scratch+'/insert_dylib';write(src,source);
    if(sha(src)!==hash)fail('注入ツールの書き出し検証失敗');
    log('内蔵ソースからMach-O注入ツールをビルド中…');cmd(compiler,['-isysroot',sdk,'-arch',hostCPU(),'-std=c++17','-O2',src,'-o',built]);
    if(arch(built).text.trim()!==hostCPU())fail('注入ツールのarchitecture不一致');
    cacheCopy(built,cached);save(meta,{recipe:recipe,sha256:sha(cached),source_sha256:hash,compiler:version.trim()});copy(cached,dest);
}
function preparePatch() {
    var dir=scratch+'/patch';mkdir(dir);
    log('ネイティブ配布元: https://github.com/'+PROJECT_REPOSITORY+' / 内蔵ソースSHA256='+JP_SUPPORT.native_id);
    var japanese=prepareJapaneseDylib(dir+'/libeu4dll_mac.dylib');prepareInjector(dir+'/insert_dylib');
    return {dir:dir,tag:'b5-jp-'+INSTALLER_VERSION,published:'2026-11-15',url:'https://github.com/'+PROJECT_REPOSITORY,sha256:japanese.sha256,japanese:japanese};
}
