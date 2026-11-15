#include <CoreFoundation/CoreFoundation.h>
#include <vector>
#include "strConvert.h"
#include "global.h"

namespace strConvert {

    const size_t MAX_OUT = 32768;
    thread_local std::string tempText;

    // @formatter:off
    bool is_escape_byte(uint8_t b) {
        switch (b) {
            case 0xA4: case 0xA3: case 0xA7: case 0x24: case 0x5B:
            case 0x00: case 0x5C: case 0x20: case 0x0D: case 0x0A:
            case 0x22: case 0x7B: case 0x7D: case 0x40: case 0x80:
            case 0x7E: case 0x2F: case 0x5F: case 0xBD: case 0x3B:
            case 0x5D: case 0x3D: case 0x23: case 0x3F: case 0x3A:
            case 0x3C: case 0x3E: case 0x2A: case 0x7C:
                return true;
            default:
                return false;
        }
    }

    char mapSpecialUnicodeToWin1252(uint32_t cp) {
        switch (cp) {
            case 0x20AC: return (char) 0x80;
            case 0x201A: return (char) 0x82;
            case 0x0192: return (char) 0x83;
            case 0x201E: return (char) 0x84;
            case 0x2026: return (char) 0x85;
            case 0x2020: return (char) 0x86;
            case 0x2021: return (char) 0x87;
            case 0x02C6: return (char) 0x88;
            case 0x2030: return (char) 0x89;
            case 0x0160: return (char) 0x8A;
            case 0x2039: return (char) 0x8B;
            case 0x0152: return (char) 0x8C;
            case 0x017D: return (char) 0x8E;
            case 0x2018: return (char) 0x91;
            case 0x2019: return (char) 0x92;
            case 0x201C: return (char) 0x93;
            case 0x201D: return (char) 0x94;
            case 0x2022: return (char) 0x95;
            case 0x2013: return (char) 0x96;
            case 0x2014: return (char) 0x97;
            case 0x02DC: return (char) 0x98;
            case 0x2122: return (char) 0x99;
            case 0x0161: return (char) 0x9A;
            case 0x203A: return (char) 0x9B;
            case 0x0153: return (char) 0x9C;
            case 0x017E: return (char) 0x9E;
            case 0x0178: return (char) 0x9F;
            default:     return '\0';
        }
    }

    uint32_t mapWin1252ToSpecialUnicode(uint8_t c) {
        switch (c) {
            case 0x80: return 0x20AC; // €
            case 0x82: return 0x201A; // ‚
            case 0x83: return 0x0192; // ƒ
            case 0x84: return 0x201E; // „
            case 0x85: return 0x2026; // …
            case 0x86: return 0x2020; // †
            case 0x87: return 0x2021; // ‡
            case 0x88: return 0x02C6; // ˆ
            case 0x89: return 0x2030; // ‰
            case 0x8A: return 0x0160; // Š
            case 0x8B: return 0x2039; // ‹
            case 0x8C: return 0x0152; // Œ
            case 0x8E: return 0x017D; // Ž
            case 0x91: return 0x2018; // ‘
            case 0x92: return 0x2019; // ’
            case 0x93: return 0x201C; // “
            case 0x94: return 0x201D; // ”
            case 0x95: return 0x2022; // •
            case 0x96: return 0x2013; // –
            case 0x97: return 0x2014; // —
            case 0x98: return 0x02DC; // ˜
            case 0x99: return 0x2122; // ™
            case 0x9A: return 0x0161; // š
            case 0x9B: return 0x203A; // ›
            case 0x9C: return 0x0153; // œ
            case 0x9E: return 0x017E; // ž
            case 0x9F: return 0x0178; // Ÿ
            default:   return 0;
        }
    }
    // @formatter:on

    extern "C" __attribute__((used)) const char *eu4jp_character_support() {return "EU4JP_JOYO_V1_ALIAS_E000";}
    // Japanese input extension v1: reserve U+E000 for Joyo U+20B9F (𠮟).
    // Other supplementary characters remain outside the supported repertoire.
    static std::string normaliseNFC(const char *input) {
        CFStringRef raw=CFStringCreateWithBytes(nullptr,(const UInt8*)input,strlen(input),kCFStringEncodingUTF8,false);
        if(!raw)return input;
        CFMutableStringRef text=CFStringCreateMutableCopy(nullptr,0,raw);CFRelease(raw);
        if(!text)return input;
        CFStringNormalize(text,kCFStringNormalizationFormC);
        CFIndex max=CFStringGetMaximumSizeForEncoding(CFStringGetLength(text),kCFStringEncodingUTF8);
        std::vector<char> bytes((size_t)max+1);
        bool ok=CFStringGetCString(text,bytes.data(),bytes.size(),kCFStringEncodingUTF8);CFRelease(text);
        return ok?std::string(bytes.data()):std::string(input);
    }
    static bool nextUTF8(const std::string &s,size_t &i,uint32_t &cp) {
        uint8_t c=(uint8_t)s[i++];if(c<0x80){cp=c;return true;}
        unsigned n;uint32_t min;
        if(c>=0xC2&&c<=0xDF){n=1;cp=c&31;min=0x80;}
        else if(c>=0xE0&&c<=0xEF){n=2;cp=c&15;min=0x800;}
        else if(c>=0xF0&&c<=0xF4){n=3;cp=c&7;min=0x10000;}
        else return false;
        if(i+n>s.size())return false;
        for(unsigned j=0;j<n;j++)if(((uint8_t)s[i+j]&0xC0)!=0x80)return false;
        for(unsigned j=0;j<n;j++)cp=(cp<<6)|((uint8_t)s[i++]&63);
        return cp>=min&&cp<=0x10FFFF&&!(cp>=0xD800&&cp<=0xDFFF);
    }
    static std::string scalarUTF8(uint32_t cp) {
        std::string s;
        if(cp<0x80)s+=(char)cp;
        else if(cp<0x800){s+=(char)(0xC0|(cp>>6));s+=(char)(0x80|(cp&63));}
        else if(cp<0x10000){s+=(char)(0xE0|(cp>>12));s+=(char)(0x80|((cp>>6)&63));s+=(char)(0x80|(cp&63));}
        else{s+=(char)(0xF0|(cp>>18));s+=(char)(0x80|((cp>>12)&63));s+=(char)(0x80|((cp>>6)&63));s+=(char)(0x80|(cp&63));}
        return s;
    }
    static std::string encodeJapanese(const char *input) {
        if(!input)return {};
        std::string s=normaliseNFC(input),out;
        for(size_t i=0;i<s.size();) {
            uint32_t cp;std::string token;
            if(!nextUTF8(s,i,cp))token="?";
            else if(cp==0xE000)token="?"; // Reserved transport slot, never user text.
            else {
                if(cp==0x20B9F)cp=0xE000;
                if(cp>0xFFFF)token="????";
                else {
                    char mapped=mapSpecialUnicodeToWin1252(cp);
                    if(cp<=0xFF&&!(cp>=0x80&&cp<=0x9F))token+=(char)cp;
                    else if(mapped)token+=mapped;
                    else {
                        if(cp>0x100&&cp<0xA00)cp+=0xE000;
                        uint8_t lo=cp&255,hi=cp>>8,esc=ESCAPE_SEQ_1;
                        if(!hi)token+=(char)lo;
                        else {
                            if(is_escape_byte(hi))esc+=2;
                            if(is_escape_byte(lo))esc++;
                            if(esc==ESCAPE_SEQ_2||esc==ESCAPE_SEQ_4)lo+=14;
                            if(esc==ESCAPE_SEQ_3||esc==ESCAPE_SEQ_4)hi-=9;
                            token+=(char)esc;token+=(char)lo;token+=(char)hi;
                        }
                    }
                }
            }
            if(out.size()+token.size()>=MAX_OUT)break;
            out+=token;
        }
        return out;
    }
    static std::string decodeJapanese(const char *input) {
        if(!input)return {};
        size_t len=strlen(input);std::string out;
        for(size_t i=0;i<len;) {
            uint8_t c=(uint8_t)input[i++];uint32_t cp=c;
            if(c>=ESCAPE_SEQ_1&&c<=ESCAPE_SEQ_4) {
                if(len-i<2)break;
                uint8_t lo=(uint8_t)input[i++],hi=(uint8_t)input[i++];
                if(c==ESCAPE_SEQ_2||c==ESCAPE_SEQ_4)lo-=14;
                if(c==ESCAPE_SEQ_3||c==ESCAPE_SEQ_4)hi+=9;
                cp=((uint32_t)hi<<8)|lo;
                if(cp>0xE100&&cp<0xEA00)cp-=0xE000;
                if(cp==0xE000)cp=0x20B9F;
            } else if(c>=0x80&&c<=0x9F) {
                uint32_t mapped=mapWin1252ToSpecialUnicode(c);if(mapped)cp=mapped;
            }
            auto token=scalarUTF8(cp);
            if(out.size()+token.size()>=MAX_OUT)break;
            out+=token;
        }
        return out;
    }
    // The legacy raw-buffer API requires MAX_OUT bytes from its caller.
    // Internal callers use std::string directly and have no guessed allocations.
    void UTF8ToWindows1252(const char *input,char *output) {
        if(!input||!output)return;auto s=encodeJapanese(input);memcpy(output,s.c_str(),s.size()+1);
    }
    void Windows1252ToUTF8(const char *input,char *output) {
        if(!input||!output)return;auto s=decodeJapanese(input);memcpy(output,s.c_str(),s.size()+1);
    }
    std::string *escapedStrToUtf8(std::string *s) {tempText=decodeJapanese(s->c_str());return &tempText;}
    std::string escapedStrToUtf8Val(std::string s) {return decodeJapanese(s.c_str());}
    std::string *utf8ToEscapedStr(std::string *s) {tempText=encodeJapanese(s->c_str());return &tempText;}
    void escapedStrToUtf8Replace(std::string *s) {*s=decodeJapanese(s->c_str());}
    void utf8ToEscapedStrReplace(std::string *s) {*s=encodeJapanese(s->c_str());}
}
