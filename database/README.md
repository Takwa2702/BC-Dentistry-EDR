# Database — Schema, Seed Data, and Dump

**MySQL version:** 9.0.1 (Docker image `mysql:9.0.1`)
**Database name:** `mydatabase`
**Default user:** `root`
**Password:** provided separately through a secure channel (not committed to this repo)

This folder is mounted into the MySQL container at
`/docker-entrypoint-initdb.d` by `docker-compose.yml`. Any `.sql` file placed
here is executed automatically, in alphabetical order, **the first time** the
container is created (i.e. when the data volume is empty).

## Files

- `schema.sql` — table definitions (structure only).
- `seed.sql` — seed/test data (sample users, patients, appointments).
- A full `dump.sql` can be produced from a running container (see below).

## Producing a full dump from the running container

Run this on the machine where the current MySQL container is running. Replace
`edr-mysql` with the actual container name (or ID) if different:

```bash
# Structure + data, single file
docker exec edr-mysql \
  mysqldump -uroot -p<DB_PASSWORD> --databases mydatabase \
  --routines --triggers --single-transaction > dump.sql
```

To export structure and data separately:

```bash
# Schema only
docker exec edr-mysql \
  mysqldump -uroot -p<DB_PASSWORD> --no-data mydatabase > schema.sql

# Data only
docker exec edr-mysql \
  mysqldump -uroot -p<DB_PASSWORD> --no-create-info mydatabase > seed.sql
```

## Importing into a fresh database

If you use `docker-compose up`, the files in this folder are imported
automatically on first run — no manual step needed.

To import manually into an already-running container:

```bash
docker exec -i edr-mysql \
  mysql -uroot -p<DB_PASSWORD> mydatabase < dump.sql
```

## Inspecting the database

```bash
docker exec -it edr-mysql mysql -uroot -p
# then:
#   SHOW DATABASES;
#   USE mydatabase;
#   SHOW TABLES;
#   SELECT * FROM User;
```
