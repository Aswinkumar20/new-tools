FROM eclipse-temurin:21-jre-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-eng \
    fonts-dejavu \
    fontconfig \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-java-common \
    chromium-browser \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY target/tool-api-0.1.0-SNAPSHOT.jar app.jar

ENV APP_TEMP_DIR=/tmp/tool-jobs \
    APP_MAX_UPLOAD_MB=50 \
    QPDF_BIN=qpdf \
    GS_BIN=gs \
    PDF_TESSDATA_PATH=/usr/share/tesseract-ocr/5/tessdata \
    CHROMIUM_BIN=chromium-browser \
    LIBREOFFICE_BIN=soffice

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
