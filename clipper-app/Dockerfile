FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/clipper-app
COPY clipper-app/requirements.txt /app/clipper-app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY clipper-app /app/clipper-app
ENV PYTHONPATH=/app/clipper-app

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
