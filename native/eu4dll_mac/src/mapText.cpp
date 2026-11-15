#include "mapText.h"
#include "global.h"
#include "mapGuard.h"
#include <cstdlib>
#include <sys/stat.h>

namespace mapText {
    extern "C" {
    uintptr_t g_AddNameArea_3_BypassAddr = 0;
    uintptr_t g_AddNameArea_1_RetAddr = 0;
    uintptr_t g_AddNameArea_1_BypassAddr = 0;

    uintptr_t g_FillVertexBuffer_1_BypassAddr = 0;
    uintptr_t g_FillVertexBuffer_2_BypassAddr = 0;

    uintptr_t g_CurveText_1_BypassAddr = 0;
    uintptr_t g_CurveText_2_BypassAddr = 0;
    uintptr_t g_CurveText_3_BypassAddr = 0;

    uint32_t g_CurveText_1_SkipByteCount = 0;

    uintptr_t g_AddNudgedNames_BypassAddr = 0;

    void *g_OriginalToUpper_Addr;

    }

    extern "C" {
    [[gnu::used]] const char eu4jp_map_safety_marker[] = "EU4JP_MAP_SAFE_V1";
    uintptr_t g_MapCapacity_RetAddr = 0;
    size_t eu4jp_map_capacity(std::string* text, const void* font) {
        return eu4jpMap::capacity(*text,font);
    }
    }
    [[noreturn]] static void mapFatal(const char* operation) {
        fprintf(stderr,"EU4 Japanese: required map hook failed: %s. Installation must be reviewed.\n",operation);
        fflush(nullptr);
        std::_Exit(EXIT_FAILURE);
    }
    static void checkedMapWrite(bool ok) { if(!ok) mapFatal("memory write"); }
    static bool disabledMapNames() {
        Dl_info info{};
        if(!dladdr((void*)&eu4jp_map_capacity,&info)||!info.dli_fname) return false;
        std::string path=info.dli_fname;
        path=path.substr(0,path.find_last_of('/'));
        path=path.substr(0,path.find_last_of('/'))+"/Resources/eu4jp-disable-map-names";
        struct stat st{};
        return lstat(path.c_str(),&st)==0 && S_ISREG(st.st_mode);
    }
    static bool noMapName(void*,const int*,int,int,int,int,const void*) {return false;}
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
    void install_MapCapacity() {
        TRACK_FUNCTION();
        uintptr_t p=ScanMainModule("43 8D 44 2D 00 8D 04 40 4C 63 F8 49 C1 E7 02");
        if(!p) mapFatal("map capacity pattern");
        g_MapCapacity_RetAddr=p+5; // exactly one complete LEA instruction
        checkedMapWrite(HookJMP(p,(uintptr_t)&eu4jp_map_capacity_hook));
        SET_SUCCESS();
    }
    void install_MapNamesMode() {
        if(!disabledMapNames()) return;
        auto p=(uintptr_t)findFn("_ZN18CGenerateNamesWork11AddNameAreaEPKiiiiiRK13SProvinceData");
        const unsigned char prologue[]={0x55,0x48,0x89,0xe5,0x41,0x57};
        if(!p||memcmp((void*)p,prologue,sizeof(prologue)))mapFatal("map names entry");
        checkedMapWrite(HookJMP(p,(uintptr_t)&noMapName));
        fprintf(stderr,"EU4 Japanese: country map names disabled (diagnostic mode).\n");
    }

    __attribute__((naked)) void naked_CGenerateNamesWork_AddNameArea_1() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"

                "mov dword ptr [rbp-0xD8], 0 \n" //清空缓冲区变量ver_D8(4字节)，使CString_Append函数能正确识别字符长度
                "mov byte ptr [rbp-0xD8], al \n" //执行被覆盖的指令，先存入当前字符到缓冲区

                "cmp al, %c[e1] \n"
                "jz 1f \n"
                "cmp al, %c[e2] \n"
                "jz 1f \n"
                "cmp al, %c[e3] \n"
                "jz 1f \n"
                "cmp al, %c[e4] \n"
                "jz 1f \n"

                "jmp 2f \n"

                "1: \n"

                "mov bx, word ptr [r15+r14+1] \n" //如果是双字节文本，就读入后面两个字节
                "mov word ptr [rbp-0xD8 + 1], bx \n" //将后面两个字节追加进缓冲区

                "add r14, 2 \n"

                "2: \n"

                "lea rbx, [rbp-0x128] \n"
                "mov rdi, rbx \n"
                "lea rsi, [rbp-0xD8] \n"
                "call qword ptr [rip + _g_CString_AppendCharConstAddress] \n"
                "mov dword ptr [rbp-0xD8], 0 \n" // Never leak payload into the original one-byte tail.

                "cmp r13, r14 \n" //原循环是r14不等于 源文本长度-1 就继续，由于手动递增了r14，如果末尾字是双字节文本，会导致r14超过r13致使无限循环导致崩溃。所以需要手动判断并跳过追加末尾字符区域
                "jbe 3f \n"

                "jmp qword ptr [rip + _g_AddNameArea_1_BypassAddr] \n"

                "3: \n"
                "mov dword ptr [rbp-0xD8], 0 \n"
                "jmp qword ptr [rip + _g_AddNameArea_1_RetAddr] \n"

                ".att_syntax prefix \n"
                :
                : [e1] "i"(ESCAPE_SEQ_1),
        [e2] "i"(ESCAPE_SEQ_2),
        [e3] "i"(ESCAPE_SEQ_3),
        [e4] "i"(ESCAPE_SEQ_4)
        );
    }

/**
 Hook函数：CGenerateNamesWork::AddNameArea 加空格循环
 作用：不断尝试在每个字中间添加X个空格，使其总体宽度能够填满地图区域。找到最合适的间距后，调用FillVertexBuffer生成顶点。
 */
    void install_CGenerateNamesWork_AddNameArea_1() {
        TRACK_FUNCTION();
        std::string pattern = "43 8A 04 37 88 85 28 FF FF FF";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        leaAddress = leaAddress + 4;

        g_AddNameArea_1_BypassAddr = leaAddress + 0x1C;
        g_AddNameArea_1_RetAddr = leaAddress + 0x72;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CGenerateNamesWork_AddNameArea_1));
        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx 返回地址2:0x%lx\n",
               __func__,
               matchAddress, leaAddress, g_AddNameArea_1_RetAddr, g_AddNameArea_1_BypassAddr);

        SET_SUCCESS();
    }

    void proxy_CGenerateNamesWork_AddNameArea_ToUpper_2(std::string* text) {
        eu4jpMap::uppercase(*text);
    }

/**
 Hook函数：CGenerateNamesWork::AddNameArea
 作用：替换ToUpper CALL，避免将标识符后面的字节当成小写字符从而导致文字改变
 */
    void install_CGenerateNamesWork_AddNameArea_2() {
        TRACK_FUNCTION();
        std::string pattern = "FF FF FF E8 ? ? ? ? 31 C0 4C 8D 85 B8 FD FF FF";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        leaAddress = leaAddress + 3;
        g_OriginalToUpper_Addr = findFn("__toupper");
        checkedMapWrite(ReplaceCall(leaAddress, (uintptr_t) proxy_CGenerateNamesWork_AddNameArea_ToUpper_2));
        printf("eu4dll_mac [Success] %s ReplaceCall 匹配地址:0x%lx 写入地址:0x%lx ToUpper地址:%p\n", __func__,
               matchAddress, leaAddress, g_OriginalToUpper_Addr);

        SET_SUCCESS();
    }


    __attribute__((naked)) void naked_CGenerateNamesWork_AddNameArea_3() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"

                "mov rdi, rax \n"
                "movzx eax, byte ptr [rax] \n"

                "cmp al, %c[e1] \n"
                "jz 1f \n"
                "cmp al, %c[e2] \n"
                "jz 2f \n"
                "cmp al, %c[e3] \n"
                "jz 3f \n"
                "cmp al, %c[e4] \n"
                "jz 4f \n"

                "jmp 7f \n"

                "1: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "jmp 5f \n"

                "2: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "sub eax, %c[s2] \n"
                "jmp 5f \n"

                "3: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "add eax, %c[s3] \n"
                "jmp 5f \n"

                "4: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "add eax, %c[s4] \n"

                // 通用收尾
                "5: \n"

                "add ebx, 2 \n" // 增加循环总计数

                "cmp eax, 256 \n"
                "jb 7f \n"
                "add eax, 1712 \n"
                "7: \n"

                "mov rax, [r14+rax*8+0xE8] \n"

                "jmp qword ptr [rip + _g_AddNameArea_3_BypassAddr] \n"

                ".att_syntax prefix \n"
                :
                : [e1] "i"(ESCAPE_SEQ_1),
        [e2] "i"(ESCAPE_SEQ_2),
        [e3] "i"(ESCAPE_SEQ_3),
        [e4] "i"(ESCAPE_SEQ_4),
        [s2] "i"(SHIFT_2),
        [s3] "i"(SHIFT_3),
        [s4] "i"(SHIFT_4)
        );
    }

/**
 Hook函数：CGenerateNamesWork::AddNameArea 通过循环遍历获取有效字符数，来决定顶点缓冲区大小
 作用：使其能正确识别字符数
 */
    void install_CGenerateNamesWork_AddNameArea_3() {
        TRACK_FUNCTION();
        std::string pattern = "0F B6 00 49 8B 84 C6 E8 00 00 00 48 85 C0 74 0D";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        g_AddNameArea_3_BypassAddr = leaAddress + 0xB;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CGenerateNamesWork_AddNameArea_3));
        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_AddNameArea_3_BypassAddr);

        SET_SUCCESS();
    }


    __attribute__((naked)) void naked_CBitmapFont_FillVertexBuffer_1() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"

                "mov rdi, rax \n"
                "movzx eax, byte ptr [rax] \n"

                "cmp al, %c[e1] \n"
                "jz 1f \n"
                "cmp al, %c[e2] \n"
                "jz 2f \n"
                "cmp al, %c[e3] \n"
                "jz 3f \n"
                "cmp al, %c[e4] \n"
                "jz 4f \n"

                "jmp 7f \n"

                "1: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "jmp 5f \n"

                "2: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "sub eax, %c[s2] \n"
                "jmp 5f \n"

                "3: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "add eax, %c[s3] \n"
                "jmp 5f \n"

                "4: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "add eax, %c[s4] \n"

                // 通用收尾
                "5: \n"

                "add ebx, 2 \n" // 增加循环总计数

                "cmp eax, 256 \n"
                "jb 7f \n"
                "add eax, 1712 \n"

                "7: \n"

                "mov rax, [r15+rax*8+0xE8] \n"
                "jmp qword ptr [rip + _g_FillVertexBuffer_1_BypassAddr] \n"

                ".att_syntax prefix \n"
                :
                : [e1] "i"(ESCAPE_SEQ_1),
        [e2] "i"(ESCAPE_SEQ_2),
        [e3] "i"(ESCAPE_SEQ_3),
        [e4] "i"(ESCAPE_SEQ_4),
        [s2] "i"(SHIFT_2),
        [s3] "i"(SHIFT_3),
        [s4] "i"(SHIFT_4)
        );
    }

/**
 Hook函数：CBitmapFont::FillVertexBuffer 字符顶点生成循环
 作用：使其能正确识别双字节字符
 */
    void install_CBitmapFont_FillVertexBuffer_1() {
        TRACK_FUNCTION();
        std::string pattern = "0F B6 00 49 8B 84 C7 E8 00 00 00 48 85 C0 0F 84 46 03 00 00";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        g_FillVertexBuffer_1_BypassAddr = leaAddress + 0xB;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CBitmapFont_FillVertexBuffer_1));
        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_FillVertexBuffer_1_BypassAddr);

        SET_SUCCESS();
    }

    __attribute__((naked)) void naked_CBitmapFont_FillVertexBuffer_2() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"

                "mov r13, rax \n"
                "movzx eax, byte ptr [rax] \n"

                "cmp al, %c[e1] \n"
                "jz 1f \n"
                "cmp al, %c[e2] \n"
                "jz 2f \n"
                "cmp al, %c[e3] \n"
                "jz 3f \n"
                "cmp al, %c[e4] \n"
                "jz 4f \n"

                "jmp 7f \n"

                "1: \n"
                "movzx eax, word ptr [r13+1] \n"
                "jmp 5f \n"

                "2: \n"
                "movzx eax, word ptr [r13+1] \n"
                "sub eax, %c[s2] \n"
                "jmp 5f \n"

                "3: \n"
                "movzx eax, word ptr [r13+1] \n"
                "add eax, %c[s3] \n"
                "jmp 5f \n"

                "4: \n"
                "movzx eax, word ptr [r13+1] \n"
                "add eax, %c[s4] \n"

                // 通用收尾
                "5: \n"

                "push rax \n"

                "lea rdi, [rbp - 0x1000] \n"
                "movzx rsi, byte ptr [r13+1] \n"
                "call [rip + _g_CString_AppendCharAddress] \n"

                "lea rdi, [rbp - 0x1000] \n"
                "movzx rsi, byte ptr [r13+2] \n"
                "call [rip + _g_CString_AppendCharAddress] \n"

                "pop rax \n"

                "add r12d, 2 \n" // 增加循环总计数

                "cmp eax, 256 \n"
                "jb 7f \n"
                "add eax, 1712 \n"
                "7: \n"
                "mov r13, [r15+rax*8+0xE8] \n"
                "jmp qword ptr [rip + _g_FillVertexBuffer_2_BypassAddr] \n"

                ".att_syntax prefix \n"
                :
                : [e1] "i"(ESCAPE_SEQ_1),
        [e2] "i"(ESCAPE_SEQ_2),
        [e3] "i"(ESCAPE_SEQ_3),
        [e4] "i"(ESCAPE_SEQ_4),
        [s2] "i"(SHIFT_2),
        [s3] "i"(SHIFT_3),
        [s4] "i"(SHIFT_4)
        );
    }

/**
 Hook函数：CBitmapFont::FillVertexBuffer 字符初步处理循环，计算宽度与处理换行
 作用：使其能正确识别双字节字符
 */
    void install_CBitmapFont_FillVertexBuffer_2() {
        TRACK_FUNCTION();
        std::string pattern = "0F B6 00 4D 8B AC C7 E8 00 00 00 4D 85 ED";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        g_FillVertexBuffer_2_BypassAddr = leaAddress + 0xB;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CBitmapFont_FillVertexBuffer_2));
        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_FillVertexBuffer_2_BypassAddr);

        SET_SUCCESS();
    }


    __attribute__((naked)) void naked_CurveText_1() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"

                // 为指针加上跳过字节数才是当前真实索引
                "mov r15d, dword ptr [rip + _g_CurveText_1_SkipByteCount] \n"
                "add rax, r15 \n"

                "mov r15, rax \n"
                "movzx eax, byte ptr [rax] \n"

                "cmp al, %c[e1] \n"
                "jz 1f \n"
                "cmp al, %c[e2] \n"
                "jz 2f \n"
                "cmp al, %c[e3] \n"
                "jz 3f \n"
                "cmp al, %c[e4] \n"
                "jz 4f \n"

                "jmp 7f \n"

                "1: \n"
                "movzx eax, word ptr [r15+1] \n"
                "jmp 5f \n"

                "2: \n"
                "movzx eax, word ptr [r15+1] \n"
                "sub eax, %c[s2] \n"
                "jmp 5f \n"

                "3: \n"
                "movzx eax, word ptr [r15+1] \n"
                "add eax, %c[s3] \n"
                "jmp 5f \n"

                "4: \n"
                "movzx eax, word ptr [r15+1] \n"
                "add eax, %c[s4] \n"

                // 通用收尾
                "5: \n"
                "add dword ptr [rip + _g_CurveText_1_SkipByteCount], 2 \n" //增加外部跳过字节计数

                "cmp eax, 256 \n"
                "jb 7f \n"
                "add eax, 1712 \n"

                "7: \n"

                "mov r15, [r12+rax*8] \n"

                "jmp qword ptr [rip + _g_CurveText_1_BypassAddr] \n"

                ".att_syntax prefix \n"
                :
                : [e1] "i"(ESCAPE_SEQ_1),
        [e2] "i"(ESCAPE_SEQ_2),
        [e3] "i"(ESCAPE_SEQ_3),
        [e4] "i"(ESCAPE_SEQ_4),
        [s2] "i"(SHIFT_2),
        [s3] "i"(SHIFT_3),
        [s4] "i"(SHIFT_4)
        );
    }

/**
 Hook函数：CurveText
 作用：将FillVertexBuffer函数生成的文字顶点网格贴合地图曲线
 */
    void install_CurveText_1() {
        TRACK_FUNCTION();
        std::string pattern = "0F B6 00 4D 8B 3C C4 4D 85 FF";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        g_CurveText_1_BypassAddr = leaAddress + 7;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CurveText_1));

        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_CurveText_1_BypassAddr);

        SET_SUCCESS();
    }


    __attribute__((naked)) void naked_CurveText_2() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"
                "mov r14d, 0 \n"
                "mov dword ptr[rip + _g_CurveText_1_SkipByteCount], 0 \n" //循环开始时清空上一轮计数

                "jmp qword ptr [rip + _g_CurveText_2_BypassAddr] \n"

                ".att_syntax prefix \n"
                );
    }

/**
 Hook函数：CurveText
 作用：将外部维护的计数在每一次循环前清零
 */
    void install_CurveText_2() {
        TRACK_FUNCTION();
        std::string pattern = "F3 41 0F 2A CE 41 BE 00 00 00 00";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        leaAddress = leaAddress + 5;
        g_CurveText_2_BypassAddr = leaAddress + 6;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CurveText_2));

        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_CurveText_2_BypassAddr);

        SET_SUCCESS();
    }


    __attribute__((naked)) void naked_CurveText_3() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"
                "mov eax,[rbp - 0x90] \n"

                "jmp qword ptr [rip + _g_CurveText_3_BypassAddr] \n"

                ".att_syntax prefix \n"
                );
    }

/**
 Hook函数：CurveText
 作用：将已存储的文本真实长度传递给变量进行对比，避免循环内重复遍历。
 */
    void install_CurveText_3() {
        TRACK_FUNCTION();
        std::string pattern = "F3 0F 11 45 CC 4C 89 EF E8";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        leaAddress = leaAddress + 5;
        g_CurveText_3_BypassAddr = leaAddress + 8;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CurveText_3));
        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_CurveText_3_BypassAddr);

        SET_SUCCESS();
    }


    uint64_t proxy_CurveText_GetSize_CStringGetSize_4(std::string *cstring_this) {
        if(!eu4jpMap::valid(*cstring_this,eu4jpMap::maxBytes))return 0;
        size_t count=0;
        for(size_t i=0;i<cstring_this->size();) {
            eu4jpMap::Token t{};
            if(!eu4jpMap::next(*cstring_this,i,t))return 0;
            i+=t.bytes;++count;
        }
        return count;
    }

/**
 Hook函数：CurveText
 作用：替换getSize CALL获取真实字符长度以便循环遍历
 */
    void install_CurveText_4() {
        TRACK_FUNCTION();
        std::string pattern = "41 89 C6 4C 89 EF E8 ? ? ? ? 41 89 C7 4C 89 EF E8 ? ? ? ? 48 89 85 70 FF FF FF";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        leaAddress = leaAddress + 6;
        checkedMapWrite(ReplaceCall(leaAddress, (uintptr_t) proxy_CurveText_GetSize_CStringGetSize_4));
        uintptr_t replaceAddress1 = leaAddress;
        leaAddress = leaAddress + 11;
        checkedMapWrite(ReplaceCall(leaAddress, (uintptr_t) proxy_CurveText_GetSize_CStringGetSize_4));
        printf("eu4dll_mac [Success] %s ReplaceCall 匹配地址:0x%lx 写入地址1:0x%lx 写入地址2:0x%lx\n", __func__,
               matchAddress, replaceAddress1, leaAddress);
        SET_SUCCESS();
    }


    __attribute__((naked)) void naked_CCountryNameCollection_AddNudgedNames() {
        __asm__ volatile (
                ".intel_syntax noprefix \n"

                "mov rdi, rax \n"
                "movzx eax, byte ptr [rax] \n"

                "cmp al, %c[e1] \n"
                "jz 1f \n"
                "cmp al, %c[e2] \n"
                "jz 2f \n"
                "cmp al, %c[e3] \n"
                "jz 3f \n"
                "cmp al, %c[e4] \n"
                "jz 4f \n"

                "jmp 7f \n"

                "1: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "jmp 5f \n"

                "2: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "sub eax, %c[s2] \n"
                "jmp 5f \n"

                "3: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "add eax, %c[s3] \n"
                "jmp 5f \n"

                "4: \n"
                "movzx eax, word ptr [rdi+1] \n"
                "add eax, %c[s4] \n"

                "5: \n"

                "add r13d, 2 \n" // 增加循环总计数

                "cmp eax, 256 \n"
                "jb 7f \n"
                "add eax, 1712 \n"
                "7: \n"

                "mov rax, [r14+rax*8+0xE8] \n"

                "jmp qword ptr [rip + _g_AddNudgedNames_BypassAddr] \n"

                ".att_syntax prefix \n"
                :
                : [e1] "i"(ESCAPE_SEQ_1),
        [e2] "i"(ESCAPE_SEQ_2),
        [e3] "i"(ESCAPE_SEQ_3),
        [e4] "i"(ESCAPE_SEQ_4),
        [s2] "i"(SHIFT_2),
        [s3] "i"(SHIFT_3),
        [s4] "i"(SHIFT_4),
        [nf] "i"(NO_FONT),
        [nd] "i"(NOT_DEF)
        );
    }

/**
 Hook函数：CCountryNameCollection::AddNudgedNames
 作用：使其正确识别双字节字符。不知道做啥的，HOOK看文本也没能看出个啥，文本量远不及AddNameArea
 */
    void install_CCountryNameCollection_AddNudgedNames() {
        TRACK_FUNCTION();
        std::string pattern = "44 89 EE E8 ? ? ? ? 0F B6 00 49 8B 84 C6 E8 00 00 00 48 85 C0 74";
        uintptr_t matchAddress = ScanMainModule(pattern);

        if (matchAddress == 0) {
            printf("eu4dll_mac [Error] %s 特征码查找失败！\n", __func__);
            mapFatal(__func__);
        }
        uintptr_t leaAddress = matchAddress;
        leaAddress = leaAddress + 8;
        g_AddNudgedNames_BypassAddr = leaAddress + 0xB;

        checkedMapWrite(HookJMP(leaAddress, (uintptr_t) naked_CCountryNameCollection_AddNudgedNames));
        printf("eu4dll_mac [Success] %s HookJMP 匹配地址:0x%lx Hook地址:0x%lx 返回地址:0x%lx\n", __func__,
               matchAddress, leaAddress, g_AddNudgedNames_BypassAddr);

        SET_SUCCESS();
    }


    void install() {
        install_MapNamesMode();
        install_MapCapacity();
        //尝试在文本中添加空格来填满地图
        install_CGenerateNamesWork_AddNameArea_1();
        //替换到大小CALL，使其能正确略过双字节文本
        install_CGenerateNamesWork_AddNameArea_2();
        //使其能正确识别字符数，来生成缓冲区
        install_CGenerateNamesWork_AddNameArea_3();
        //字符顶点生成
        install_CBitmapFont_FillVertexBuffer_1();
        //文本初处理循环
        install_CBitmapFont_FillVertexBuffer_2();
        //贴合地图曲线
        install_CurveText_1();
        install_CurveText_2();
        install_CurveText_3();
        install_CurveText_4();
        //不知道什么用
        install_CCountryNameCollection_AddNudgedNames();
    }

}
