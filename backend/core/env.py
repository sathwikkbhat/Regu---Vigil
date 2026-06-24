import os
from dotenv import load_dotenv

def load_robust_env():
    """
    Scans upwards from the current file location to find a .env file,
    loading it with override=True to ensure existing dummy/invalid
    environment variables are replaced.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    for _ in range(4):
        env_path = os.path.join(current_dir, ".env")
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path, override=True)
            print(f"[Env] Loaded environment from: {env_path}")
            return
        parent_dir = os.path.dirname(current_dir)
        if parent_dir == current_dir:
            break
        current_dir = parent_dir
    # Fallback
    load_dotenv(override=True)
