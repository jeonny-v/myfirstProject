FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/nginx.conf
RUN chown -R nginx:nginx /var/cache/nginx /var/run /etc/nginx/conf.d
USER nginx
EXPOSE 8080
