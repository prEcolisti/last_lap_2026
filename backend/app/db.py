import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

pool = ConnectionPool(
    os.environ.get("DATABASE_URL", ""),
    min_size=1,
    max_size=10,
    open=False,
    kwargs={"row_factory": dict_row},
)
