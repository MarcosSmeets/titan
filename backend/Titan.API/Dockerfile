# Stage 1: Build the C++ physics engine (same Debian base as runtime)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS cpp-builder

RUN apt-get update && apt-get install -y g++ cmake make && rm -rf /var/lib/apt/lists/*

WORKDIR /cpp
COPY backend/Titan.PhysicsEngine/ .

RUN mkdir -p build && cd build \
    && cmake .. \
    && cmake --build .

# Stage 2: Build the .NET API
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-builder

WORKDIR /api
COPY backend/Titan.API/ .

RUN dotnet publish -c Release -o /app

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app
COPY --from=dotnet-builder /app .
COPY --from=cpp-builder /cpp/build/libTitanPhysicsEngine.so /app/

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV LD_LIBRARY_PATH=/app

EXPOSE 5000

ENTRYPOINT ["dotnet", "Titan.API.dll"]
