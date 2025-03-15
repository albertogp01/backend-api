FROM node:16-alpine

WORKDIR /usr/src/app

# Copiar archivos de definición de paquete
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Instalar dependencias para Puppeteer en Alpine
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Configurar variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar el código fuente
COPY . .

# Crear directorio temp si no existe
RUN mkdir -p temp

# Exponer puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]