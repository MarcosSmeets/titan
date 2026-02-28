#include <iostream>
#include "core/Vector3.h"
#include "physics/GravityModel.h"

int main()
{
    titan::core::Vector3 position(0, 0, 6371000.0 + 1000.0); // 1km altitude
    double mass = 1000.0;

    auto gravity = titan::physics::GravityModel::ComputeGravity(position, mass);

    std::cout << "Gravity Force: "
              << gravity.x << ", "
              << gravity.y << ", "
              << gravity.z << std::endl;

    return 0;
}