FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download the Virtual Product Studio's segmentation model (~170MB) at
# build time. Without this, it downloads over the network on the first
# /media/enhance call in each new container — slow enough to time out or
# spike memory hard enough to crash the whole process (observed in
# production: one enhance request timing out, followed by every other
# endpoint 502ing for ~2 minutes while the container restarted).
RUN python -c "from rembg import new_session; new_session('isnet-general-use')"

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]