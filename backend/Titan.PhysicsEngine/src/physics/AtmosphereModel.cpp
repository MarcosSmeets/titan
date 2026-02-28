#include "physics/AtmosphereModel.h"
#include <cmath>

namespace titan::physics
{
    double AtmosphereModel::GetDensity(double altitude)
    {
        if (altitude < 0.0)
            altitude = 0.0;

        return rho0 * std::exp(-altitude / scaleHeight);
    }
}