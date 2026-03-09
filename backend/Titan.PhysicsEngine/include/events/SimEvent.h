#pragma once
#include <string>
#include <unordered_map>

namespace titan::events
{
    enum class EventType
    {
        StageIgnition,
        StageSeparation,
        StageBurnout,
        MaxQ,
        FairingJettison,
        OrbitInsertion,
        Impact,
        SimulationStart,
        SimulationEnd,
        GuidancePhaseChange,
        ThrottleChange,
        Custom
    };

    struct SimEvent
    {
        double time;
        EventType type;
        std::string description;
        std::unordered_map<std::string, double> data;

        SimEvent() : time(0.0), type(EventType::Custom) {}

        SimEvent(double t, EventType tp, const std::string &desc)
            : time(t), type(tp), description(desc) {}

        SimEvent &WithData(const std::string &key, double value)
        {
            data[key] = value;
            return *this;
        }
    };
}
