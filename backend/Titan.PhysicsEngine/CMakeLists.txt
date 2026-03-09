cmake_minimum_required(VERSION 3.16)
project(TitanPhysicsEngine)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

# Core math library
set(TITAN_MATH_SOURCES)
# Header-only for now

# Physics models
set(TITAN_PHYSICS_SOURCES
    src/physics/GravityModel.cpp
    src/physics/AtmosphereModel.cpp
)

# Integrators
set(TITAN_INTEGRATOR_SOURCES
    src/integrators/RK4Integrator.cpp
    src/integrators/EulerIntegrator.cpp
    src/integrators/RK45Integrator.cpp
)

# Orbital mechanics
set(TITAN_ORBITAL_SOURCES
    src/orbital/OrbitalMechanics.cpp
)

# Guidance
set(TITAN_GUIDANCE_SOURCES
    src/guidance/TargetApoapsisGuidance.cpp
)

# GNC
set(TITAN_GNC_SOURCES
    src/gnc/PIDController.cpp
)

# Simulation
set(TITAN_SIMULATION_SOURCES
    src/simulation/Rocket1D.cpp
    src/simulation/Rocket2D.cpp
    src/simulation/LaunchVehicle2D.cpp
    src/simulation/LaunchVehicle3D.cpp
    src/simulation/Simulation.cpp
)

# Export
set(TITAN_EXPORT_SOURCES
    src/export/DataExporter.cpp
)

# Interop
set(TITAN_INTEROP_SOURCES
    src/interop/TitanCAPI.cpp
)

# All sources for the shared library
set(ALL_SOURCES
    ${TITAN_PHYSICS_SOURCES}
    ${TITAN_INTEGRATOR_SOURCES}
    ${TITAN_ORBITAL_SOURCES}
    ${TITAN_GUIDANCE_SOURCES}
    ${TITAN_GNC_SOURCES}
    ${TITAN_SIMULATION_SOURCES}
    ${TITAN_EXPORT_SOURCES}
    ${TITAN_INTEROP_SOURCES}
)

add_library(TitanPhysicsEngine SHARED ${ALL_SOURCES})
target_include_directories(TitanPhysicsEngine PUBLIC include)

# Individual module libraries (static, for selective linking)
add_library(titan-math INTERFACE)
target_include_directories(titan-math INTERFACE include)

add_library(titan-physics STATIC ${TITAN_PHYSICS_SOURCES})
target_include_directories(titan-physics PUBLIC include)

add_library(titan-integrators STATIC ${TITAN_INTEGRATOR_SOURCES})
target_include_directories(titan-integrators PUBLIC include)

add_library(titan-orbital STATIC ${TITAN_ORBITAL_SOURCES})
target_include_directories(titan-orbital PUBLIC include)

add_library(titan-guidance STATIC ${TITAN_GUIDANCE_SOURCES})
target_include_directories(titan-guidance PUBLIC include)
target_link_libraries(titan-guidance titan-orbital)

add_library(titan-gnc STATIC ${TITAN_GNC_SOURCES})
target_include_directories(titan-gnc PUBLIC include)

add_library(titan-export STATIC ${TITAN_EXPORT_SOURCES})
target_include_directories(titan-export PUBLIC include)

add_library(titan-simulation STATIC ${TITAN_SIMULATION_SOURCES})
target_include_directories(titan-simulation PUBLIC include)
target_link_libraries(titan-simulation titan-physics titan-integrators titan-orbital titan-guidance titan-gnc)

# Main test executable
add_executable(TitanTest src/main.cpp)
target_link_libraries(TitanTest TitanPhysicsEngine)

# Test suite
add_executable(TitanTests tests/test_main.cpp)
target_link_libraries(TitanTests TitanPhysicsEngine)
