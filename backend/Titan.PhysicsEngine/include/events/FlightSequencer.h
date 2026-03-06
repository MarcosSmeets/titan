#pragma once
#include <vector>
#include <functional>
#include <string>
#include "events/EventBus.h"
#include "simulation/SimState.h"

namespace titan::events
{
    class FlightSequencer
    {
    public:
        struct TimedEvent
        {
            double triggerTime;
            SimEvent event;
            bool fired;
        };

        struct ConditionalEvent
        {
            std::function<bool(const titan::simulation::SimState &)> condition;
            SimEvent event;
            bool fired;
        };

        explicit FlightSequencer(std::shared_ptr<EventBus> bus)
            : m_eventBus(std::move(bus)) {}

        void AddTimedEvent(double time, SimEvent event)
        {
            m_timedEvents.push_back({time, std::move(event), false});
        }

        void AddConditionalEvent(
            std::function<bool(const titan::simulation::SimState &)> condition,
            SimEvent event)
        {
            m_conditionalEvents.push_back(
                {std::move(condition), std::move(event), false});
        }

        void Update(double currentTime, const titan::simulation::SimState &state)
        {
            for (auto &te : m_timedEvents)
            {
                if (!te.fired && currentTime >= te.triggerTime)
                {
                    te.event.time = currentTime;
                    m_eventBus->Emit(te.event);
                    te.fired = true;
                }
            }

            for (auto &ce : m_conditionalEvents)
            {
                if (!ce.fired && ce.condition(state))
                {
                    ce.event.time = currentTime;
                    m_eventBus->Emit(ce.event);
                    ce.fired = true;
                }
            }
        }

        void Reset()
        {
            for (auto &te : m_timedEvents)
                te.fired = false;
            for (auto &ce : m_conditionalEvents)
                ce.fired = false;
        }

    private:
        std::shared_ptr<EventBus> m_eventBus;
        std::vector<TimedEvent> m_timedEvents;
        std::vector<ConditionalEvent> m_conditionalEvents;
    };
}
