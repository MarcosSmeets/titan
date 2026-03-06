#pragma once
#include <string>
#include <vector>
#include <functional>
#include <unordered_map>

namespace titan::telemetry
{
    struct TelemetryValue
    {
        double scalar;
        double x, y, z; // for vector values

        TelemetryValue() : scalar(0.0), x(0.0), y(0.0), z(0.0) {}

        static TelemetryValue Scalar(double v)
        {
            TelemetryValue tv;
            tv.scalar = v;
            return tv;
        }

        static TelemetryValue Vec3(double x_, double y_, double z_)
        {
            TelemetryValue tv;
            tv.x = x_;
            tv.y = y_;
            tv.z = z_;
            return tv;
        }
    };

    struct TelemetryRecord
    {
        std::string channel;
        double time;
        TelemetryValue value;
    };

    using TelemetryCallback = std::function<void(
        const std::string &channel, double time, const TelemetryValue &value)>;

    class TelemetryBus
    {
    public:
        void Publish(const std::string &channel, double time,
                     const TelemetryValue &value)
        {
            m_records.push_back({channel, time, value});

            auto it = m_subscribers.find(channel);
            if (it != m_subscribers.end())
            {
                for (const auto &cb : it->second)
                    cb(channel, time, value);
            }

            for (const auto &cb : m_globalSubscribers)
                cb(channel, time, value);
        }

        void Subscribe(const std::string &channel, TelemetryCallback callback)
        {
            m_subscribers[channel].push_back(std::move(callback));
        }

        void SubscribeAll(TelemetryCallback callback)
        {
            m_globalSubscribers.push_back(std::move(callback));
        }

        const std::vector<TelemetryRecord> &GetRecords() const
        {
            return m_records;
        }

        void Clear()
        {
            m_records.clear();
        }

    private:
        std::vector<TelemetryRecord> m_records;
        std::unordered_map<std::string, std::vector<TelemetryCallback>> m_subscribers;
        std::vector<TelemetryCallback> m_globalSubscribers;
    };
}
