FROM ubuntu
RUN apt-get update && apt-get install -y unzip \
    tzdata && \
    echo "Asia/Shanghai" > /etc/timezone && \ 
    ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime && \
    apt autoremove -y && \
    apt clean && \
    rm -rf \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*
