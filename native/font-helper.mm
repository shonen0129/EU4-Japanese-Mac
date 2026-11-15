// MIT License — EU4 Japanese for Mac. Builds glyphs locally from macOS fonts.
#import <Foundation/Foundation.h>
#include <CoreText/CoreText.h>
#include <CoreGraphics/CoreGraphics.h>
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iostream>
#include <map>
#include <regex>
#include <set>
#include <sstream>
#include <stdexcept>
#include <vector>
static void need(bool ok,const std::string &s){if(!ok)throw std::runtime_error(s);}
static std::string readFile(const std::string&p){std::ifstream f(p,std::ios::binary);need(bool(f),"Cannot read "+p);return {std::istreambuf_iterator<char>(f),{}};}
static void writeFile(const std::string&p,const std::string&s){std::ofstream f(p,std::ios::binary);f.write(s.data(),s.size());need(bool(f),"Cannot write "+p);}
static uint32_t u32(const std::string&s,size_t i){need(i+4<=s.size(),"Short DDS");uint32_t v;memcpy(&v,s.data()+i,4);return v;}
static void set32(std::string&s,size_t i,uint32_t v){memcpy(&s[i],&v,4);}
static int value(const std::string&s,const std::string&k){std::smatch m;need(std::regex_search(s,m,std::regex("(?:^|[ \\t])"+k+"=(-?[0-9]+)")),"Missing font field "+k);return std::stoi(m[1]);}
static std::string utf8(uint32_t cp){NSString*s;if(cp<=65535){unichar c=cp;s=[NSString stringWithCharacters:&c length:1];}else{unichar c[2]={(unichar)(0xD800+((cp-0x10000)>>10)),(unichar)(0xDC00+((cp-0x10000)&1023))};s=[NSString stringWithCharacters:c length:2];}return [s UTF8String];}
struct Glyph{int w,h,xoffset,yoffset,advance;std::vector<uint8_t> rgba;std::string face;};
static Glyph raster(uint32_t cp,int size,int base,bool serif,bool bold){
    NSString*text=[NSString stringWithUTF8String:utf8(cp).c_str()];
    CFStringRef name=serif?(bold?CFSTR("HiraginoMinchoProN-W6"):CFSTR("HiraginoMinchoProN-W3")):(bold?CFSTR("HiraginoSans-W6"):CFSTR("HiraginoSans-W3"));
    CTFontRef font=CTFontCreateWithName(name,size,nullptr);
    NSDictionary *attrs=@{(__bridge NSString*)kCTFontAttributeName:(__bridge id)font,(__bridge NSString*)kCTForegroundColorFromContextAttributeName:@YES};
    NSAttributedString *s=[[NSAttributedString alloc]initWithString:text attributes:attrs];
    CTLineRef line=CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)s);
    CFArrayRef runs=CTLineGetGlyphRuns(line);size_t count=0;std::string face;
    for(CFIndex i=0;i<CFArrayGetCount(runs);i++){
        CTRunRef run=(CTRunRef)CFArrayGetValueAtIndex(runs,i);CFIndex n=CTRunGetGlyphCount(run);std::vector<CGGlyph> gs(n);CTRunGetGlyphs(run,CFRangeMake(0,0),gs.data());
        for(auto g:gs)need(g!=0,"Missing system glyph U+"+std::to_string(cp));count+=n;
        CTFontRef actual=(CTFontRef)CFDictionaryGetValue(CTRunGetAttributes(run),kCTFontAttributeName);CFStringRef ps=CTFontCopyPostScriptName(actual);face=[(__bridge NSString*)ps UTF8String];CFRelease(ps);need(face.find("LastResort")==std::string::npos,"System has no real Japanese glyph");
    }
    need(count>0,"No glyphs");
    CGRect bounds=CTLineGetImageBounds(line,nullptr);double width=CTLineGetTypographicBounds(line,nullptr,nullptr,nullptr);
    int x0=(int)floor(CGRectGetMinX(bounds))-1,y0=(int)floor(CGRectGetMinY(bounds))-1;
    int w=(int)ceil(CGRectGetMaxX(bounds))-x0+1,h=(int)ceil(CGRectGetMaxY(bounds))-y0+1;
    need(w>0&&h>0&&w<256&&h<256,"Unexpected glyph dimensions");
    Glyph g{w,h,x0,base-(y0+h),(int)llround(width),std::vector<uint8_t>(w*h*4),face};
    CGColorSpaceRef rgb=CGColorSpaceCreateDeviceRGB();CGContextRef ctx=CGBitmapContextCreate(g.rgba.data(),w,h,8,w*4,rgb,kCGImageAlphaPremultipliedLast|kCGBitmapByteOrder32Big);CGColorSpaceRelease(rgb);need(ctx,"No bitmap context");
    CGContextSetShouldAntialias(ctx,true);CGContextSetShouldSmoothFonts(ctx,false);CGContextSetRGBFillColor(ctx,1,1,1,1);CGContextSetTextPosition(ctx,-x0,-y0);CTLineDraw(line,ctx);
    CGContextRelease(ctx);CFRelease(line);CFRelease(font);
    need(std::any_of(g.rgba.begin(),g.rgba.end(),[](uint8_t b){return b!=0;}),"Empty glyph raster");return g;
}
int main(int argc,char**argv){@autoreleasepool{try{
    need(argc==5,"Usage: font-helper source.fnt source.dds output-basename scope.txt");
    std::string fnt=readFile(argv[1]),dds=readFile(argv[2]),scope=readFile(argv[4]);
    need(dds.size()>=128&&dds.substr(0,4)=="DDS "&&u32(dds,4)==124,"Invalid DDS");
    need(u32(dds,76)==32&&u32(dds,80)==65&&u32(dds,84)==0&&u32(dds,88)==32&&u32(dds,92)==0xFF0000&&u32(dds,96)==0xFF00&&u32(dds,100)==0xFF&&u32(dds,104)==0xFF000000,"Unsupported DDS pixel format");
    uint32_t w=u32(dds,16),h=u32(dds,12);need(w>=64&&w<=4096&&h>=64&&h<=4096&&u32(dds,20)==w*4,"Invalid DDS dimensions");need(dds.size()>=128+(size_t)w*h*4,"Incomplete DDS pixels");
    std::string info,common,line,reference;std::istringstream lines(fnt);std::set<int> ids;
    while(std::getline(lines,line)){if(line.rfind("info ",0)==0)info=line;else if(line.rfind("common ",0)==0)common=line;else if(line.rfind("char ",0)==0){int id=value(line,"id");need(ids.insert(id).second||id==0xFF5E,"Duplicate font glyph");if(id==0x65E5)reference=line;}}
    need(!info.empty()&&!common.empty()&&value(common,"scaleW")==int(w)&&value(common,"scaleH")==int(h)&&value(common,"pages")==1,"Font/DDS mismatch");
    need(!ids.count(0xE000),"Reserved U+E000 is already used by Main 1; stop safely");
    NSString*characters=[NSString stringWithUTF8String:scope.c_str()];need(characters,"Invalid scope UTF-8");
    std::set<uint32_t> required;
    for(NSUInteger i=0;i<characters.length;i++){uint32_t c=[characters characterAtIndex:i];if(c>=0xD800&&c<=0xDBFF){need(i+1<characters.length,"Bad surrogate");uint32_t lo=[characters characterAtIndex:++i];need(lo>=0xDC00&&lo<=0xDFFF,"Bad surrogate");c=0x10000+((c-0xD800)<<10)+(lo-0xDC00);}required.insert(c);}
    bool serif=info.find("Serif")!=std::string::npos,bold=value(info,"bold")!=0||info.find("Bold")!=std::string::npos;int size=value(reference,"xadvance"),base=value(common,"base");need(size>=8&&size<=100,"Unsupported font size");
    // The upstream 'size' is a nominal point size. Match actual Japanese advance
    // and the reference glyph's placement instead of enlarging new characters.
    Glyph ref=raster(0x65E5,size,base,serif,bold);int shiftX=value(reference,"xoffset")-ref.xoffset,shiftY=value(reference,"yoffset")-ref.yoffset;
    struct Add{uint32_t cp,id;Glyph g;int x,y;};std::vector<Add> adds;int x=1,y=h+1,row=0;
    for(uint32_t cp:required){uint32_t id=cp==0x20B9F?0xE000:cp;need(id<=65535,"Unsupported scope scalar");if(ids.count(id))continue;Glyph g=raster(cp,size,base,serif,bold);g.xoffset+=shiftX;g.yoffset+=shiftY;if(x+g.w+1>int(w)){x=1;y+=row+1;row=0;}adds.push_back({cp,id,std::move(g),x,y});x+=adds.back().g.w+1;row=std::max(row,adds.back().g.h);}
    need(!adds.empty(),"No extension glyphs generated");uint32_t nh=(y+row+4)&~3U;need(nh<=4096&&(size_t)w*nh*4<64*1024*1024,"Atlas would exceed supported limits");
    std::string output=dds.substr(0,128+(size_t)w*h*4);output.resize(128+(size_t)w*nh*4,0);set32(output,8,0x100F);set32(output,12,nh);set32(output,28,0);set32(output,108,0x1000);set32(output,112,0);set32(output,116,0);set32(output,120,0);
    // DDS stores straight alpha; CoreGraphics returns premultiplied pixels.
    // Keep transparent padding white as in the original monochrome atlases.
    for(size_t i=128+(size_t)w*h*4;i<output.size();i+=4)output[i]=output[i+1]=output[i+2]=(char)255;
    std::string appended;
    for(const auto&a:adds){
        for(int yy=0;yy<a.g.h;yy++)for(int xx=0;xx<a.g.w;xx++){
            size_t src=(yy*a.g.w+xx)*4,dst=128+((a.y+yy)*w+a.x+xx)*4;
            output[dst]=output[dst+1]=output[dst+2]=(char)255;output[dst+3]=a.g.rgba[src+3];
        }
        appended+="char id="+std::to_string(a.id)+" x="+std::to_string(a.x)+" y="+std::to_string(a.y)+" width="+std::to_string(a.g.w)+" height="+std::to_string(a.g.h)+" xoffset="+std::to_string(a.g.xoffset)+" yoffset="+std::to_string(a.g.yoffset)+" xadvance="+std::to_string(a.g.advance)+" page=0\n";
        std::cout<<"U+"<<std::hex<<a.cp<<" -> "<<a.id<<std::dec<<" "<<a.g.face<<"\n";
    }
    if(u32(dds,28)>1){
        uint32_t mw=w,mh=nh,levels=1;size_t previous=128;
        while(mw>1||mh>1){
            uint32_t nextw=std::max(1U,mw/2),nexth=std::max(1U,mh/2);size_t start=output.size();output.resize(start+(size_t)nextw*nexth*4,0);
            for(uint32_t yy=0;yy<nexth;yy++)for(uint32_t xx=0;xx<nextw;xx++){
                unsigned total=0,n=0;for(unsigned dy=0;dy<2;dy++)for(unsigned dx=0;dx<2;dx++){uint32_t sx=std::min(mw-1,xx*2+dx),sy=std::min(mh-1,yy*2+dy);total+=(uint8_t)output[previous+((size_t)sy*mw+sx)*4+3];n++;}
                size_t at=start+((size_t)yy*nextw+xx)*4;output[at]=output[at+1]=output[at+2]=(char)255;output[at+3]=(char)((total+n/2)/n);
            }
            previous=start;mw=nextw;mh=nexth;levels++;
        }
        set32(output,8,0x2100F);set32(output,28,levels);set32(output,108,0x401008);
    }
    need(output.size()<64*1024*1024,"DDS would exceed the patched texture limit");
    fnt=std::regex_replace(fnt,std::regex("scaleH=[0-9]+"),"scaleH="+std::to_string(nh));if(fnt.back()!='\n')fnt+='\n';fnt+=appended;
    writeFile(std::string(argv[3])+".fnt",fnt);writeFile(std::string(argv[3])+".dds",output);std::cout<<"Added "<<adds.size()<<" glyphs; "<<w<<"x"<<nh<<"\n";
    return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<"\n";return 1;}}}
