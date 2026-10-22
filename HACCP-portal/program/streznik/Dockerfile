FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 HACCP_DATA=/data
WORKDIR /app
COPY --chown=node:node . .
# /data: baza znanja (baza) in podatki strank (podatki); privzeta baza iz /app/baza se ob zagonu dopolni (posodobitve dosežejo obstoječe namestitve)
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js", "--tiho"]
