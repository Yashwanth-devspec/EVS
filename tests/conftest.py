"""
Tests run against their own throwaway SQLite file and never call OSRM, Photon or Nominatim.
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(prefix="ecoride-test-", suffix=".db", delete=False)
_tmp.close()
os.environ["ECORIDE_DB_PATH"] = _tmp.name
os.environ["ECORIDE_OFFLINE"] = "1"
