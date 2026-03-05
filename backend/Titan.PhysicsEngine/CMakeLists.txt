cmake_minimum_required(VERSION 3.16)
project(TitanPhysicsEngine)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

file(GLOB_RECURSE SOURCES
    src/*.cpp
)

add_library(TitanPhysicsEngine SHARED ${SOURCES})

target_include_directories(TitanPhysicsEngine PUBLIC include)

add_executable(TitanTest src/main.cpp)
target_link_libraries(TitanTest TitanPhysicsEngine)

# Test suite
add_executable(TitanTests tests/test_main.cpp)
target_link_libraries(TitanTests TitanPhysicsEngine)
