#pragma once
#include <algorithm>
#include <cmath>

namespace titan::simulation
{
    /*
        Represents a rocket stage.

        Includes:
            - Mass properties
            - Propulsion
            - Aerodynamic properties
            - Throttle control
    */
    class Stage
    {
    public:
        Stage(
            double dryMass,
            double fuelMass,
            double burnRate,
            double exhaustVelocity,
            double referenceArea,
            double dragCoefficient)
            : m_dryMass(dryMass),
              m_fuelMass(fuelMass),
              m_burnRate(burnRate),
              m_exhaustVelocity(exhaustVelocity),
              m_referenceArea(referenceArea),
              m_dragCoefficient(dragCoefficient),
              m_throttle(1.0)
        {
        }

        /*
            Returns total current mass of the stage.
        */
        double GetMass() const
        {
            return m_dryMass + m_fuelMass;
        }

        /*
            Returns maximum possible thrust (100% throttle).
        */
        double GetMaxThrust() const
        {
            return m_burnRate * m_exhaustVelocity;
        }

        /*
            Returns current thrust (depends on throttle).
        */
        double GetThrust() const
        {
            return m_throttle * GetMaxThrust();
        }

        /*
            Burns fuel according to throttle.
        */
        void Burn(double dt)
        {
            if (m_fuelMass <= 0.0)
                return;

            double massFlow = m_throttle * m_burnRate * dt;
            m_fuelMass = std::max(0.0, m_fuelMass - massFlow);
        }

        bool HasFuel() const
        {
            return m_fuelMass > 0.0;
        }

        bool IsDepleted() const
        {
            return m_fuelMass <= 0.0;
        }

        void SetThrottle(double throttle)
        {
            m_throttle = std::clamp(throttle, 0.0, 1.0);
        }

        double GetReferenceArea() const
        {
            return m_referenceArea;
        }

        double GetDragCoefficient() const
        {
            return m_dragCoefficient;
        }

        void SetInertia(double Ixx, double Iyy, double Izz)
        {
            m_Ixx = Ixx;
            m_Iyy = Iyy;
            m_Izz = Izz;
        }

        void GetInertia(double &Ixx, double &Iyy, double &Izz) const
        {
            if (m_Ixx > 0.0)
            {
                Ixx = m_Ixx;
                Iyy = m_Iyy;
                Izz = m_Izz;
            }
            else
            {
                // Cylinder approximation from total mass
                double m = GetMass();
                double r = std::sqrt(m_referenceArea / 3.14159265);
                double h = 10.0 * r; // length ~10x radius
                Ixx = m * (3.0 * r * r + h * h) / 12.0;
                Iyy = Ixx;
                Izz = m * r * r / 2.0;
            }
        }

    private:
        double m_dryMass;
        double m_fuelMass;
        double m_burnRate;
        double m_exhaustVelocity;

        double m_referenceArea;
        double m_dragCoefficient;
        double m_throttle;

        double m_Ixx = 0.0;
        double m_Iyy = 0.0;
        double m_Izz = 0.0;
    };
}