#!/bin/bash
# Executed by the official postgres image on FIRST start of an empty data volume.
# Creates the least-privilege roles and locks down the database (see database/bootstrap.sql).
# Works whether the entrypoint executes or sources this file.
psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -f /bootstrap/bootstrap.sql
