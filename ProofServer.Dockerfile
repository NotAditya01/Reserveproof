FROM midnightntwrk/proof-server:7.0.0

# Create a dedicated directory inside the container for the keys
RUN mkdir -p /app/keys

# Copy the exact compilation keys perfectly into the container
COPY ./backend/src/managed/ep-contract/keys /app/keys

# Start the Proof Server explicitly targeting the bundled custom keys
ENTRYPOINT ["midnight-proof-server", "--dir", "/app/keys"]
