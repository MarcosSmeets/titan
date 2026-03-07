#include "export/DataExporter.h"
#include <fstream>
#include <sstream>
#include <map>
#include <set>
#include <iomanip>
#include <algorithm>

namespace titan::data
{
    // Internal: pivot telemetry records into a time-indexed table
    struct PivotTable
    {
        std::vector<double> times;
        std::vector<std::string> channels;
        // values[timeIdx][channelIdx]
        std::vector<std::vector<double>> values;
    };

    static PivotTable BuildPivotTable(
        const titan::telemetry::TelemetryBus &bus,
        const std::vector<std::string> &filterChannels)
    {
        const auto &records = bus.GetRecords();

        // Collect unique times and channels
        std::set<double> timeSet;
        std::set<std::string> channelSet;

        for (const auto &rec : records)
        {
            if (!filterChannels.empty())
            {
                bool found = false;
                for (const auto &fc : filterChannels)
                    if (rec.channel == fc)
                    {
                        found = true;
                        break;
                    }
                if (!found)
                    continue;
            }
            timeSet.insert(rec.time);
            channelSet.insert(rec.channel);
        }

        PivotTable table;
        table.times.assign(timeSet.begin(), timeSet.end());
        table.channels.assign(channelSet.begin(), channelSet.end());

        // Build index maps
        std::map<double, size_t> timeIdx;
        for (size_t i = 0; i < table.times.size(); i++)
            timeIdx[table.times[i]] = i;

        std::map<std::string, size_t> chanIdx;
        for (size_t i = 0; i < table.channels.size(); i++)
            chanIdx[table.channels[i]] = i;

        table.values.resize(table.times.size(),
                            std::vector<double>(table.channels.size(), 0.0));

        for (const auto &rec : records)
        {
            auto tIt = timeIdx.find(rec.time);
            auto cIt = chanIdx.find(rec.channel);
            if (tIt == timeIdx.end() || cIt == chanIdx.end())
                continue;
            table.values[tIt->second][cIt->second] = rec.value.scalar;
        }

        return table;
    }

    std::string DataExporter::ToCSV(
        const titan::telemetry::TelemetryBus &bus,
        const std::vector<std::string> &channels)
    {
        auto table = BuildPivotTable(bus, channels);

        std::ostringstream ss;
        ss << std::fixed << std::setprecision(6);

        // Header
        ss << "time";
        for (const auto &ch : table.channels)
            ss << "," << ch;
        ss << "\n";

        // Rows
        for (size_t i = 0; i < table.times.size(); i++)
        {
            ss << table.times[i];
            for (size_t j = 0; j < table.channels.size(); j++)
                ss << "," << table.values[i][j];
            ss << "\n";
        }

        return ss.str();
    }

    std::string DataExporter::ToJSON(
        const titan::telemetry::TelemetryBus &bus,
        const std::vector<std::string> &channels)
    {
        auto table = BuildPivotTable(bus, channels);

        std::ostringstream ss;
        ss << std::fixed << std::setprecision(6);

        ss << "{\"metadata\":{\"channels\":[";
        for (size_t i = 0; i < table.channels.size(); i++)
        {
            if (i > 0)
                ss << ",";
            ss << "\"" << table.channels[i] << "\"";
        }
        ss << "],\"records\":" << table.times.size() << "},\"data\":[";

        for (size_t i = 0; i < table.times.size(); i++)
        {
            if (i > 0)
                ss << ",";
            ss << "{\"time\":" << table.times[i];
            for (size_t j = 0; j < table.channels.size(); j++)
            {
                ss << ",\"" << table.channels[j] << "\":" << table.values[i][j];
            }
            ss << "}";
        }

        ss << "]}";
        return ss.str();
    }

    bool DataExporter::ExportCSV(
        const titan::telemetry::TelemetryBus &bus,
        const std::string &filename,
        const std::vector<std::string> &channels)
    {
        std::ofstream file(filename);
        if (!file.is_open())
            return false;
        file << ToCSV(bus, channels);
        return file.good();
    }

    bool DataExporter::ExportJSON(
        const titan::telemetry::TelemetryBus &bus,
        const std::string &filename,
        const std::vector<std::string> &channels)
    {
        std::ofstream file(filename);
        if (!file.is_open())
            return false;
        file << ToJSON(bus, channels);
        return file.good();
    }
}
