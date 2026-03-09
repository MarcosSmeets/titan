#pragma once
#include "telemetry/TelemetryBus.h"
#include <string>
#include <vector>

namespace titan::data
{
    class DataExporter
    {
    public:
        static bool ExportCSV(const titan::telemetry::TelemetryBus &bus,
                              const std::string &filename,
                              const std::vector<std::string> &channels = {});

        static bool ExportJSON(const titan::telemetry::TelemetryBus &bus,
                               const std::string &filename,
                               const std::vector<std::string> &channels = {});

        static std::string ToCSV(const titan::telemetry::TelemetryBus &bus,
                                 const std::vector<std::string> &channels = {});

        static std::string ToJSON(const titan::telemetry::TelemetryBus &bus,
                                  const std::vector<std::string> &channels = {});
    };
}
