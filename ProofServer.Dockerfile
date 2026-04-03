FROM midnightntwrk/proof-server:7.0.0



COPY ./backend/src/managed/ep-contract/keys/* /
COPY ./backend/src/managed/ep-contract/keys/* /app/keys/
COPY ./backend/src/managed/ep-contract/keys/* /keys/
COPY ./backend/src/managed/ep-contract/keys/* /root/.midnight/keys/

ENTRYPOINT []
CMD ["midnight-proof-server", "-v"]
