#pragma once

namespace titan::simulation
{
    /*
        Represents a single rocket stage.

        Each stage has:
        - Dry mass
        - Fuel mass
        - Burn rate (kg/s)
        - Exhaust velocity (m/s)

        Thrust = burnRate * exhaustVelocity
    */
    class Stage
    {
    public:
        Stage(double dryMass,
              double fuelMass,
              double burnRate,
              double exhaustVelocity)
            : m_dryMass(dryMass),
              m_fuelMass(fuelMass),
              m_burnRate(burnRate),
              m_exhaustVelocity(exhaustVelocity)
        {
        }

        bool HasFuel() const
        {
            return m_fuelMass > 0.0;
        }

        void Burn(double dt)
        {
            if (!HasFuel())
                return;

            double fuelConsumed = m_burnRate * dt;

            if (fuelConsumed > m_fuelMass)
                fuelConsumed = m_fuelMass;

            m_fuelMass -= fuelConsumed;
        }

        double GetThrust() const
        {
            if (!HasFuel())
                return 0.0;

            return m_burnRate * m_exhaustVelocity;
        }

        double GetMass() const
        {
            return m_dryMass + m_fuelMass;
        }

        bool IsDepleted() const
        {
            return m_fuelMass <= 0.0;
        }

    private:
        double m_dryMass;
        double m_fuelMass;
        double m_burnRate;
        double m_exhaustVelocity;
    };
}