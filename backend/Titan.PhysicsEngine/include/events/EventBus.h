#pragma once
#include <functional>
#include <vector>
#include <unordered_map>
#include <queue>
#include <algorithm>
#include "events/SimEvent.h"

namespace titan::events
{
    class EventBus
    {
    public:
        using Handler = std::function<void(const SimEvent &)>;

        void Subscribe(EventType type, Handler handler)
        {
            m_handlers[type].push_back(std::move(handler));
        }

        void SubscribeAll(Handler handler)
        {
            m_globalHandlers.push_back(std::move(handler));
        }

        void Emit(const SimEvent &event)
        {
            m_eventLog.push_back(event);

            auto it = m_handlers.find(event.type);
            if (it != m_handlers.end())
            {
                for (const auto &handler : it->second)
                    handler(event);
            }

            for (const auto &handler : m_globalHandlers)
                handler(event);
        }

        void ScheduleEvent(double time, SimEvent event)
        {
            event.time = time;
            m_scheduledEvents.push_back(std::move(event));
            std::sort(m_scheduledEvents.begin(), m_scheduledEvents.end(),
                      [](const SimEvent &a, const SimEvent &b)
                      { return a.time < b.time; });
        }

        void ProcessScheduledEvents(double currentTime)
        {
            while (!m_scheduledEvents.empty() &&
                   m_scheduledEvents.front().time <= currentTime)
            {
                Emit(m_scheduledEvents.front());
                m_scheduledEvents.erase(m_scheduledEvents.begin());
            }
        }

        const std::vector<SimEvent> &GetEventLog() const
        {
            return m_eventLog;
        }

        void ClearLog()
        {
            m_eventLog.clear();
        }

    private:
        std::unordered_map<EventType, std::vector<Handler>> m_handlers;
        std::vector<Handler> m_globalHandlers;
        std::vector<SimEvent> m_scheduledEvents;
        std::vector<SimEvent> m_eventLog;
    };
}
