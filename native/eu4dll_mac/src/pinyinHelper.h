#pragma once
#include <memory>
#include <string>
#include <vector>
#include <filesystem>
namespace Pinyin { inline void setDictionaryPath(const std::string &){} }
class PinyinHelper {
public:
 static PinyinHelper &getInstance(){static PinyinHelper instance;return instance;}
 std::shared_ptr<std::vector<std::string>> getPinyin(const std::string &s){return std::make_shared<std::vector<std::string>>(std::initializer_list<std::string>{s});}
};
