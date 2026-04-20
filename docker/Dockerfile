#----------------------build---------------------------
FROM node:24.13-alpine AS build
WORKDIR /app

ENV REACT_APP_BASE_URL_AUTH_API="http://localhost:8080/auth-service"
ENV REACT_APP_URL_LOGIN="http://localhost:5000/login"

COPY --from=src . /app
RUN npm install
RUN npm run build


# ------nginx web server ---------
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
