// EU4 Japanese for Mac 2.2.0 — native macOS JXA runtime, embedded in .command.
// MIT License. No external JavaScript, Python, Homebrew or npm is required.
if (typeof ObjC !== 'undefined') ObjC.import('Foundation');
var INSTALLER_VERSION = '2.2.0';
var LOAD_PATH = '@executable_path/../Frameworks/libeu4dll_mac.dylib';
var MODS = [
    {id:'jpmod_ap0_mod', repo:'matanki-saito/EU4JPModCore', name:'JPMOD Main 1: Fonts and UI'},
    {id:'jpmod_ap1_mod', repo:'matanki-saito/EU4JPModAppendixI', name:'JPMOD Main 2: Text'},
    {id:'jpmod_ap2_mod', repo:'matanki-saito/EU4JPModAppendixII', name:'JPMOD Sub 1: Characters, Cultures'}
];
var SUPPLEMENT={id:'eu4jp_mac_supplement',name:'JPMOD Mac: Translation Supplement'};
var SUPPLEMENT_DATA=__SUPPLEMENT_DATA__;
var DEPENDENCY_LOCK=__DEPENDENCY_LOCK__;
var PROJECT_REPOSITORY='shonen0129/EU4-Japanese-Mac';
var JP_SUPPORT=__JP_SUPPORT__;
var fm, home, root, logPath, modDir, scratch, state, journal, lockHeld = false;
function fail(s) { throw new Error(s); }
function ns(s) { return $(String(s)); }
function exists(p) { return !!fm.fileExistsAtPath(ns(p)); }
function read(p) {
    var s = $.NSString.stringWithContentsOfFileEncodingError(ns(p), $.NSUTF8StringEncoding, null);
    if (!s || s.isNil()) fail('UTF-8ファイルを読めません: ' + p);
    return ObjC.unwrap(s);
}
function write(p,s) {
    if (!ns(s).writeToFileAtomicallyEncodingError(ns(p),true,$.NSUTF8StringEncoding,null)) fail('書き込み失敗: '+p);
}
function json(p) { return JSON.parse(read(p)); }
function save(p,o) { write(p,JSON.stringify(o,null,2)+'\n'); }
function out(s) { $.NSFileHandle.fileHandleWithStandardOutput.writeData(ns(s+'\n').dataUsingEncoding($.NSUTF8StringEncoding)); }
function log(s) {
    var line = new Date().toISOString()+' '+String(s).replace(/\r/g,'');
    out(s);
    if (logPath) {
        var h = $.NSFileHandle.fileHandleForWritingAtPath(ns(logPath));
        if (!h || h.isNil()) fail('ログを開けません: '+logPath);
        h.seekToEndOfFile; h.writeData(ns(line+'\n').dataUsingEncoding($.NSUTF8StringEncoding)); h.closeFile;
    }
}
// Recovery must keep running even when the log file or terminal is unavailable.
function safeLog(s) {
    try { log(s); }
    catch(e) { try { out(String(s)+'\nログ記録失敗: '+e.message); } catch(ignored) {} }
}
function ask(s) {
    out(s);
    var data = $.NSMutableData.data;
    while (true) {
        var b = $.NSFileHandle.fileHandleWithStandardInput.readDataOfLength(1);
        if (Number(b.length)===0) fail('入力が終了しました。');
        var ch = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(b,$.NSISOLatin1StringEncoding));
        if (ch==='\n') break;
        data.appendData(b);
    }
    return ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data,$.NSUTF8StringEncoding)).replace(/\r$/,'');
}
function task(exe,args,allowFailure,workingDirectory) {
    var t=$.NSTask.alloc.init, pipe=$.NSPipe.pipe;
    t.launchPath=ns(exe); t.arguments=$(args.map(String));
    if(workingDirectory) t.currentDirectoryPath=ns(workingDirectory);
    var env=$.NSProcessInfo.processInfo.environment.mutableCopy;
    var cf=ObjC.unwrap(env.objectForKey(ns('__CF_USER_TEXT_ENCODING'))) || '0x0';
    env.setObjectForKey(ns(cf.split(':')[0]+':0x08000100:0'),ns('__CF_USER_TEXT_ENCODING')); // UTF-8 paths, including codesign's metadata scan.
    env.setObjectForKey(ns('en_US.UTF-8'),ns('LC_ALL'));
    t.environment=env;
    t.standardOutput=pipe; t.standardError=pipe;
    t.launch;
    var data=pipe.fileHandleForReading.readDataToEndOfFile;
    t.waitUntilExit;
    var s=$.NSString.alloc.initWithDataEncoding(data,$.NSUTF8StringEncoding);
    var r={status:Number(t.terminationStatus), text:s&&!s.isNil()?ObjC.unwrap(s):''};
    if (r.status!==0 && !allowFailure) fail(exe+' 失敗 ('+r.status+')\n'+r.text);
    return r;
}
function cmd(exe,args,workingDirectory) { return task(exe,args,false,workingDirectory).text; }
function mkdir(p) { cmd('/bin/mkdir',['-p',p]); }
function symlink(p) { return ObjC.unwrap(fm.destinationOfSymbolicLinkAtPathError(ns(p),null))!==undefined; }
function noLink(p) {
    // Reject symlink ancestors too; never overwrite an unexpected redirected file.
    var q=p;
    while(q && q!=='/') {
        var systemAlias=(q==='/var'||q==='/tmp'||q==='/etc') && ObjC.unwrap(fm.destinationOfSymbolicLinkAtPathError(ns(q),null))==='private'+q;
        if(symlink(q)&&!systemAlias) fail('シンボリックリンクの管理対象には書き込めません: '+q); q=parent(q);
    }
}
function parent(p) { return p.slice(0,p.lastIndexOf('/')) || '/'; }
function remove(p) {
    if (exists(p) || symlink(p)) {
        if (!fm.removeItemAtPathError(ns(p),null)) fail('削除失敗: '+p);
    }
}
function move(a,b) {
    if (!fm.moveItemAtPathToPathError(ns(a),ns(b),null)) fail('移動失敗: '+a+' → '+b);
}
function copy(a,b) { cmd('/usr/bin/ditto',[a,b]); }
function atomicCopy(a,b) {
    noLink(b); var tmp=b+'.eu4jp-new';
    if(exists(tmp)||symlink(tmp)) fail('一時ファイルが残っています: '+tmp);
    copy(a,tmp); cmd('/bin/mv',['-f',tmp,b]);
}
function sha(p) { return cmd('/usr/bin/shasum',['-a','256',p]).split(/\s+/)[0].toLowerCase(); }
function md5(p) { return cmd('/sbin/md5',['-q',p]).trim().toLowerCase(); }
function size(p) { return Number(cmd('/usr/bin/stat',['-f','%z',p]).trim()); }
function canonical(p) { return ObjC.unwrap(ns(p).stringByStandardizingPath.stringByResolvingSymlinksInPath); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function arch(p) { return task('/usr/bin/lipo',['-archs',p],true); }
function requireX86(p) {
    var r=arch(p);
    if(r.status!==0 || r.text.trim()!=='x86_64') fail('x86_64単独のMach-Oが必要です（Universal/ARM64は停止）: '+p+' ['+r.text.trim()+']');
}
function gameVersion(p) {
    var text=cmd('/usr/bin/strings',['-a',p]);
    var re=/EU4 v(\d+\.\d+(?:\.\d+){0,2})(?![\d.])/g, m, found=[];
    while((m=re.exec(text))!==null) if(found.indexOf(m[1])<0) found.push(m[1]);
    if(found.length!==1) fail('EU4バージョンを一意に判定できません: '+p);
    return found[0];
}
function supported(v) { return /^1\.37(?:\.|$)/.test(v); }
function loads(p) {
    var text=cmd('/usr/bin/otool',['-l',p]), lines=text.split('\n'), result=[], type='';
    lines.forEach(function(l){
        var c=l.match(/^\s*cmd (LC_\S+)/); if(c) type=c[1];
        var n=l.match(/^\s*name (.*) \(offset \d+\)\s*$/);
        if(n && /DYLIB/.test(type)) result.push({type:type,name:n[1]});
    });
    return result;
}
function patchLoads(p) { return loads(p).filter(function(x){return /(?:^|\/)libeu4dll_mac\.dylib$/.test(x.name);}); }
function verifyInjected(p) {
    var a=patchLoads(p);
    if(a.length!==1 || a[0].type!=='LC_LOAD_DYLIB' || a[0].name!==LOAD_PATH) fail('LC_LOAD_DYLIBの実検証失敗: '+p);
    log('LC_LOAD_DYLIB: verified '+LOAD_PATH);
}
function userHome() { return ObjC.unwrap($.NSHomeDirectory()); }
function hostCPU() { return task('/usr/sbin/sysctl',['-n','hw.optional.arm64'],true).text.trim()==='1'?'arm64':cmd('/usr/bin/uname',['-m']).trim(); }
function rosetta() { return hostCPU()!=='arm64' || task('/usr/bin/arch',['-x86_64','/usr/bin/true'],true).status===0; }
function ensureStopped() {
    ['eu4','dowser','Paradox Launcher','Paradox Launcher Helper'].forEach(function(n){
        var r=task('/usr/bin/pgrep',['-x',n],true);
        if(r.status===0) fail('EU4とParadox Launcherを終了してから再実行してください: '+n);
        if(r.status!==1) fail('起動プロセスを検査できません: '+n);
    });
}
function validateGame(app,versionCheck) {
    var e=app+'/Contents/MacOS/eu4'; noLink(e); noLink(app+'/Contents/Info.plist');
    noLink(app+'/Contents/Frameworks/libeu4dll_mac.dylib'); noLink(app+'/Contents/MacOS/libeu4dll_mac.dylib');
    if(!exists(e)||!exists(app+'/Contents/Info.plist')) fail('有効なeu4.appがありません: '+app);
    requireX86(e); var v=gameVersion(e);
    if(versionCheck && !supported(v)) fail('未対応EU4 '+v+'。対応は1.37.xです。本体は変更していません。');
    if(versionCheck && !rosetta()) fail('Rosetta 2を利用できません。Appleの案内に従ってRosettaを導入後、再実行してください。自動導入は行いません。');
    log('EU4 path: '+app+' / version: '+v+' / architecture: x86_64');
    return v;
}
// Parse one Finder/Terminal-dropped path without eval or command substitution.
function droppedPath(s) {
    s=s.trim(); if(exists(s)) return s;
    var result='',quote='',escaped=false;
    for(var i=0;i<s.length;i++) {
        var c=s[i];
        if(escaped) { result+=c; escaped=false; continue; }
        if(c==='\\' && quote!=="'") { escaped=true; continue; }
        if(quote) { if(c===quote) quote=''; else result+=c; }
        else if(c==='"'||c==="'") quote=c;
        else if(/\s/.test(c)) { if(s.slice(i).trim()) fail('eu4.appを1つだけ指定してください。'); }
        else result+=c;
    }
    if(quote||escaped) fail('パスの引用符/エスケープが閉じていません。Finder選択を使用してください。');
    if(result.slice(0,2)==='~/') result=home+result.slice(1);
    return result;
}
function libraryPaths(s) {
    // Steam KeyValues lexer. Preserve non-ASCII and decode only VDF's two escapes.
    var tokens=[],i=0;
    while(i<s.length) {
        if(/\s/.test(s[i])) { i++; continue; }
        if(s.slice(i,i+2)==='//') { i=s.indexOf('\n',i); if(i<0) break; continue; }
        if(s[i]==='{'||s[i]==='}') { tokens.push(s[i++]); continue; }
        if(s[i]!=='"') fail('未知のSteam Library設定形式');
        i++; var word='',closed=false;
        while(i<s.length) {
            var c=s[i++]; if(c==='"') { closed=true; break; }
            if(c==='\\' && /[\\"]/.test(s[i]||'')) c=s[i++];
            word+=c;
        }
        if(!closed) fail('Steam Library設定の文字列が未完了');
        tokens.push({s:word});
    }
    var result=[];
    for(i=0;i<tokens.length-1;i++) if(tokens[i].s!==undefined && tokens[i+1].s!==undefined) {
        var k=tokens[i].s,v=tokens[i+1].s;
        if((k.toLowerCase()==='path'||/^\d+$/.test(k))&&v[0]==='/') result.push(v);
    }
    return result;
}
function findApp(explicit) {
    if(explicit) return canonical(explicit);
    var steam=home+'/Library/Application Support/Steam', suffix='/steamapps/common/Europa Universalis IV/eu4.app';
    if(exists(steam+suffix)) return canonical(steam+suffix);
    var libs=[];
    [steam+'/steamapps/libraryfolders.vdf',steam+'/config/libraryfolders.vdf'].forEach(function(p){
        if(exists(p)) try { libs=libs.concat(libraryPaths(read(p))); } catch(e) { log('Steam Library設定: '+e.message); }
    });
    for(var i=0;i<libs.length;i++) if(exists(libs[i]+suffix)) return canonical(libs[i]+suffix);
    if(exists(root+'/last-app.txt')) { var last=read(root+'/last-app.txt').trim(); if(exists(last)) return canonical(last); }
    var s=ask('eu4.appをターミナルへドラッグしてEnter（空欄EnterでFinder選択）:');
    if(s.trim()) return canonical(droppedPath(s));
    var app=Application.currentApplication(); app.includeStandardAdditions=true;
    return canonical(app.chooseFile({withPrompt:'Steamのeu4.appを選択してください',ofType:['com.apple.application-bundle']}).toString());
}
function https(url,allowed) {
    if(typeof url!=='string'||/[\x00-\x20\x7f]/.test(url)) fail('不正なダウンロードURL');
    var m=url.match(/^https:\/\/([^/?#:]+)(\/[^#]*)?$/i);
    if(!m || (allowed && allowed.indexOf(m[1].toLowerCase())<0)) fail('許可されていない配布URL: '+url);
    return url;
}
function download(url,dest,maxBytes) {
    https(url); log('Download: '+url.replace(/\?.*$/,'?（query redacted）'));
    var part=dest+'.part'; remove(part);
    try {
        cmd('/usr/bin/curl',['--fail','--location','--silent','--show-error','--proto','=https','--proto-redir','=https','--tlsv1.2','--connect-timeout','20','--max-time','600','--retry','2','--max-filesize',String(maxBytes),'-H','User-Agent: EU4-Japanese-Mac/'+INSTALLER_VERSION,'--output',part,url]);
        if(size(part)>maxBytes || size(part)===0) fail('ダウンロードサイズが不正');
        remove(dest); move(part,dest);
    } catch(e) { remove(part); throw e; }
}
function latest(repo,label) {
    var p=scratch+'/'+label+'.release.json'; download('https://api.github.com/repos/'+repo+'/releases/latest',p,4*1024*1024);
    var r=json(p);
    if(r.draft||r.prerelease||typeof r.tag_name!=='string'||!r.published_at||!Array.isArray(r.assets)) fail('Release情報が不正: '+repo);
    log(repo+' version='+r.tag_name+' published='+r.published_at);
    return r;
}
function asset(r,predicate) {
    var a=r.assets.filter(predicate); if(a.length!==1) fail('想定するRelease assetを一意に取得できません');
    https(a[0].browser_download_url,['github.com']); return a[0];
}
function checkZip(zip) {
    var listing=cmd('/usr/bin/unzip',['-Z1',zip]).trim().split('\n'), seen={};
    listing.forEach(function(n){
        if(!n||/[\x00-\x1f\\]/.test(n)||n[0]==='/'||/^[A-Za-z]:/.test(n)||n.split('/').some(function(c){return c==='..'||c==='.';})||seen[n]) fail('危険または重複したZIPパス: '+n);
        seen[n]=true;
    });
    var details=cmd('/usr/bin/unzip',['-Z','-l',zip]);
    if(/^[lbcps]/m.test(details)) fail('ZIP内のリンク/特殊ファイルは拒否しました');
    var total=details.match(/(?:^|\n)\d+ files?, (\d+) bytes uncompressed/);
    if(!total||Number(total[1])>2*1024*1024*1024) fail('ZIP展開サイズを安全に検証できません');
    cmd('/usr/bin/unzip',['-tqq',zip]);
    return listing;
}
function extract(zip,names,dest) {
    var list=checkZip(zip);
    names.forEach(function(n){if(list.indexOf(n)<0) fail('配布ZIPに必要なファイルがありません: '+n);});
    mkdir(dest); cmd('/usr/bin/unzip',['-qq',zip].concat(names).concat(['-d',dest]));
    names.forEach(function(n){noLink(dest+'/'+n);});
}
function descriptor(text,m) {
    function one(k) {
        var re=new RegExp('^\\s*'+k+'\\s*=\\s*"([^"\\r\\n]*)"\\s*$','gm'), all=[],x;
        while((x=re.exec(text))!==null) all.push(x[1]);
        if(all.length!==1) fail('.modの'+k+'を検証できません: '+m.id); return all[0];
    }
    if(one('name')!==m.name || one('archive')!=='mod/'+m.id+'.zip' || !/^v?1\.37\.(?:\*|\d+)(?:\.(?:\*|\d+))?$/.test(one('supported_version')) || /^\s*path\s*=/m.test(text)) fail('MOD名/パス/1.37互換性の検証失敗: '+m.id);
}
__PINNED_MOD_RUNTIME__
function decodeLegacyLocalisation(s) {
    if(!/[\x10-\x13]/.test(s)) return s;
    var table={'8364':128,'8218':130,'402':131,'8222':132,'8230':133,'8224':134,'8225':135,'710':136,'8240':137,'352':138,'8249':139,'338':140,'381':142,'8216':145,'8217':146,'8220':147,'8221':148,'8226':149,'8211':150,'8212':151,'732':152,'8482':153,'353':154,'8250':155,'339':156,'382':158,'376':159};
    var codes=[],result='';
    for(var i=0;i<s.length;i++) {var c=s.charCodeAt(i);codes.push(table[c]===undefined?c:table[c]);}
    for(i=0;i<codes.length;i++) {
        var flag=codes[i];
        if(flag>=16 && flag<=19) {
            if(i+2>=codes.length || codes[i+1]>255 || codes[i+2]>255) fail('JPMODの文字エスケープを解析できません');
            var lo=codes[++i],hi=codes[++i];
            if(flag===17||flag===19) lo-=14;
            if(flag===18||flag===19) hi+=9;
            if(lo<0||hi>255) fail('JPMODの文字エスケープが不正です');
            result+=String.fromCharCode((hi<<8)|lo);
        } else result+=String.fromCharCode(flag);
    }
    return result;
}
function localisationValues(s) {
    var values=Object.create(null);
    s.split('\n').forEach(function(line){
        var m=line.match(/^[ \t]*([^#:\s][^:\s]*):[ \t]*[0-9]*[ \t]*"(.*)"/);
        if(m) {
            if(Object.prototype.hasOwnProperty.call(values,m[1])) fail('localisationキーが重複しています: '+m[1]);
            values[m[1]]=decodeLegacyLocalisation(m[2]);
        }
    });
    return values;
}
// UTF-8 SHA256 avoids starting a process for every localisation value.
function sha256Text(s) {
    var bytes=unescape(encodeURIComponent(s)), n=bytes.length, bits=n*8;
    var h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    bytes+='\x80';while(bytes.length%64!==56) bytes+='\x00';
    var high=Math.floor(bits/4294967296),low=bits>>>0;
    for(var shift=24;shift>=0;shift-=8) bytes+=String.fromCharCode((high>>>shift)&255);
    for(shift=24;shift>=0;shift-=8) bytes+=String.fromCharCode((low>>>shift)&255);
    function r(x,b){return (x>>>b)|(x<<(32-b));}
    for(var off=0;off<bytes.length;off+=64) {
        var w=[];
        for(var i=0;i<16;i++) {var j=off+i*4;w[i]=(bytes.charCodeAt(j)<<24)|(bytes.charCodeAt(j+1)<<16)|(bytes.charCodeAt(j+2)<<8)|bytes.charCodeAt(j+3);}
        for(i=16;i<64;i++) {var u=w[i-15],v=w[i-2];w[i]=((r(u,7)^r(u,18)^(u>>>3))+w[i-16]+(r(v,17)^r(v,19)^(v>>>10))+w[i-7])|0;}
        var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],z=h[7];
        for(i=0;i<64;i++) {
            var t1=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])|0;
            var t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;
            z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
        }
        var work=[a,b,c,d,e,f,g,z];for(i=0;i<8;i++)h[i]=(h[i]+work[i])|0;
    }
    return h.map(function(x){return ('00000000'+(x>>>0).toString(16)).slice(-8);}).join('');
}
function localisationTokens(s) {return s.match(/\$[^$\r\n]*\$|\[[^\]\r\n]*\]|£[A-Za-z0-9_]+£?|§[A-Za-z0-9!]|@[A-Za-z0-9]{3}\b|\\+[nrt"]/g)||[];}
function patchedValue(e,source) {
    var result=source;
    if(e.edits) {
        var edits=e.edits.slice().sort(function(a,b){return b.at-a.at;});
        edits.forEach(function(p){
            if(!Number.isSafeInteger(p.at)||p.at<0||typeof p.from!=='string'||typeof p.to!=='string'||result.slice(p.at,p.at+p.from.length)!==p.from) fail('補訳の置換位置が一致しません: '+e.key);
            result=result.slice(0,p.at)+p.to+result.slice(p.at+p.from.length);
        });
    } else result=e.ja;
    if(e.clean_gloss)result=result.replace(/([\u3040-\u30ff\u3400-\u9fff々・＝ー]{2,})[（(]\1[）)]/g,'$1');
    if(typeof result!=='string'||/[\r\n]/.test(result)||JSON.stringify(localisationTokens(result))!==JSON.stringify(e.tokens)) fail('補訳の変数・書式が不正です: '+e.key);
    return result;
}
function selectSupplement(values,hashValue) {
    var applied=[],skipped=[];
    SUPPLEMENT_DATA.entries.forEach(function(e){
        if(!/^[A-Za-z0-9_.-]+$/.test(e.key)) fail('補訳キーが不正です: '+e.key);
        if(values[e.key]===undefined || hashValue(values[e.key])!==e.source_sha256) {skipped.push(e.key);return;}
        if(JSON.stringify(localisationTokens(values[e.key]))!==JSON.stringify(e.tokens)) fail('元テキストの変数・書式が不正です: '+e.key);
        applied.push({key:e.key,ja:patchedValue(e,values[e.key])});
    });
    return {applied:applied,skipped:skipped};
}
function supplementYml(applied) {
    return '\ufeffl_english:\n'+applied.map(function(e){
        if(/[\r\n]/.test(e.ja)) fail('localisationに実改行があります: '+e.key);
        return ' '+e.key+':0 "'+e.ja+'"';
    }).join('\n')+'\n';
}
// Token positions point into the original decoded .gui string; comments are never edited.
function guiTokens(s) {
    var out=[],i=0;
    while(i<s.length) {
        if(/\s/.test(s[i])){i++;continue;}
        if(s[i]==='#'){var n=s.indexOf('\n',i);i=n<0?s.length:n+1;continue;}
        var start=i;
        if(s[i]==='"') {
            i++;
            while(i<s.length){if(s[i]==='\\'){i+=2;continue;}if(s[i++]==='"')break;}
            out.push({kind:'q',value:s.slice(start+1,i-1),start:start,end:i});continue;
        }
        if(/[{}=]/.test(s[i])){out.push({kind:s[i],value:s[i],start:i,end:i+1});i++;continue;}
        while(i<s.length&&!/\s|[#{}="]/.test(s[i])) i++;
        if(i===start)i++;
        out.push({kind:'w',value:s.slice(start,i),start:start,end:i});
    }
    return out;
}
function patchGui(s,group) {
    var tokens=guiTokens(s),edits=[],counts=group.fields.map(function(){return 0;});
    for(var i=0;i+2<tokens.length;i++) {
        var a=tokens[i],eq=tokens[i+1],v=tokens[i+2];
        if(a.kind!=='w'||eq.kind!=='='||v.kind!=='q')continue;
        group.fields.forEach(function(f,idx){
            if(a.value===f.field&&v.value===f.value){counts[idx]++;edits.push({start:v.start+1,end:v.end-1,value:f.key});}
        });
    }
    group.fields.forEach(function(f,i){if(counts[i]!==f.count)fail('UI文字列の件数が一致しません: '+group.file+' '+f.field);});
    edits.sort(function(a,b){return b.start-a.start;}).forEach(function(e){s=s.slice(0,e.start)+e.value+s.slice(e.end);});
    return {text:s,count:edits.length};
}
function readGui(p,encoding) {
    var enc=encoding==='cp1252'?$.NSWindowsCP1252StringEncoding:$.NSUTF8StringEncoding;
    var data=$.NSData.dataWithContentsOfFile(ns(p)),s=$.NSString.alloc.initWithDataEncoding(data,enc);
    if(!s||s.isNil())fail('UIの文字コードを読み取れません: '+p);
    var text=ObjC.unwrap(s);
    if(encoding!=='cp1252' && ObjC.unwrap(data.base64EncodedStringWithOptions(0)).slice(0,4)==='77u/' && text[0]!=='\ufeff') text='\ufeff'+text;
    return text;
}
function writeGui(p,s,encoding) {
    var enc=encoding==='cp1252'?$.NSWindowsCP1252StringEncoding:$.NSUTF8StringEncoding;
    if(!ns(s).writeToFileAtomicallyEncodingError(ns(p),true,enc,null))fail('UIを書き出せません: '+p);
}
function japaneseMarker(p) {
    return exists(p) && cmd('/usr/bin/strings',['-a',p]).indexOf('EU4JP_JOYO_V1_ALIAS_E000')>=0;
}
function mapSafetyMarker(p) {
    return exists(p)&&cmd('/usr/bin/strings',['-a',p]).indexOf('EU4JP_MAP_SAFE_V1')>=0;
}
function mapSafetyPreflight(p) {
    var data=$.NSData.dataWithContentsOfFile(ns(p));
    var needle=$.NSData.alloc.initWithBase64EncodedStringOptions(ns('Q41ELQCNBEBMY/hJwecC'),0);
    var size=Number(data.length),hit=data.rangeOfDataOptionsRange(needle,0,$.NSMakeRange(0,size));
    if(Number(hit.length)!==15)fail('国名描画の安全化フックが対応しない実行ファイルです。EU4本体は変更しません。');
    var next=Number(hit.location)+15,other=data.rangeOfDataOptionsRange(needle,0,$.NSMakeRange(next,size-next));
    if(Number(other.length)!==0)fail('国名描画フックの一致が複数あります。安全のため停止しました。');
    log('国名描画の容量計算パターン: 一意に確認');
}
function nativeCompiler() {return cmd('/usr/bin/xcrun',['--find','clang++']).trim();}
function nativeSDK() {return cmd('/usr/bin/xcrun',['--sdk','macosx','--show-sdk-path']).trim();}
function cacheCopy(source,dest) {
    // The process lock is held. A cache copy may have been interrupted before
    // the live-app journal existed; only our exact temporary cache file is stale.
    var tmp=dest+'.eu4jp-new';noLink(dest);noLink(tmp);
    if(exists(tmp)&&task('/bin/test',['-f',tmp],true).status!==0)fail('キャッシュ一時パスが通常ファイルではありません: '+tmp);
    remove(tmp);atomicCopy(source,dest);
}
function fontTool() {
    var compiler=nativeCompiler(),sdk=nativeSDK(),version=cmd(compiler,['--version']);
    var key=sha256Text(JP_SUPPORT.font_helper+version+sdk+hostCPU()+cmd('/usr/bin/sw_vers',['-productVersion']).trim()).slice(0,24),dir=root+'/native-cache/font-'+key,exe=dir+'/font-helper',meta=dir+'/receipt.json';
    noLink(dir);noLink(exe);noLink(meta);mkdir(dir);
    if(exists(exe)&&exists(meta)&&json(meta).sha256===sha(exe))return exe;
    var src=scratch+'/font-helper.mm',built=scratch+'/font-helper';write(src,JP_SUPPORT.font_helper);
    cmd(compiler,['-isysroot',sdk,'-arch',hostCPU(),'-std=c++17','-O2','-fobjc-arc','-framework','Foundation','-framework','CoreText','-framework','CoreGraphics',src,'-o',built]);
    if(arch(built).text.trim()!==hostCPU())fail('フォント生成ツールのarchitecture不一致');
    cacheCopy(built,exe);save(meta,{sha256:sha(exe),source_sha256:sha256Text(JP_SUPPORT.font_helper),compiler:version.trim()});return exe;
}
__NATIVE_RUNTIME__
function prepareJapaneseFonts(main1Zip,listing,contents) {
    var fonts=listing.filter(function(n){return /^gfx\/fonts\/[A-Za-z0-9_.-]+\.fnt$/.test(n);});
    if(!fonts.length)fail('Main 1のフォント定義が見つかりません');
    var files=[];fonts.forEach(function(f){files.push(f,f.slice(0,-4)+'.dds');});
    var src=scratch+'/jp-fonts';extract(main1Zip,files,src);
    var scope=scratch+'/jp-scope.txt';write(scope,JP_SUPPORT.characters);var helper=fontTool(),receipts=[];
    fonts.forEach(function(f){
        var base=f.slice(0,-4),dest=contents+'/'+base;mkdir(parent(dest));
        var result=cmd(helper,[src+'/'+f,src+'/'+base+'.dds',dest,scope]);
        var m=result.match(/Added (\d+) glyphs;/);if(!m)fail('フォント補完結果を検証できません: '+f);
        receipts.push({file:f,added:Number(m[1]),source_fnt_sha256:sha(src+'/'+f),source_dds_sha256:sha(src+'/'+base+'.dds'),fnt_sha256:sha(dest+'.fnt'),dds_sha256:sha(dest+'.dds')});
        log('フォント補完 '+f+': '+m[1]+'字 / SHA256='+receipts[receipts.length-1].dds_sha256);
    });
    log('常用漢字2,136字・かな186字・記号の合計2,337字を '+fonts.length+'書体で確認・補完しました。');return receipts;
}

function supplementSourceValues(files,readSource) {
    var wanted=Object.create(null),counts=Object.create(null),values=Object.create(null);
    SUPPLEMENT_DATA.entries.forEach(function(e){wanted[e.key]=e.file;});
    // A newly added upstream file may override an unchanged old definition.
    // Ambiguous definitions are never replaced, regardless of file load order.
    files.forEach(function(f){
        readSource(f).split('\n').forEach(function(line){
            var m=line.match(/^[ \t]*([^#:\s][^:\s]*):/);
            if(!m || !Object.prototype.hasOwnProperty.call(wanted,m[1]))return;
            var key=m[1];counts[key]=(counts[key]||0)+1;
            if(wanted[key]===f) {
                var parsed=localisationValues(line);
                if(parsed[key]!==undefined)values[key]=parsed[key];
            }
        });
    });
    Object.keys(values).forEach(function(k){if(counts[k]!==1)delete values[k];});
    return values;
}
function prepareSupplement(main2Zip,main1Zip,gameDir,fontExtension) {
    var listing=checkZip(main2Zip),files=listing.filter(function(f){return /^localisation\/.*_l_english\.yml$/.test(f);});
    var sourceDir=scratch+'/supplement-source';
    if(files.length)extract(main2Zip,files,sourceDir);
    var values=supplementSourceValues(files,function(f){return read(sourceDir+'/'+f);});
    var selection=selectSupplement(values,sha256Text);
    selection.skipped.forEach(function(k){log('補訳スキップ（上流の値変更/キーなし/重複。上流の訳を優先）: '+k);});
    var dir=scratch+'/supplement',contents=dir+'/content';mkdir(contents+'/localisation/replace');
    var main1Listing=checkZip(main1Zip),guiSource=scratch+'/supplement-gui',main1Files=[];
    SUPPLEMENT_DATA.ui_files.forEach(function(g){if(main1Listing.indexOf(g.file)>=0)main1Files.push(g.file);});
    if(main1Files.length)extract(main1Zip,main1Files,guiSource);
    var uiApplied=[],uiSkipped=[],uiSources=[],uiFields=0;
    SUPPLEMENT_DATA.ui_files.forEach(function(g){
        if(!/^interface\/[A-Za-z0-9_/.-]+\.gui$/.test(g.file)||g.file.indexOf('..')>=0)fail('UIパスが不正です');
        var effectiveSource=main1Listing.indexOf(g.file)>=0?'main1':'game';
        if(effectiveSource!==g.source){uiSkipped.push(g.file);log('UI補訳スキップ（Main 1の上書き元が変更）: '+g.file);return;}
        var p=effectiveSource==='main1'?guiSource+'/'+g.file:gameDir+'/'+g.file;
        noLink(p);
        if(!exists(p)){uiSkipped.push(g.file);log('UI補訳スキップ（元ファイルなし）: '+g.file);return;}
        // Hash and translate the same private snapshot, even if Steam changes the source.
        var snapshot=scratch+'/supplement-snapshot/'+g.file;mkdir(parent(snapshot));copy(p,snapshot);
        if(sha(snapshot)!==g.sha256){uiSkipped.push(g.file);log('UI補訳スキップ（元ファイル変更）: '+g.file);return;}
        var translated=patchGui(readGui(snapshot,g.encoding),g),dest=contents+'/'+g.file;mkdir(parent(dest));writeGui(dest,translated.text,g.encoding);
        uiApplied.push(g.file);uiFields+=translated.count;uiSources.push({file:g.file,source:g.source,sha256:g.sha256});
    });
    var fontReceipts=fontExtension?prepareJapaneseFonts(main1Zip,main1Listing,contents):[];
    var allEntries=selection.applied.concat(SUPPLEMENT_DATA.ui_entries);
    write(contents+'/localisation/replace/zzz_eu4jp_mac_supplement_l_english.yml',supplementYml(allEntries));
    var descriptorText='name="'+SUPPLEMENT.name+'"\narchive="mod/'+SUPPLEMENT.id+'.zip"\nsupported_version="v1.37.*.*"\ntags={"Translation" "Localisation"}\ndependencies={"JPMOD Main 1: Fonts and UI" "JPMOD Main 2: Text"}\n';
    write(dir+'/'+SUPPLEMENT.id+'.mod',descriptorText);descriptor(descriptorText,SUPPLEMENT);
    var zipArgs=['-q','-X','-r',dir+'/'+SUPPLEMENT.id+'.zip','localisation'];if(uiApplied.length)zipArgs.push('interface');if(fontReceipts.length)zipArgs.push('gfx');
    cmd('/usr/bin/zip',zipArgs,contents);checkZip(dir+'/'+SUPPLEMENT.id+'.zip');
    var receipt={character_support:fontExtension===true,font_files:fontReceipts,tag:SUPPLEMENT_DATA.version,published:'2026-11-15',source_main2_sha256:sha(main2Zip),source_main1_sha256:sha(main1Zip),applied_keys:selection.applied.map(function(e){return e.key;}),skipped_keys:selection.skipped,ui_applied:uiApplied,ui_skipped:uiSkipped,ui_field_count:uiFields,ui_sources:uiSources,mod_sha256:sha(dir+'/'+SUPPLEMENT.id+'.mod'),zip_sha256:sha(dir+'/'+SUPPLEMENT.id+'.zip')};
    log('補訳MOD '+SUPPLEMENT_DATA.version+': 本文 '+selection.applied.length+'キー / UI '+uiFields+'文言・'+uiApplied.length+'ファイル / 上流優先スキップ '+selection.skipped.length+'キー・'+uiSkipped.length+'ファイル');
    return {mod:SUPPLEMENT,dir:dir,receipt:receipt};
}

function verifySign(app) {
    var r=task('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app],true);
    log('codesign verify: '+r.status+'\n'+r.text.trim());
    if(r.status!==0) fail('codesign検証に失敗しました');
}
function sign(app) {
    // File Provider/Finder can recreate FinderInfo while a bundle is being copied.
    // Retry only this identifiable metadata error; never mask a signing failure.
    for(var attempt=0;attempt<3;attempt++) {
        cmd('/usr/bin/xattr',['-cr',app]);
        var r=task('/usr/bin/codesign',['--force','--deep','--sign','-',app],true);
        if(r.status!==0) {
            log('codesign sign: '+r.status+'\n'+r.text.trim());
            if(/resource fork|Finder information|com\.apple\.FinderInfo/.test(r.text) && attempt<2) continue;
            fail('codesignに失敗しました');
        }
        cmd('/usr/bin/xattr',['-cr',app]);
        var v=task('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app],true);
        log('codesign sign: 0 / verify: '+v.status+'\n'+v.text.trim());
        if(v.status===0) return;
        if(!/resource fork|Finder information|com\.apple\.FinderInfo/.test(v.text) || attempt===2) fail('codesign検証に失敗しました');
    }
}

function preserveRuntimeFiles(stage) {
    // Normalize only our transaction copy. The live app remains the rollback source.
    if(!journal||stage!==journal.txn+'/stage.app')fail('履歴の保管は作業用appだけに実行できます');
    var relative='Contents/MacOS/console_history.txt',source=stage+'/'+relative;
    noLink(source);
    if(!exists(source))return [];
    if(task('/bin/test',['-f',source],true).status!==0)fail('console_history.txtが通常ファイルではありません');
    var hash=sha(source),bytes=size(source);
    if(!/^[a-f0-9]{64}$/.test(hash))fail('コンソール履歴のSHA256を取得できません');
    // Keep independent, durable copies outside the Steam app, including after uninstall.
    var dir=root+'/preserved-runtime-files/console-history',dest=dir+'/'+hash+'.txt';
    noLink(dir);noLink(dest);mkdir(dir);
    if(exists(dest)) {
        if(task('/bin/test',['-f',dest],true).status!==0||sha(dest)!==hash)fail('保管済み履歴のSHA256が一致しません。上書きせず停止しました: '+dest);
    } else cacheCopy(source,dest);
    if(!exists(dest)||sha(dest)!==hash||size(dest)!==bytes)fail('コンソール履歴の保管検証に失敗しました');
    remove(source);
    log('署名準備: '+relative+' を内容を保持して保管 / SHA256='+hash+' / '+dest);
    return [{source:relative,archive:dest,sha256:hash,size:bytes}];
}

function cleanLegacy(app,removePresentation) {
    var p=app+'/Contents/Info.plist', tool='/usr/libexec/PlistBuddy';
    var env=task(tool,['-c','Print :LSEnvironment:DYLD_INSERT_LIBRARIES',p],true);
    if(env.status===0 && /libeu4dll_mac\.dylib/.test(env.text)) {
        // Preserve unrelated DYLD libraries; refuse ambiguous mixed settings.
        if(env.text.trim().split(':').length!==1) fail('旧DYLD設定に複数ライブラリがあります。自動変更を停止しました。');
        cmd(tool,['-c','Delete :LSEnvironment:DYLD_INSERT_LIBRARIES',p]);
        log('旧LSEnvironment:DYLD_INSERT_LIBRARIESを削除');
    }
    if(removePresentation) {
        var r=task(tool,['-c','Print :LSUIPresentationMode',p],true);
        if(r.status===0 && r.text.trim()==='4') cmd(tool,['-c','Delete :LSUIPresentationMode',p]);
    }
    remove(app+'/Contents/MacOS/libeu4dll_mac.dylib');
}
function checkBackup(app,v) {
    var e=app+'/Contents/MacOS/eu4', b=e+'_bak', injected=patchLoads(e).length>0;
    if(injected && !exists(b)) fail('注入済みですがeu4_bakがありません。Steamで整合性確認後に再実行してください。');
    if(exists(b)) {
        noLink(b); requireX86(b);
        if(patchLoads(b).length) fail('eu4_bakも注入済みです。安全な復元元がありません。');
        if(injected && gameVersion(b)!==v) fail('本体とバックアップのバージョンが一致しません。Steamで整合性確認が必要です。');
        var old=state.apps[app];
        if(injected && old && old.backup_sha256!==sha(b)) fail('バックアップのSHA256が記録と一致しません。');
    }
    return injected;
}
function prepareApp(app,patch,uninstall,removePresentation) {
    var v=validateGame(app,!uninstall), injected=checkBackup(app,v);
    journal.live_exec_sha256=sha(app+'/Contents/MacOS/eu4'); journalSave();
    var stage=journal.txn+'/stage.app'; log('EU4 appの作業用コピーを作成中…'); copy(app,stage);
    if(sha(stage+'/Contents/MacOS/eu4')!==journal.live_exec_sha256) fail('コピー中にEU4本体が変更されました。Steamの更新完了後に再実行してください。');
    var e=stage+'/Contents/MacOS/eu4', b=e+'_bak';
    if(uninstall) {
        // A clean Steam-updated executable always wins over an older backup.
        if(injected) { copy(b,e); if(patchLoads(e).length) fail('バックアップ復元の検証失敗'); }
        remove(stage+'/Contents/Frameworks/libeu4dll_mac.dylib');
        remove(stage+'/Contents/Resources/eu4jp-disable-map-names');
        cleanLegacy(stage,removePresentation); remove(b);
    } else {
        if(!injected) {
            if(exists(b) && sha(b)!==sha(e)) log('EU4本体が更新/置換されています。クリーンな本体でバックアップを更新し、eu4dll_macを再適用します。');
            copy(e,b); if(sha(e)!==sha(b)) fail('バックアップ作成・SHA256検証失敗');
        }
        mapSafetyPreflight(b);
        cleanLegacy(stage,false); mkdir(stage+'/Contents/Frameworks');mkdir(stage+'/Contents/Resources');
        var mapFlag=stage+'/Contents/Resources/eu4jp-disable-map-names';noLink(mapFlag);remove(mapFlag);
        if(patch.mapNamesDisabled)write(mapFlag,'1\n');
        log('地図の国名表示: '+(patch.mapNamesDisabled?'停止（診断モード）':'有効'));
        copy(patch.dir+'/libeu4dll_mac.dylib',stage+'/Contents/Frameworks/libeu4dll_mac.dylib');
        requireX86(stage+'/Contents/Frameworks/libeu4dll_mac.dylib');
        if(sha(patch.dir+'/libeu4dll_mac.dylib')!==sha(stage+'/Contents/Frameworks/libeu4dll_mac.dylib')) fail('dylibコピーのSHA256検証失敗');
        // Always start from the clean backup: avoids duplicate/old-path load commands.
        copy(b,e);
        var r=task(patch.dir+'/insert_dylib',['--inplace','--all-yes',LOAD_PATH,e],true);
        log('insert_dylib status='+r.status+'\n'+r.text.trim());
        if(r.status!==0) fail('insert_dylibに失敗しました');
        verifyInjected(e); requireX86(e);
    }
    var preservedRuntime=preserveRuntimeFiles(stage);
    sign(stage);
    if(uninstall) { if(patchLoads(e).length) fail('アンインストール後も注入が残っています'); return null; }
    verifyInjected(e); requireX86(stage+'/Contents/Frameworks/libeu4dll_mac.dylib');
    if(patchLoads(b).length || gameVersion(b)!==v) fail('署名後のバックアップ検証失敗');
    return {preserved_runtime_files:preservedRuntime,map_names_disabled:patch.mapNamesDisabled===true,map_safety:1,japanese:patch.japanese,tag:patch.tag,published:patch.published,url:patch.url,asset_sha256:patch.sha256,backup_sha256:sha(b),game_version:v};
}
function journalSave() { save(root+'/pending.json',journal); }
function begin(app,files,appChange) {
    ensureStopped(); noLink(parent(app)); noLink(modDir);
    var txn;
    if(!fm.isWritableFileAtPath(ns(parent(app)))) fail('Steamゲームフォルダへの書き込み権限がありません。所有者のアカウントで実行してください。sudo/chmodによる自動変更は行いません。');
    txn=cmd('/usr/bin/mktemp',['-d',parent(app)+'/.eu4-japanese-mac-transaction.XXXXXXXX']).trim(); noLink(txn);
    journal={format:1,app:app,txn:txn,modDir:modDir,appChange:appChange,phase:'preparing',files:[],oldState:clone(state)};
    journalSave(); mkdir(txn+'/oldmods'); mkdir(txn+'/newmods'); mkdir(modDir);
    files.forEach(function(f){
        noLink(modDir+'/'+f);
        var had=exists(modDir+'/'+f); if(had) copy(modDir+'/'+f,txn+'/oldmods/'+f);
        journal.files.push({name:f,had:had});
    });
    journalSave();
}
function validJournal(j) {
    if(!j||j.format!==1||typeof j.app!=='string'||j.app[0]!=='/'||j.app.slice(-8)!=='/eu4.app'||(typeof j.txn!=='string'||j.txn.slice(0,-8)!==parent(j.app)+'/.eu4-japanese-mac-transaction.'||!/[A-Za-z0-9]{8}$/.test(j.txn))||(typeof j.modDir!=='string'||canonical(j.modDir)!==canonical(modDir))||!Array.isArray(j.files)||!j.oldState||!j.oldState.apps||!j.oldState.mods||['preparing','switching','committed'].indexOf(j.phase)<0) fail('復旧記録が不正です。自動操作を停止しました: '+root+'/pending.json');
    noLink(j.txn); noLink(j.app); noLink(j.modDir);
    j.files.forEach(function(f){if(!/^(?:jpmod_ap[012]_mod|eu4jp_mac_supplement)\.(mod|zip)$/.test(f.name)||typeof f.had!=='boolean') fail('復旧ファイル名が不正');});
}
function cleanupJournal() {
    var t=journal.txn;
    // Remove the pending pointer only after the rollback/commit record is durable.
    remove(t); remove(root+'/pending.json'); journal=null;
}
function rollback() {
    validJournal(journal);
    if(journal.phase==='committed') { cleanupJournal(); return; }
    safeLog('ロールバック: '+journal.phase);
    if(journal.phase==='switching') {
        if(exists(journal.txn+'/original.app')) {
            if(exists(journal.app)) {
                if(exists(journal.txn+'/failed.app')) remove(journal.txn+'/failed.app');
                move(journal.app,journal.txn+'/failed.app');
            }
            move(journal.txn+'/original.app',journal.app);
            safeLog('実行前のEU4 appを署名・eu4_bak・dylibごと復元しました。');
        }
        journal.files.forEach(function(f){
            var dst=modDir+'/'+f.name, tmp=dst+'.eu4jp-new';
            noLink(dst); noLink(tmp); remove(tmp);
            if(f.had) {
                if(!exists(journal.txn+'/oldmods/'+f.name)) fail('MOD復旧元がありません: '+f.name);
                atomicCopy(journal.txn+'/oldmods/'+f.name,dst);
            } else remove(dst);
        });
        save(root+'/state.json',journal.oldState); state=clone(journal.oldState);
    }
    // A durable rollback-completed phase prevents replay after cleanup is interrupted.
    journal.phase='committed'; journalSave(); cleanupJournal(); safeLog('ロールバック完了。');
}
function recover() {
    if(!exists(root+'/pending.json')) return;
    journal=json(root+'/pending.json'); validJournal(journal); ensureStopped();
    safeLog('中断された処理を検出。前回の復旧記録を処理します。');
    rollback();
}
function commit(newState,prepared,removed,appChange) {
    ensureStopped();
    // Before replacing anything, save every new MOD in the persistent journal folder.
    prepared.forEach(function(p){
        ['.mod','.zip'].forEach(function(ext){copy(p.dir+'/'+p.mod.id+ext,journal.txn+'/newmods/'+p.mod.id+ext);});
    });
    if(appChange && sha(journal.app+'/Contents/MacOS/eu4')!==journal.live_exec_sha256) fail('処理中にEU4本体が更新されました。Steamの更新完了後に再実行してください。');
    journal.phase='switching'; journalSave();
    if(appChange) {
        move(journal.app,journal.txn+'/original.app');
        move(journal.txn+'/stage.app',journal.app);
        verifySign(journal.app);
        if(newState.apps[journal.app]) {verifyInjected(journal.app+'/Contents/MacOS/eu4');requireX86(journal.app+'/Contents/Frameworks/libeu4dll_mac.dylib');}
        else if(patchLoads(journal.app+'/Contents/MacOS/eu4').length || exists(journal.app+'/Contents/Frameworks/libeu4dll_mac.dylib')) fail('交換後のアンインストール検証失敗');
    }
    prepared.forEach(function(p){
        ['.mod','.zip'].forEach(function(ext){atomicCopy(journal.txn+'/newmods/'+p.mod.id+ext,modDir+'/'+p.mod.id+ext);});
        if(sha(modDir+'/'+p.mod.id+'.mod')!==p.receipt.mod_sha256 || sha(modDir+'/'+p.mod.id+'.zip')!==p.receipt.zip_sha256) fail('MOD配置後のSHA256検証失敗');
        log(p.mod.name+': 配置・SHA256検証済み');
    });
    removed.forEach(function(m){
        ['.mod','.zip'].forEach(function(ext){noLink(modDir+'/'+m.id+ext);remove(modDir+'/'+m.id+ext);});
        log(m.name+': 削除済み');
    });
    save(root+'/state.json',newState); state=newState;
    journal.phase='committed'; journalSave();
    // Cleanup failure after the commit must not report a rollback or undo success.
    try { cleanupJournal(); } catch(e) { safeLog('インストールは完了。作業フォルダの後片付けを次回実行時に再試行します: '+e.message); journal=null; }
}
function transact(app,patch,prepared,removed,uninstall,removePresentation) {
    var appChange=!!patch||uninstall, files=[];
    prepared.map(function(p){return p.mod;}).concat(removed).forEach(function(m){files.push(m.id+'.mod',m.id+'.zip');});
    begin(app,files,appChange);
    var next=clone(state);
    try {
        if(appChange) {
            var receipt=prepareApp(app,patch,uninstall,removePresentation);
            if(receipt) next.apps[app]=receipt; else delete next.apps[app];
        }
        prepared.forEach(function(p){next.mods[p.mod.id]=p.receipt;});
        removed.forEach(function(m){delete next.mods[m.id];});
        commit(next,prepared,removed,appChange);
    } catch(e) {
        safeLog('ERROR: '+e.message);
        if(journal) try { rollback(); } catch(r) { safeLog('復旧を完了できませんでした。記録を保持しました。次回再実行: '+r.message); }
        throw e;
    }
}
function diagnostic(app) {
    log('=== 診断（EU4・MODは変更しません） ===');
    log('Mac CPU: '+hostCPU()+' / 実行環境 uname: '+cmd('/usr/bin/uname',['-m']).trim());
    log('macOS: '+cmd('/usr/bin/sw_vers',['-productVersion']).trim());
    log('Rosetta 2: '+(hostCPU()==='arm64'?(rosetta()?'available（x86_64プロセス実行確認）':'unavailable'):'不要（Intel）'));
    log('SIP: '+task('/usr/bin/csrutil',['status'],true).text.trim()+' （有効のまま使用）');
    log('EU4 path: '+app); log('Paradox mod directory: '+modDir);
    if(exists(root+'/pending.json')) log('⚠️ 中断処理あり: '+root+'/pending.json（インストール/アンインストール再実行で復旧）');
    var e=app+'/Contents/MacOS/eu4', d=app+'/Contents/Frameworks/libeu4dll_mac.dylib';
    if(exists(e)) {
        try { var v=gameVersion(e);log((supported(v)?'✅ ':'❌ ')+'EU4 version: '+v); } catch(err) {log('❌ '+err.message);}
        log('EU4 architecture: '+arch(e).text.trim()); log('EU4 file: '+task('/usr/bin/file',[e],true).text.trim());
        try {
            var l=patchLoads(e);log('Injected LC_LOAD_DYLIB: '+JSON.stringify(l));
            if(l.length===1&&l[0].name===LOAD_PATH&&l[0].type==='LC_LOAD_DYLIB') log('✅ LC_LOAD_DYLIB: verified');
            else log('❌ LC_LOAD_DYLIB: 未注入または不正');
        } catch(err2) {log('❌ '+err2.message);}
        log('eu4_bak: '+(exists(e+'_bak')?'あり':'なし'));
        try {checkBackup(app,gameVersion(e));log('バックアップ整合性: OK（未導入時は未作成）');} catch(err3) {log('❌ '+err3.message);}
        var c=task('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app],true); log('codesign verify result: '+c.status+'\n'+c.text.trim());
    } else log('❌ EU4 executable: 見つかりません');
    log('eu4dll_mac: '+(exists(d)?'installed':'not installed'));
    log('国名描画の安全化: '+(mapSafetyMarker(d)?'installed (v1)':'not installed'));
    log('地図の国名表示: '+(exists(app+'/Contents/Resources/eu4jp-disable-map-names')?'停止（診断モード）':'有効'));
    log('常用漢字拡張 dylib: '+(japaneseMarker(d)?'installed (𠮟対応)':'not installed'));
    var jpState=state.mods[SUPPLEMENT.id],jpZip=modDir+'/'+SUPPLEMENT.id+'.zip',jpMod=modDir+'/'+SUPPLEMENT.id+'.mod';
    var jpFontOK=jpState&&jpState.character_support&&Array.isArray(jpState.font_files)&&jpState.font_files.length>0&&exists(jpZip)&&exists(jpMod)&&sha(jpZip)===jpState.zip_sha256&&sha(jpMod)===jpState.mod_sha256;
    log('常用漢字フォント補完: '+(jpFontOK?'installed / '+jpState.font_files.length+'書体':'not installed / 未検証'));
    if(exists(d)) log('dylib architecture: '+arch(d).text.trim()+'\n'+task('/usr/bin/file',[d],true).text.trim());
    MODS.concat([SUPPLEMENT]).forEach(function(m){
        var f=modDir+'/'+m.id+'.mod', z=modDir+'/'+m.id+'.zip';
        if(exists(f)&&exists(z)) try {
            descriptor(read(f),m);var old=state.mods[m.id];
            if(old && (sha(f)!==old.mod_sha256||sha(z)!==old.zip_sha256)) fail('記録のSHA256と不一致');
            if(m.id===SUPPLEMENT.id && old) {
                var main2Path=modDir+'/'+MODS[1].id+'.zip';
                if(!exists(main2Path)||sha(main2Path)!==old.source_main2_sha256) fail('Main 2が変更されています。メニュー7で補訳MODを再生成してください');
                log('補訳適用キー数: '+old.applied_keys.length+' / UI文言: '+(old.ui_field_count||0)+' / 上流優先スキップ: '+old.skipped_keys.length);
                if(old.source_main1_sha256 && sha(modDir+'/'+MODS[0].id+'.zip')!==old.source_main1_sha256)fail('Main 1が変更されています。メニュー7で再生成してください');
                (old.ui_sources||[]).forEach(function(g){if(g.source==='game'&&(!exists(parent(app)+'/'+g.file)||sha(parent(app)+'/'+g.file)!==g.sha256))fail('ゲームUIが変更されています。メニュー7で再生成してください: '+g.file);});
            }
            log('✅ '+m.name+': installed'+(old?' / release '+old.tag:'（本インストーラ管理外・ハッシュ記録なし）'));
        } catch(err) {log('❌ '+m.name+': '+err.message);}
        else log((m===MODS[2]?'ℹ️ ':'❌ ')+m.name+': '+(exists(f)||exists(z)?'incomplete':'not installed'));
    });
    log('言語はEnglish。LauncherのplaysetでMain 1・Main 2・JPMOD Mac: Translation Supplementを有効化してください。');
    log('LC_LOAD_DYLIBの存在と、ゲーム実行中のロード/全フックの成功は別です。表示・セーブ・併合はREADMEの実機テストを実施してください。');
}
function acquireLock() {
    var p=root+'/lock', r=task('/bin/mkdir',[p],true);
    if(r.status!==0) {
        noLink(p);
        var old=exists(p+'/pid')?read(p+'/pid').trim():'';
        if(!/^\d+$/.test(old)) fail('ロックの所有者を確認できません。別の実行がないことを確認してください: '+p);
        if(task('/bin/kill',['-0',old],true).status===0) fail('別のインストーラが実行中です（PID '+old+'）');
        remove(p); cmd('/bin/mkdir',[p]);
    }
    lockHeld=true; write(p+'/pid',String($.NSProcessInfo.processInfo.processIdentifier));
}
function options(args) {
    var opt={action:'menu',app:null,presentation:false};
    var actions={'--install':'install','--diagnose':'diagnose','--uninstall-patch':'uninstall-patch','--uninstall-all':'uninstall-all','--add-sub1':'add-sub1','--remove-sub1':'remove-sub1','--supplement-only':'supplement-only','--remove-supplement':'remove-supplement','--install-no-map-names':'install-no-map-names','--install-map-names':'install-map-names','--check-updates':'check-updates','--help':'help'};
    args.forEach(function(a,i){
        if(i>0&&args[i-1]==='--app') return;
        if(a==='--app') {if(!args[i+1]||args[i+1][0]!=='/') fail('--appには絶対パスを指定してください');opt.app=args[i+1];}
        else if(a==='--restore-legacy-presentation') opt.presentation=true;
        else if(actions[a]) {if(opt.action!=='menu') fail('操作オプションは1つだけ指定してください');opt.action=actions[a];}
        else fail('不明な引数: '+a);
    });
    return opt;
}
function run(args) {
    var opt=options(args);
    if(opt.action==='help') return 'EU4 Japanese for Mac '+INSTALLER_VERSION+'\n--install | --diagnose | --uninstall-patch | --uninstall-all | --add-sub1 | --remove-sub1 | --supplement-only | --remove-supplement\n--install-no-map-names | --install-map-names | --check-updates\n--app /absolute/path/eu4.app\n--restore-legacy-presentation: 明示指定時のみ旧LSUIPresentationMode=4を削除';
    fm=$.NSFileManager.defaultManager; home=userHome();
    root=home+'/Library/Application Support/EU4-Japanese-Mac';
    modDir=canonical(home+'/Documents/Paradox Interactive/Europa Universalis IV/mod');
    noLink(root); mkdir(root);
    var logs=home+'/Library/Logs/EU4-Japanese-Mac'; noLink(logs); mkdir(logs);
    logPath=logs+'/install.log'; noLink(logPath); if(!exists(logPath)) write(logPath,'');
    log('=== EU4 Japanese for Mac '+INSTALLER_VERSION+' '+new Date().toISOString()+' ===');
    log('macOS: '+cmd('/usr/bin/sw_vers',['-productVersion']).trim()+' / CPU: '+hostCPU());
    if(task('/usr/bin/xcode-select',['-p'],true).status!==0) fail('Apple Command Line Toolsが必要です。ターミナルで xcode-select --install を実行し、導入完了後に再実行してください。');
    try {
        acquireLock();
        state=exists(root+'/state.json')?json(root+'/state.json'):{format:1,apps:{},mods:{}};
        if(state.format!==1||!state.apps||!state.mods) fail('管理状態ファイルが不正です: '+root+'/state.json');

        if(opt.action==='menu') {
            out('1. 日本語化をインストール / 更新（Main 1 + Main 2 + 補訳）\n2. 日本語化をアンインストール\n3. 診断のみ\n4. 終了\n5. Sub 1を追加 / 更新（実績非対応・標準構成も更新）\n6. Sub 1を削除\n7. 補訳・日本語フォント補完の更新（本体を変更しない）\n8. 補訳・日本語フォント補完を削除\n9. 地図の国名を非表示にして更新（クラッシュ切り分け）\n10. 地図の国名表示を戻して更新\n11. 更新候補を確認（自動適用しません）');
            var choice=ask('番号を入力してEnter:').trim();
            var map={'1':'install','2':'uninstall-menu','3':'diagnose','4':'quit','5':'add-sub1','6':'remove-sub1','7':'supplement-only','8':'remove-supplement','9':'install-no-map-names','10':'install-map-names','11':'check-updates'};
            opt.action=map[choice]||fail('1〜11を選択してください');
        }
        if(opt.action==='install-no-map-names'){opt.mapNamesDisabled=true;opt.action='install';}
        if(opt.action==='install-map-names'){opt.mapNamesDisabled=false;opt.action='install';}
        if(opt.action==='quit') return '終了しました。';
        if(opt.action==='check-updates'){scratch=cmd('/usr/bin/mktemp',['-d',root+'/download.XXXXXXXX']).trim();checkUpdates();return '更新確認ログ: '+logPath;}
        if(opt.action!=='diagnose') recover();
        var app;
        if(opt.action==='diagnose'&&!opt.app&&exists(root+'/pending.json')) app=json(root+'/pending.json').app;
        else app=findApp(opt.app);
        if(app.slice(-8)!=='/eu4.app') fail('eu4.appを指定してください: '+app);
        if(opt.action==='diagnose') {diagnostic(app);return '診断ログ: '+logPath;}
        write(root+'/last-app.txt',app+'\n'); ensureStopped();
        if(!exists(app+'/Contents/MacOS/eu4')) fail('EU4が見つかりません: '+app);
        var removed=[],uninstall=false;
        if(opt.action==='uninstall-menu') {
            var u=ask('1. eu4dll_macのみ削除\n2. eu4dll_macとMain 1・Main 2・Sub 1・補訳MODを削除\n3. eu4dll_macと選択したMODを削除\n番号:').trim();
            if(['1','2','3'].indexOf(u)<0) fail('アンインストールを中止しました');
            uninstall=true;
            if(u==='2') removed=MODS.concat([SUPPLEMENT]);
            if(u==='3') MODS.concat([SUPPLEMENT]).forEach(function(m){if(ask(m.name+'を削除しますか? [y/N]').trim().toLowerCase()==='y') removed.push(m);});
        } else if(opt.action==='uninstall-all') {uninstall=true;removed=MODS.concat([SUPPLEMENT]);}
        else if(opt.action==='uninstall-patch') uninstall=true;
        else if(opt.action==='remove-sub1') removed=[MODS[2]];
        else if(opt.action==='remove-supplement') removed=[SUPPLEMENT];
        if(removed.some(function(m){return m.id===MODS[1].id;}) && !removed.some(function(m){return m.id===SUPPLEMENT.id;})) removed.push(SUPPLEMENT);
        if(opt.presentation && !uninstall) fail('--restore-legacy-presentationはアンインストール専用です');
        scratch=cmd('/usr/bin/mktemp',['-d',root+'/download.XXXXXXXX']).trim();
        if(uninstall||opt.action==='remove-sub1'||opt.action==='remove-supplement') {
            transact(app,null,[],removed,uninstall,opt.presentation);
            log('✅ アンインストール完了。Launcherのplaysetから削除したMODを外してください。セーブには触れていません。');
        } else if(opt.action==='supplement-only') {
            validateGame(app,true);
            MODS.slice(0,2).forEach(function(m){
                if(!exists(modDir+'/'+m.id+'.mod')||!exists(modDir+'/'+m.id+'.zip')) fail('Main 1とMain 2が必要です。先にメニュー1で導入してください。');
                if(!pinnedModPresent(m))fail('Main 1・Main 2が承認済みSHA256と一致しません。メニュー1で更新してください。');
                descriptor(read(modDir+'/'+m.id+'.mod'),m);
            });
            var supplement=prepareSupplement(modDir+'/'+MODS[1].id+'.zip',modDir+'/'+MODS[0].id+'.zip',parent(app),japaneseMarker(app+'/Contents/Frameworks/libeu4dll_mac.dylib'));
            transact(app,null,[supplement],[],false,false);
            if(!supplement.receipt.character_support)log('常用漢字の全字対応にはメニュー1で日本語拡張を導入してください。');
            log('✅ 補訳MODを配置しました。LauncherでJPMOD Mac: Translation SupplementをMain 2とともに有効化してください。');
        } else {
            validateGame(app,true); checkBackup(app,gameVersion(app+'/Contents/MacOS/eu4'));
            // Fetch and validate everything before starting any live modification.
            var patch=preparePatch();
            patch.mapNamesDisabled=typeof opt.mapNamesDisabled==='boolean'?opt.mapNamesDisabled:!!(state.apps[app]&&state.apps[app].map_names_disabled);
            var wanted=MODS.slice(0,opt.action==='add-sub1'?3:2), prepared=[];
            // Preserve and update Sub 1 only if it was explicitly installed earlier.
            if(opt.action==='install'&&state.mods[MODS[2].id]) wanted.push(MODS[2]);
            wanted.forEach(function(m){var p=prepareMod(m);if(p) prepared.push(p);});
            var main2=prepared.filter(function(p){return p.mod.id===MODS[1].id;});
            var main1=prepared.filter(function(p){return p.mod.id===MODS[0].id;});
            prepared.push(prepareSupplement(main2.length?main2[0].dir+'/'+MODS[1].id+'.zip':modDir+'/'+MODS[1].id+'.zip',main1.length?main1[0].dir+'/'+MODS[0].id+'.zip':modDir+'/'+MODS[0].id+'.zip',parent(app),true));
            transact(app,patch,prepared,[],false,false);
            log('✅ インストール / 更新完了。\nSteamから通常どおり起動し、Paradox LauncherのplaysetでJPMOD Main 1・Main 2・JPMOD Mac: Translation Supplementを有効化してください。\nゲーム・Launcherの言語はEnglishのまま使用します。\nSub 1は任意・実績非対応です。表示/セーブの実機確認はREADMEを参照してください。');
        }
        return 'ログ: '+logPath;
    } catch(e) {
        safeLog('ERROR: '+e.message);
        // begin() itself can fail while preparing; no live modification has occurred.
        if(journal) try {rollback();} catch(r) {safeLog('復旧記録を保持: '+r.message);}
        throw e;
    } finally {
        if(scratch && exists(scratch)) try {remove(scratch);} catch(cleanErr) {out('ダウンロード一時領域を保持: '+scratch);}
        if(lockHeld) {remove(root+'/lock');lockHeld=false;}
    }
}
