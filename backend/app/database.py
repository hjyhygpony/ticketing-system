from mysql.connector.pooling import MySQLConnectionPool

from . import config


pool = None


def get_pool():
    global pool
    if pool is None:
        pool = MySQLConnectionPool(
            pool_name="ticketing_pool",
            pool_size=5,
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset="utf8mb4",
            autocommit=False,
        )
    return pool


def get_connection():
    return get_pool().get_connection()


def fetch_one(sql, params=()):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        return cursor.fetchone()
    finally:
        cursor.close()
        connection.close()


def fetch_all(sql, params=()):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        connection.close()


def execute(sql, params=()):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        connection.commit()
        return cursor.lastrowid
    finally:
        cursor.close()
        connection.close()


def run_in_transaction(work):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        result = work(cursor)
        connection.commit()
        return result
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()
