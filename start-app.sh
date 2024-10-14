#!/bin/bash
while true; do
  echo "Memulai aplikasi Node.js..."
  npm start
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "Aplikasi berhenti dengan kode exit $EXIT_CODE. Mengulang dalam 5 detik..."
    sleep 5
  else
    echo "Aplikasi berhenti dengan sukses."
    break
  fi
done