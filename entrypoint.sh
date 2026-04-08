#!/bin/sh
# Inject runtime env into /config.js so React can read window.BACKEND_URL / window.DASHBOARD_URL
cat <<EOF > /usr/share/nginx/html/config.js
window.BACKEND_URL = "${BACKEND_URL:-http://localhost:8000}";
window.DASHBOARD_URL = "${DASHBOARD_URL:-http://localhost:5174}";
EOF
exec nginx -g "daemon off;"
