#include "mapGuard.h"
#include <cassert>
#include <cstdio>
#include <array>
#include <vector>
extern "C" {
size_t eu4jp_map_capacity(std::string* s,const void* f){return eu4jpMap::capacity(*s,f);}
uintptr_t g_MapCapacity_RetAddr;
size_t observed_count;unsigned long observed_flags;
alignas(16) unsigned char observed_xmm[256];
alignas(16) unsigned char sentinel[16]={0x11,0x22,0x33,0x44,0x55,0x66,0x77,0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff,0x01};
}
    extern "C" __attribute__((naked)) void eu4jp_map_capacity_hook() {
        __asm__ volatile(
            ".intel_syntax noprefix \n"
            "pushfq \n"
            "push rax \n"
            "push rcx \n"
            "push rdx \n"
            "push rsi \n"
            "push rdi \n"
            "push r8 \n"
            "push r9 \n"
            "push r10 \n"
            "push r11 \n"
            "sub rsp, 256 \n"
            "movdqu [rsp+0], xmm0 \n"
            "movdqu [rsp+16], xmm1 \n"
            "movdqu [rsp+32], xmm2 \n"
            "movdqu [rsp+48], xmm3 \n"
            "movdqu [rsp+64], xmm4 \n"
            "movdqu [rsp+80], xmm5 \n"
            "movdqu [rsp+96], xmm6 \n"
            "movdqu [rsp+112], xmm7 \n"
            "movdqu [rsp+128], xmm8 \n"
            "movdqu [rsp+144], xmm9 \n"
            "movdqu [rsp+160], xmm10 \n"
            "movdqu [rsp+176], xmm11 \n"
            "movdqu [rsp+192], xmm12 \n"
            "movdqu [rsp+208], xmm13 \n"
            "movdqu [rsp+224], xmm14 \n"
            "movdqu [rsp+240], xmm15 \n"
            "lea rdi, [rbp-0xF0] \n"
            "mov rsi, r14 \n"
            "call _eu4jp_map_capacity \n"
            "mov r13, rax \n"
            "movdqu xmm0, [rsp+0] \n"
            "movdqu xmm1, [rsp+16] \n"
            "movdqu xmm2, [rsp+32] \n"
            "movdqu xmm3, [rsp+48] \n"
            "movdqu xmm4, [rsp+64] \n"
            "movdqu xmm5, [rsp+80] \n"
            "movdqu xmm6, [rsp+96] \n"
            "movdqu xmm7, [rsp+112] \n"
            "movdqu xmm8, [rsp+128] \n"
            "movdqu xmm9, [rsp+144] \n"
            "movdqu xmm10, [rsp+160] \n"
            "movdqu xmm11, [rsp+176] \n"
            "movdqu xmm12, [rsp+192] \n"
            "movdqu xmm13, [rsp+208] \n"
            "movdqu xmm14, [rsp+224] \n"
            "movdqu xmm15, [rsp+240] \n"
            "add rsp, 256 \n"
            "pop r11 \n"
            "pop r10 \n"
            "pop r9 \n"
            "pop r8 \n"
            "pop rdi \n"
            "pop rsi \n"
            "pop rdx \n"
            "pop rcx \n"
            "pop rax \n"
            "popfq \n"
            "lea eax, [r13+r13] \n"
            "jmp qword ptr [rip + _g_MapCapacity_RetAddr] \n"
            ".att_syntax prefix \n"
        );
    }
extern "C" __attribute__((naked)) void done_hook(){__asm__ volatile(
"movq %r13, _observed_count(%rip)\n"
"pushfq\n"
"popq _observed_flags(%rip)\n"
"movdqu %xmm0, _observed_xmm+0(%rip)\n"
"movdqu %xmm1, _observed_xmm+16(%rip)\n"
"movdqu %xmm2, _observed_xmm+32(%rip)\n"
"movdqu %xmm3, _observed_xmm+48(%rip)\n"
"movdqu %xmm4, _observed_xmm+64(%rip)\n"
"movdqu %xmm5, _observed_xmm+80(%rip)\n"
"movdqu %xmm6, _observed_xmm+96(%rip)\n"
"movdqu %xmm7, _observed_xmm+112(%rip)\n"
"movdqu %xmm8, _observed_xmm+128(%rip)\n"
"movdqu %xmm9, _observed_xmm+144(%rip)\n"
"movdqu %xmm10, _observed_xmm+160(%rip)\n"
"movdqu %xmm11, _observed_xmm+176(%rip)\n"
"movdqu %xmm12, _observed_xmm+192(%rip)\n"
"movdqu %xmm13, _observed_xmm+208(%rip)\n"
"movdqu %xmm14, _observed_xmm+224(%rip)\n"
"movdqu %xmm15, _observed_xmm+240(%rip)\n"
"popq %rbx\n"
"popq %r14\n"
"popq %r13\n"
"popq %r12\n"
"popq %rbp\n"
"retq\n"
);}
extern "C" __attribute__((naked)) unsigned invoke_capacity(unsigned char*,void*){__asm__ volatile(
"pushq %rbp\n"
"pushq %r12\n"
"pushq %r13\n"
"pushq %r14\n"
"pushq %rbx\n"
"movq %rdi, %rbp\n"
"movq %rsi, %r14\n"
"movq $123, %r13\n"
"movdqu _sentinel(%rip), %xmm0\n"
"movdqu _sentinel(%rip), %xmm1\n"
"movdqu _sentinel(%rip), %xmm2\n"
"movdqu _sentinel(%rip), %xmm3\n"
"movdqu _sentinel(%rip), %xmm4\n"
"movdqu _sentinel(%rip), %xmm5\n"
"movdqu _sentinel(%rip), %xmm6\n"
"movdqu _sentinel(%rip), %xmm7\n"
"movdqu _sentinel(%rip), %xmm8\n"
"movdqu _sentinel(%rip), %xmm9\n"
"movdqu _sentinel(%rip), %xmm10\n"
"movdqu _sentinel(%rip), %xmm11\n"
"movdqu _sentinel(%rip), %xmm12\n"
"movdqu _sentinel(%rip), %xmm13\n"
"movdqu _sentinel(%rip), %xmm14\n"
"movdqu _sentinel(%rip), %xmm15\n"
"stc\n"
"jmp _eu4jp_map_capacity_hook\n"
);}
int main(){
std::vector<unsigned char> font(0xe8+8*(eu4jpMap::maxSlot+1),0);
std::array<unsigned char,16> glyph{};int16_t width=20;std::memcpy(glyph.data()+6,&width,2);
const unsigned char* ptr=glyph.data();for(size_t i=0;i<=eu4jpMap::maxSlot;++i)std::memcpy(font.data()+0xe8+8*i,&ptr,8);
alignas(16) unsigned char frame[512]{};auto* rbp=frame+320;
auto* str=new(rbp-0xf0)std::string("ABCD");
g_MapCapacity_RetAddr=(uintptr_t)&done_hook;
unsigned result=invoke_capacity(rbp,font.data());
assert(result==8&&observed_count==4&&(observed_flags&1));
for(int i=0;i<16;++i)assert(!std::memcmp(observed_xmm+16*i,sentinel,16));
str->~basic_string();
std::puts("PASS: actual capacity hook updates R13 and replays LEA; preserves all 16 XMM registers, carry flag and stack return.");
}
