DOMAIN_NAME="objecthub.xyz"
SITE_REPO="https://github.com/MIOBOMB/ojhub-node"
RECAP="google-captcha-token"
DB_NAME="gdpshelper"
DB_USER="gdpshelper"
DB_PASS="gdpshelper"
DB_HOST="localhost"
DB_PORT="3306"
RD_HOST="localhost"
RD_PORT="6379"
RD_PASS=""
ROOT_PASS="gdpshelper"
TG_NEWS_RESENDER=""
TG_BOT_TOKEN=""

pkg update
pkg upgrade -y

pkg install -y node24 npm-node24 redis nginx mariadb118-server git py311-certbot py311-certbot-nginx

sysrc redis_enable="YES"
sysrc nginx_enable="YES"
sysrc mysql_enable="YES"

service mysql-server start

sleep 8

mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY '${ROOT_PASS}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT SELECT, INSERT, UPDATE, DELETE ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

cat > /usr/local/etc/nginx/nginx.conf << EOF
worker_processes  1;

events {
	worker_connections  1024;
}

http {
	include mime.types;
	gzip on;
	gzip_comp_level 5;
	gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
	gzip_min_length 256;
	
	upstream nodejs_backend {
		server 127.0.0.1:3000;
		keepalive 32;
	}

	server {
		listen 80;
		server_name ${DOMAIN_NAME};
		root /usr/local/ojhub/public;
		index index.html;

		location /static/ {
			alias /usr/local/ojhub/public/static/;
			expires 30d;
			add_header Cache-Control "public, no-transform";
		}

		location /imgs/ {
			alias /usr/local/ojhub/public/imgs/;
			expires 30d;
			add_header Cache-Control "public, no-transform";
		}

		location ~ ^/api(/.*)?$ {
			proxy_pass http://nodejs_backend\$1\$is_args\$args;
			proxy_http_version 1.1;
			proxy_set_header Host \$host;
			proxy_set_header X-Real-IP \$remote_addr;
			proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
			proxy_set_header X-Forwarded-Proto \$scheme;
		}
	}
}
EOF

nginx -t || { echo "nginx.conf error"; exit 1; }

service redis start
service nginx start

git clone ${SITE_REPO} /usr/local/ojhub

if [ -d "/usr/local/ojhub" ]; then
	cd /usr/local/ojhub

	mysql -u root -p${ROOT_PASS} ${DB_NAME} < database.sql

	npm i
	npm install -g pm2

	cat > run.sh << EOF
export SQL_DB="${DB_NAME}"
export SQL_USER="${DB_USER}"
export SQL_PASSWD="${DB_PASS}"
export SQL_HOST="${DB_HOST}"
export SQL_PORT="${DB_PORT}"

export RAMDB_HOST="${RD_HOST}"
export RAMDB_PORT="${RD_PORT}"
export RAMDB_PASSWD="${RD_PASS}"
export RAMDB_NUM="0"

export NODE_PORT="3000"
export RECAPTCHA="${RECAP}"

export TG_NEWS_RESENDER="${TG_NEWS_RESENDER}"
export TG_BOT_TOKEN="${TG_BOT_TOKEN}"
export IMGS="./imgs/"
pm2 start "npm run prod"
EOF
	chmod +x run.sh  
	chown -R www:www /usr/local/ojhub
	sh run.sh
fi

certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email "miobomb.real@gmail.com"

cd -p /usr/local/ojhub
fetch https://objecthub.xyz/country/GeoLite2-City.mmdb

echo "done"