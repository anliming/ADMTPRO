FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY requirements.txt /app/requirements.txt
# APT 源
RUN printf "deb http://mirrors.aliyun.com/debian bookworm main contrib non-free non-free-firmware\n\
deb http://mirrors.aliyun.com/debian bookworm-updates main contrib non-free non-free-firmware\n\
deb http://mirrors.aliyun.com/debian-security bookworm-security main contrib non-free non-free-firmware\n" \
> /etc/apt/sources.list
# 系统依赖
RUN apt-get update \
 &&apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r /app/requirements.txt
COPY . /app
CMD ["gunicorn", "-w", "3", "-b", "0.0.0.0:8000", "app:create_app()"]
