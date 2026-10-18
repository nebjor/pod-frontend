FROM maven:3.9.9-eclipse-temurin-21

ARG DEBIAN_FRONTEND=noninteractive
ARG BAMBU_TAG=v02.08.02.61
ARG BAMBU_APPIMAGE=BambuStudio_ubuntu24.04-v02.08.02.61-20260820225108.AppImage

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    file \
    libasound2t64 \
    libatk-bridge2.0-0t64 \
    libatk1.0-0t64 \
    libcairo2 \
    libcurl4 \
    libdbus-1-3 \
    libdrm2 \
    libegl1 \
    libfontconfig1 \
    libfreetype6 \
    libgbm1 \
    libgdk-pixbuf-2.0-0 \
    libgl1 \
    libgles2 \
    libglu1-mesa \
    libglx-mesa0 \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer1.0-0 \
    libgtk-3-0t64 \
    libharfbuzz0b \
    libice6 \
    libnotify4 \
    libnss3 \
    libosmesa6 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libsecret-1-0 \
    libsoup-3.0-0 \
    libsm6 \
    libwebkit2gtk-4.1-0 \
    libx11-6 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxinerama1 \
    libxkbcommon0 \
    libxrandr2 \
    libxtst6 \
    locales \
    mesa-utils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/bambu

RUN curl -fsSL -o BambuStudio.AppImage \
    "https://github.com/bambulab/BambuStudio/releases/download/${BAMBU_TAG}/${BAMBU_APPIMAGE}" \
 && chmod +x BambuStudio.AppImage \
 && ./BambuStudio.AppImage --appimage-extract >/dev/null \
 && ln -sf /opt/bambu/squashfs-root/AppRun /usr/local/bin/bambu-studio-cli

WORKDIR /app
