# Two stages, one runtime process: Node builds the SPA, Python serves both it and the API.
# ---------------------------------------------------------------------------- web
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------ runtime
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DATA_DIR=/data

WORKDIR /srv
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install .
COPY --from=web /web/dist ./app/static

# The account file is the only thing written at runtime. Everything else stays
# read-only, which is why /data is its own volume.
RUN mkdir -p /data && chown 1000:1000 /data
VOLUME ["/data"]

USER 1000:1000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3).status == 200 else 1)"

CMD ["python", "-m", "app"]
