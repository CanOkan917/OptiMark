FROM python:3.11-slim

# opencv-python-headless still needs libglib at runtime; no libGL required.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY omr/ omr/
COPY generator/ generator/
COPY backend/ backend/
# omr/, generator/ and backend/ are importable via PYTHONPATH=/app (set below),
# so no separate install of the omr package is required inside the image.

# Run as a non-root user. Creating /app/data here means an empty named volume
# mounted onto it inherits this ownership on first initialization.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).status==200 else 1)" || exit 1

CMD ["uvicorn", "backend.api_app:app", "--host", "0.0.0.0", "--port", "8000"]
