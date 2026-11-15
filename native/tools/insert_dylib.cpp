// MIT License. Copyright (c) 2026 EU4 Japanese for Mac contributors.
// Restricted injector for a staged, thin x86_64 EU4 executable.
// No external injector implementation is included.
#include <mach-o/loader.h>
#include <mach/machine.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <unistd.h>
#include <spawn.h>
#include <cerrno>
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>
extern char** environ;
namespace {
constexpr const char* library="@executable_path/../Frameworks/libeu4dll_mac.dylib";
struct File {
    int fd=-1;
    explicit File(const char* path){fd=open(path,O_RDWR|O_NOFOLLOW);if(fd<0)throw std::runtime_error("cannot open regular executable");}
    ~File(){if(fd>=0)close(fd);}
    File(const File&)=delete;File& operator=(const File&)=delete;
};
bool range(size_t offset,size_t length,size_t total){return offset<=total&&length<=total-offset;}
template<class T>T get(const std::vector<uint8_t>& b,size_t offset){
    if(!range(offset,sizeof(T),b.size()))throw std::runtime_error("truncated Mach-O structure");
    T value{};std::memcpy(&value,b.data()+offset,sizeof(T));return value;
}
std::vector<uint8_t> readFile(File& f){
    struct stat st{};if(fstat(f.fd,&st)||!S_ISREG(st.st_mode)||st.st_size<32||st.st_size>512LL*1024*1024)throw std::runtime_error("invalid executable size/type");
    std::vector<uint8_t> bytes((size_t)st.st_size);size_t done=0;
    while(done<bytes.size()){
        ssize_t n=pread(f.fd,bytes.data()+done,bytes.size()-done,(off_t)done);
        if(n<0&&errno==EINTR)continue;
        if(n<=0)throw std::runtime_error("cannot read executable");done+=(size_t)n;
    }return bytes;
}
struct Layout {mach_header_64 header{};size_t firstData=0;unsigned signatures=0;size_t signatureCommands=0;unsigned injected=0;};
Layout inspect(const std::vector<uint8_t>& b){
    Layout v{};v.header=get<mach_header_64>(b,0);v.firstData=b.size();
    const auto& h=v.header;
    if(h.magic!=MH_MAGIC_64||h.cputype!=CPU_TYPE_X86_64||h.filetype!=MH_EXECUTE)throw std::runtime_error("only thin x86_64 MH_EXECUTE is supported");
    if(h.ncmds==0||h.ncmds>4096||!range(sizeof(h),h.sizeofcmds,b.size()))throw std::runtime_error("invalid load-command bounds");
    size_t at=sizeof(h),end=at+h.sizeofcmds;
    for(uint32_t i=0;i<h.ncmds;++i){
        if(!range(at,sizeof(load_command),end))throw std::runtime_error("truncated load command");
        auto c=get<load_command>(b,at);
        if(c.cmdsize<sizeof(c)||(c.cmdsize%8)||!range(at,c.cmdsize,end))throw std::runtime_error("invalid load-command size");
        if(c.cmd==LC_SEGMENT_64){
            if(c.cmdsize<sizeof(segment_command_64))throw std::runtime_error("short segment");
            auto seg=get<segment_command_64>(b,at);
            if(seg.nsects>(c.cmdsize-sizeof(seg))/sizeof(section_64)||!range(seg.fileoff,seg.filesize,b.size()))throw std::runtime_error("invalid segment/section bounds");
            if(seg.filesize&&seg.fileoff)v.firstData=std::min(v.firstData,(size_t)seg.fileoff);
            for(uint32_t n=0;n<seg.nsects;++n){
                auto section=get<section_64>(b,at+sizeof(seg)+n*sizeof(section_64));
                uint32_t type=section.flags&SECTION_TYPE;
                if(section.size&&type!=S_ZEROFILL&&type!=S_GB_ZEROFILL&&type!=S_THREAD_LOCAL_ZEROFILL){
                    if(!section.offset||!range(section.offset,section.size,b.size()))throw std::runtime_error("invalid section file range");
                    v.firstData=std::min(v.firstData,(size_t)section.offset);
                }
                if(section.nreloc){
                    if(!range(section.reloff,(uint64_t)section.nreloc*8,b.size()))throw std::runtime_error("invalid relocation range");
                    v.firstData=std::min(v.firstData,(size_t)section.reloff);
                }
            }
        }
        if(c.cmd==LC_CODE_SIGNATURE){
            if(c.cmdsize!=sizeof(linkedit_data_command))throw std::runtime_error("invalid code-signature command");
            auto sig=get<linkedit_data_command>(b,at);
            if(!range(sig.dataoff,sig.datasize,b.size()))throw std::runtime_error("invalid signature range");
            ++v.signatures;v.signatureCommands+=c.cmdsize;
        }
        if(c.cmd==LC_LOAD_DYLIB||c.cmd==LC_LOAD_WEAK_DYLIB||c.cmd==LC_REEXPORT_DYLIB||c.cmd==LC_LOAD_UPWARD_DYLIB){
            if(c.cmdsize<sizeof(dylib_command))throw std::runtime_error("short dylib command");
            auto d=get<dylib_command>(b,at);
            if(d.dylib.name.offset<sizeof(d)||d.dylib.name.offset>=c.cmdsize)throw std::runtime_error("invalid dylib path offset");
            const char* name=(const char*)b.data()+at+d.dylib.name.offset;
            size_t room=c.cmdsize-d.dylib.name.offset;
            if(!std::memchr(name,0,room))throw std::runtime_error("unterminated dylib path");
            if(std::strcmp(name,library)==0){if(c.cmd!=LC_LOAD_DYLIB)throw std::runtime_error("unexpected injection load type");++v.injected;}
        }
        at+=c.cmdsize;
    }
    if(at!=end||v.signatures>1||v.injected>1||v.firstData<end)throw std::runtime_error("inconsistent Mach-O layout");
    return v;
}
size_t newSize(){return (sizeof(dylib_command)+std::strlen(library)+1+7)&~size_t(7);}
void preflight(const std::vector<uint8_t>& b,const Layout& v){
    size_t end=sizeof(v.header)+v.header.sizeofcmds;
    if(newSize()>v.firstData-(end-v.signatureCommands))throw std::runtime_error("insufficient header padding; executable left unpatched");
    // No nonzero bytes outside the old load commands may be overwritten.
    size_t extra=newSize()>v.signatureCommands?newSize()-v.signatureCommands:0;
    if(!range(end,extra,b.size()))throw std::runtime_error("invalid header padding range");
    for(size_t i=0;i<extra;++i)if(b[end+i])throw std::runtime_error("nonzero header padding; executable left unpatched");
}
void removeSignature(const char* path){
    pid_t pid=0;char* args[]={const_cast<char*>("/usr/bin/codesign"),const_cast<char*>("--remove-signature"),const_cast<char*>(path),nullptr};
    if(posix_spawn(&pid,args[0],nullptr,nullptr,args,environ))throw std::runtime_error("cannot start system codesign");
    int status=0;while(waitpid(pid,&status,0)<0){if(errno!=EINTR)throw std::runtime_error("cannot wait for codesign");}
    if(!WIFEXITED(status)||WEXITSTATUS(status)!=0)throw std::runtime_error("system codesign could not remove old signature");
}
void inject(const char* path){
    bool signedFile=false;
    {File f(path);auto bytes=readFile(f);auto v=inspect(bytes);if(v.injected){std::puts("LC_LOAD_DYLIB already present");return;}preflight(bytes,v);signedFile=v.signatures!=0;}
    if(signedFile)removeSignature(path);
    File f(path);auto bytes=readFile(f);auto v=inspect(bytes);
    if(v.signatures||v.injected)throw std::runtime_error("executable changed during preparation");
    preflight(bytes,v);size_t at=sizeof(v.header)+v.header.sizeofcmds;
    std::vector<uint8_t> command(newSize(),0);dylib_command d{};d.cmd=LC_LOAD_DYLIB;d.cmdsize=(uint32_t)command.size();d.dylib.name.offset=sizeof(d);
    std::memcpy(command.data(),&d,sizeof(d));std::memcpy(command.data()+sizeof(d),library,std::strlen(library)+1);
    std::memcpy(bytes.data()+at,command.data(),command.size());
    ++v.header.ncmds;v.header.sizeofcmds+=(uint32_t)command.size();std::memcpy(bytes.data(),&v.header,sizeof(v.header));
    auto verified=inspect(bytes);if(verified.injected!=1)throw std::runtime_error("in-memory injection check failed");
    size_t count=at+command.size(),done=0;
    while(done<count){ssize_t n=pwrite(f.fd,bytes.data()+done,count-done,(off_t)done);if(n<0&&errno==EINTR)continue;if(n<=0)throw std::runtime_error("cannot write staged executable");done+=(size_t)n;}
    if(fsync(f.fd))throw std::runtime_error("cannot sync staged executable");
    if(inspect(readFile(f)).injected!=1)throw std::runtime_error("on-disk injection check failed");
    std::puts("LC_LOAD_DYLIB inserted and verified");
}
}
int main(int argc,char** argv){
    try{
        if(argc!=5||std::strcmp(argv[1],"--inplace")||std::strcmp(argv[2],"--all-yes")||std::strcmp(argv[3],library))throw std::runtime_error("usage: insert_dylib --inplace --all-yes @executable_path/../Frameworks/libeu4dll_mac.dylib staged-executable");
        inject(argv[4]);return 0;
    }catch(const std::exception& e){std::fprintf(stderr,"insert_dylib: %s\n",e.what());return 1;}
}
