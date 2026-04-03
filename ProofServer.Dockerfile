FROM midnightntwrk/proof-server:7.0.0

# Broadly map the compiler keys across the entire spectrum of default caching locations
COPY contracts/managed/ep-contract/keys/* /root/.cache/midnight/
COPY contracts/managed/ep-contract/keys/* /home/nonroot/.cache/midnight/
COPY contracts/managed/ep-contract/keys/* /app/keys/
COPY contracts/managed/ep-contract/keys/* /data/keys/

# Bypass distroless bash wrapper and execute parameters natively
ENTRYPOINT []
CMD ["midnight-proof-server", "-v"]
