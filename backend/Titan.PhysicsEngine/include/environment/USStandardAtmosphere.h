#pragma once
#include "environment/Atmosphere.h"
#include <cmath>

namespace titan::environment
{
    class USStandardAtmosphere : public Atmosphere
    {
    public:
        USStandardAtmosphere()
            : Atmosphere(1.225, 8500.0, 101325.0, 288.15) {}

        double GetTemperature(double altitude) const override
        {
            if (altitude < 0.0)
                altitude = 0.0;

            // US Standard Atmosphere 1976 (simplified piecewise)
            if (altitude < 11000.0)
                return 288.15 - 0.0065 * altitude; // Troposphere

            if (altitude < 20000.0)
                return 216.65; // Tropopause (isothermal)

            if (altitude < 32000.0)
                return 216.65 + 0.001 * (altitude - 20000.0); // Stratosphere lower

            if (altitude < 47000.0)
                return 228.65 + 0.0028 * (altitude - 32000.0); // Stratosphere upper

            if (altitude < 51000.0)
                return 270.65; // Stratopause (isothermal)

            if (altitude < 71000.0)
                return 270.65 - 0.0028 * (altitude - 51000.0); // Mesosphere lower

            if (altitude < 86000.0)
                return 214.65 - 0.002 * (altitude - 71000.0); // Mesosphere upper

            // Thermosphere (simplified — temperature rises but density negligible)
            return 186.87;
        }

        double GetPressure(double altitude) const override
        {
            if (altitude < 0.0)
                altitude = 0.0;

            // Barometric formula for each layer
            // Layer base values: {altitude_m, temperature_K, pressure_Pa, lapse_rate_K/m}
            struct Layer
            {
                double h0;
                double T0;
                double P0;
                double L; // lapse rate (K/m)
            };

            static constexpr Layer layers[] = {
                {0.0, 288.15, 101325.0, -0.0065},
                {11000.0, 216.65, 22632.1, 0.0},
                {20000.0, 216.65, 5474.89, 0.001},
                {32000.0, 228.65, 868.019, 0.0028},
                {47000.0, 270.65, 110.906, 0.0},
                {51000.0, 270.65, 66.9389, -0.0028},
                {71000.0, 214.65, 3.95642, -0.002},
            };

            constexpr int numLayers = 7;
            constexpr double g0 = 9.80665;
            constexpr double M = 0.0289644;  // molar mass of air (kg/mol)
            constexpr double R = 8.31447;    // universal gas constant (J/mol/K)

            int layerIdx = numLayers - 1;
            for (int i = 0; i < numLayers - 1; i++)
            {
                if (altitude < layers[i + 1].h0)
                {
                    layerIdx = i;
                    break;
                }
            }

            const Layer &layer = layers[layerIdx];
            double dh = altitude - layer.h0;

            if (std::abs(layer.L) < 1e-10)
            {
                // Isothermal layer
                return layer.P0 * std::exp(-g0 * M * dh / (R * layer.T0));
            }
            else
            {
                // Gradient layer
                double exponent = g0 * M / (R * layer.L);
                return layer.P0 * std::pow(
                                      (layer.T0 + layer.L * dh) / layer.T0,
                                      -exponent);
            }
        }

        double GetDensity(double altitude) const override
        {
            if (altitude < 0.0)
                altitude = 0.0;

            // rho = P / (R_specific * T)
            constexpr double Rspecific = 287.058; // J/(kg*K) for dry air
            double T = GetTemperature(altitude);
            double P = GetPressure(altitude);

            if (T < 1.0)
                return 0.0;

            return P / (Rspecific * T);
        }
    };
}
