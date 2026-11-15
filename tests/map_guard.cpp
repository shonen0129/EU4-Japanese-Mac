#include "mapGuard.h"
#include <cassert>
#include <cstdio>
#include <vector>
#include <random>
#include <array>
static std::string encode(unsigned cp) {
    if(cp>0xffff)cp=0xe000;
    auto esc=[](unsigned b){unsigned a[]={0xa4,0xa3,0xa7,0x24,0x5b,0,0x5c,0x20,13,10,0x22,0x7b,0x7d,0x40,0x80,0x7e,0x2f,0x5f,0xbd,0x3b,0x5d,0x3d,0x23,0x3f,0x3a,0x3c,0x3e,0x2a,0x7c};for(auto x:a)if(x==b)return true;return false;};
    unsigned lo=cp&255,hi=cp>>8,e=16;
    if(esc(hi))e+=2;if(esc(lo))++e;
    if(e==17||e==19)lo+=14;if(e==18||e==19)hi-=9;
    return {(char)e,(char)lo,(char)hi};
}
int main(){
    std::vector<unsigned char> font(0xe8+8*(eu4jpMap::maxSlot+1),0);
    std::array<unsigned char,16> glyph{},empty{};int16_t width=20;
    std::memcpy(glyph.data()+6,&width,2);
    const unsigned char* ptr=glyph.data();
    for(size_t i=0;i<=eu4jpMap::maxSlot;++i)std::memcpy(font.data()+0xe8+i*8,&ptr,8);
    ptr=empty.data();std::memcpy(font.data()+0xe8+32*8,&ptr,8);
    unsigned tests=0,cp=0;
    FILE* f=std::fopen("build/support-codepoints.txt","r");assert(f);
    while(std::fscanf(f,"%x",&cp)==1){
        auto s=encode(cp)+"a",before=s;eu4jpMap::uppercase(s);
        assert(s==encode(cp)+"A");assert(eu4jpMap::capacity(s,font.data())==2);
        auto spaced=encode(cp)+" A";assert(eu4jpMap::capacity(spaced,font.data())==2);++tests;
    }std::fclose(f);assert(tests==2337);
    std::vector<std::string> bad={"",std::string(1,16),std::string({16,17}),std::string({16,0,1}),std::string({17,1,1}),std::string({18,(char)255,(char)255}),std::string({16,1,(char)0xd8}),std::string("a\0b",3),std::string(257,'A'),std::string(9000,'A')};
    for(auto s:bad){eu4jpMap::uppercase(s);assert(s=="?");++tests;}
    for(auto s:bad){auto count=eu4jpMap::capacity(s,font.data());assert(count<=256&&count>=1);assert(eu4jpMap::valid(s,8192));++tests;}
    auto max=encode(0xffff);assert(eu4jpMap::capacity(max,font.data())==1);++tests;
    std::string limit(256,'A');assert(eu4jpMap::capacity(limit,font.data())==256);++tests;
    std::string over(257,'A');assert(eu4jpMap::capacity(over,font.data())==1&&over=="?");++tests;
    std::mt19937 rng(20261115);
    for(unsigned n=0;n<20000;++n){
        std::string s(rng()%64,'x');for(char& c:s)c=(char)rng();
        eu4jpMap::uppercase(s);assert(eu4jpMap::valid(s,256));
        auto capacity=eu4jpMap::capacity(s,font.data());assert(capacity>=1&&capacity<=256);++tests;
    }
    std::printf("PASS: %u checks: all 2337 supported glyphs, malformed/truncated/overflow/surrogate/NUL/length limits, 20000 seeded random inputs.\n",tests);
}
