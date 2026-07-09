# This file is intentionally not used for Render deployments.
# Render should build the backend from whatsapp-service/Dockerfile instead.
FROM scratch
CMD ["echo", "This root Dockerfile is not used for Render deployments. Use whatsapp-service/Dockerfile instead."]
