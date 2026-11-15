#pragma once
#include <cstdint>
#include <cstddef>
#include <cstring>
#include <string>
#include <cctype>

// EU4dll b5 escape format. These limits apply to transient map-label copies.
namespace eu4jpMap {
constexpr size_t maxBytes = 8192;
constexpr size_t maxSourceGlyphs = 256;
constexpr size_t maxVisibleGlyphs = 256;
constexpr uint32_t maxSlot = 0xffff + 1712;
struct Token { uint32_t slot; size_t bytes; };
inline bool next(const std::string& s, size_t i, Token& t) {
    if (i >= s.size()) return false;
    uint32_t c = (unsigned char)s[i];
    t = {c, 1};
    if (!c) return false;
    if (c < 0x10 || c > 0x13) return true;
    if (s.size() - i < 3) return false;
    uint32_t lo = (unsigned char)s[i+1], hi = (unsigned char)s[i+2];
    if (!lo || !hi) return false;
    uint32_t cp = lo | (hi << 8);
    if (c == 0x11) { if (lo < 14) return false; cp -= 14; }
    if (c == 0x12) cp += 0x900;
    if (c == 0x13) { if (lo < 14) return false; cp += 0x8f2; }
    if (cp < 256 || cp > 0xffff || (cp >= 0xd800 && cp <= 0xdfff)) return false;
    t = {cp + 1712, 3};
    return t.slot <= maxSlot;
}
inline bool valid(const std::string& s, size_t limit) {
    if (s.empty() || s.size() > maxBytes) return false;
    size_t count = 0;
    for (size_t i = 0; i < s.size();) {
        Token t{};
        if (!next(s,i,t) || ++count > limit) return false;
        i += t.bytes;
    }
    return true;
}
inline void uppercase(std::string& s) {
    // A nonempty replacement is required: the original tail reads size()-1.
    if (!valid(s,maxSourceGlyphs)) { s.assign(1,'?'); return; }
    for (size_t i=0; i<s.size();) {
        Token t{}; next(s,i,t);
        if (t.bytes==1) s[i]=(char)std::toupper((unsigned char)s[i]);
        i+=t.bytes;
    }
}
inline size_t capacity(std::string& s, const void* font) {
    if (!font) { s.assign(1,'?'); return 1; }
    auto count = [&](const std::string& text, size_t& n) {
        n=0;
        if (!valid(text,maxBytes)) return false;
        for (size_t i=0;i<text.size();) {
            Token t{}; if (!next(text,i,t)) return false;
            const unsigned char* glyph=nullptr;
            std::memcpy(&glyph,(const unsigned char*)font+0xe8+8*t.slot,sizeof(glyph));
            if (glyph) {
                int16_t width=0;std::memcpy(&width,glyph+6,sizeof(width));
                if(width>0 && ++n>maxVisibleGlyphs) return false;
            }
            i+=t.bytes;
        }
        return true;
    };
    size_t n=0;
    if (!count(s,n)) { s.assign(1,'?'); n=1; }
    // Match FillVertexBuffer's +6 signed width test; reserve one slot for empty output.
    return n ? n : 1;
}
}
