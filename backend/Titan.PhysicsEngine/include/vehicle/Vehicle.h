#pragma once
#include <vector>
#include <memory>
#include <functional>
#include "simulation/Stage.h"
#include "events/EventBus.h"
#include "math/Vector3.h"

namespace titan::vehicle
{
    class Vehicle
    {
    public:
        Vehicle() : m_currentStageIndex(0) {}

        void AddStage(const titan::simulation::Stage &stage)
        {
            m_stages.push_back(stage);
        }

        double GetTotalMass() const
        {
            double total = 0.0;
            for (size_t i = m_currentStageIndex; i < m_stages.size(); i++)
                total += m_stages[i].GetMass();
            return total;
        }

        double GetThrust() const
        {
            if (m_currentStageIndex >= m_stages.size())
                return 0.0;

            const auto &stage = m_stages[m_currentStageIndex];
            return stage.HasFuel() ? stage.GetThrust() : 0.0;
        }

        double GetMaxThrust() const
        {
            if (m_currentStageIndex >= m_stages.size())
                return 0.0;
            return m_stages[m_currentStageIndex].GetMaxThrust();
        }

        double GetDragCoefficient() const
        {
            if (m_currentStageIndex >= m_stages.size())
                return 0.0;
            return m_stages[m_currentStageIndex].GetDragCoefficient();
        }

        double GetReferenceArea() const
        {
            if (m_currentStageIndex >= m_stages.size())
                return 0.0;
            return m_stages[m_currentStageIndex].GetReferenceArea();
        }

        void Burn(double dt)
        {
            if (m_currentStageIndex >= m_stages.size())
                return;
            m_stages[m_currentStageIndex].Burn(dt);
        }

        void SetThrottle(double throttle)
        {
            if (m_currentStageIndex >= m_stages.size())
                return;
            m_stages[m_currentStageIndex].SetThrottle(throttle);
        }

        bool ShouldSeparateStage() const
        {
            if (m_currentStageIndex >= m_stages.size())
                return false;
            return m_stages[m_currentStageIndex].IsDepleted() &&
                   (m_currentStageIndex + 1) < m_stages.size();
        }

        bool SeparateStage(double time, titan::events::EventBus *eventBus)
        {
            if (!ShouldSeparateStage())
                return false;

            size_t oldIndex = m_currentStageIndex;
            m_currentStageIndex++;

            if (eventBus)
            {
                titan::events::SimEvent event(
                    time,
                    titan::events::EventType::StageSeparation,
                    "Stage " + std::to_string(oldIndex) + " separated");
                event.WithData("stageIndex", static_cast<double>(oldIndex));
                event.WithData("newStageIndex", static_cast<double>(m_currentStageIndex));
                eventBus->Emit(event);
            }

            return true;
        }

        bool HasFuel() const
        {
            if (m_currentStageIndex >= m_stages.size())
                return false;
            return m_stages[m_currentStageIndex].HasFuel();
        }

        bool IsExhausted() const
        {
            return m_currentStageIndex >= m_stages.size() ||
                   (m_stages[m_currentStageIndex].IsDepleted() &&
                    (m_currentStageIndex + 1) >= m_stages.size());
        }

        titan::math::Vector3 GetInertia() const
        {
            double Ixx = 0.0, Iyy = 0.0, Izz = 0.0;
            for (size_t i = m_currentStageIndex; i < m_stages.size(); i++)
            {
                double ix, iy, iz;
                m_stages[i].GetInertia(ix, iy, iz);
                Ixx += ix;
                Iyy += iy;
                Izz += iz;
            }
            return titan::math::Vector3(Ixx, Iyy, Izz);
        }

        size_t GetCurrentStageIndex() const { return m_currentStageIndex; }
        size_t GetStageCount() const { return m_stages.size(); }

        const titan::simulation::Stage &GetCurrentStage() const
        {
            return m_stages[m_currentStageIndex];
        }

        titan::simulation::Stage &GetCurrentStageMut()
        {
            return m_stages[m_currentStageIndex];
        }

    private:
        std::vector<titan::simulation::Stage> m_stages;
        size_t m_currentStageIndex;
    };
}
