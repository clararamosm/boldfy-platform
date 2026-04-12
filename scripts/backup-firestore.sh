#!/bin/bash
# Firestore automated backup script
# Run daily via Cloud Scheduler or cron
#
# Prerequisites:
#   1. gcloud CLI authenticated with project owner/editor role
#   2. GCS bucket created: gs://boldfy-firestore-backups
#   3. Cloud Scheduler or GitHub Actions cron configured
#
# Usage:
#   ./scripts/backup-firestore.sh
#
# Setup (run once):
#   gcloud storage buckets create gs://boldfy-firestore-backups --location=southamerica-east1
#   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
#     --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
#     --role="roles/datastore.importExportAdmin"
#   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
#     --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
#     --role="roles/storage.admin"

set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
BUCKET="gs://boldfy-firestore-backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_PATH="${BUCKET}/${TIMESTAMP}"

echo "[$(date)] Starting Firestore backup..."
echo "Project: ${PROJECT_ID}"
echo "Destination: ${BACKUP_PATH}"

# Export all collections
gcloud firestore export "${BACKUP_PATH}" \
  --project="${PROJECT_ID}" \
  --collection-ids=users,companies,globalSessions,stripeEvents

echo "[$(date)] Backup started successfully: ${BACKUP_PATH}"

# Clean up backups older than 30 days
echo "[$(date)] Cleaning up backups older than 30 days..."
CUTOFF_DATE=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d 2>/dev/null)
if [ -n "${CUTOFF_DATE}" ]; then
  gcloud storage ls "${BUCKET}/" 2>/dev/null | while read -r backup_dir; do
    backup_date=$(echo "${backup_dir}" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
    if [ -n "${backup_date}" ] && [[ "${backup_date}" < "${CUTOFF_DATE}" ]]; then
      echo "Deleting old backup: ${backup_dir}"
      gcloud storage rm -r "${backup_dir}" --quiet
    fi
  done
fi

echo "[$(date)] Backup process complete."
