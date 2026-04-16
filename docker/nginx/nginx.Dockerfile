FROM chainguard/nginx:latest

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080