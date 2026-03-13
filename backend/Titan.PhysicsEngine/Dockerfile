FROM gcc:13 AS builder

RUN apt-get update && apt-get install -y cmake && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN mkdir -p build && cd build \
    && cmake .. \
    && cmake --build . \
    && cp libTitanPhysicsEngine.so /usr/local/lib/

FROM gcc:13-bookworm AS runtime
COPY --from=builder /usr/local/lib/libTitanPhysicsEngine.so /usr/local/lib/
COPY --from=builder /src/build/TitanTest /usr/local/bin/

RUN ldconfig

CMD ["TitanTest"]
