CREATE TABLE page (
  id serial PRIMARY KEY,
  path text UNIQUE NOT NULL,
  creation_time timestamptz NOT NULL,
  creation_ip inet NOT NULL
);

CREATE TABLE access (
  page_id integer REFERENCES page NOT NULL,
  time timestamptz NOT NULL,
  ip inet NOT NULL
);
CREATE INDEX ON access (page_id);
